import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DEFAULT_APP_ORIGIN = "https://fluxtalent.lovable.app";
const MS_CALLBACK_PATH = "/api/public/microsoft/callback";

function callbackUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}${MS_CALLBACK_PATH}`;
}

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

function configuredAppOrigin() {
  return normalizeOrigin(process.env.PUBLIC_APP_URL) ?? DEFAULT_APP_ORIGIN;
}

function isTrustedOrigin(origin: string) {
  try {
    const url = new URL(origin);
    const isLovableHost = url.hostname === "fluxtalent.lovable.app" || url.hostname.endsWith(".lovable.app");
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const isConfigured = origin === configuredAppOrigin();
    return (url.protocol === "https:" && (isLovableHost || isConfigured)) || (url.protocol === "http:" && isLocal);
  } catch { return false; }
}

function safeReturnOrigin(inputOrigin: string) {
  const origin = normalizeOrigin(inputOrigin);
  return origin && isTrustedOrigin(origin) ? origin : configuredAppOrigin();
}

async function hmac(payload: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function buildOAuthState(userId: string, callbackUri: string, returnOrigin: string) {
  const payload = JSON.stringify({ userId, callbackUri, returnOrigin, provider: "microsoft", nonce: crypto.randomUUID(), ts: Date.now() });
  const sig = await hmac(payload, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return `${btoa(payload)}.${sig}`;
}

export async function verifyMicrosoftOAuthState(state: string): Promise<{ userId: string; callbackUri: string | null; returnOrigin: string | null } | null> {
  const [encoded, sig] = state.split(".");
  if (!encoded || !sig) return null;
  let payload: string;
  try { payload = atob(encoded); } catch { return null; }
  const expected = await hmac(payload, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  if (expected !== sig) return null;
  try {
    const parsed = JSON.parse(payload) as { userId?: string; callbackUri?: string; returnOrigin?: string; provider?: string; ts?: number };
    if (parsed.provider !== "microsoft") return null;
    if (!parsed.userId || !parsed.ts || Date.now() - parsed.ts > 10 * 60_000) return null;
    const callbackUri = parsed.callbackUri && callbackUrl(new URL(parsed.callbackUri).origin) === parsed.callbackUri
      ? parsed.callbackUri : null;
    const returnOrigin = parsed.returnOrigin && isTrustedOrigin(parsed.returnOrigin) ? parsed.returnOrigin : null;
    return { userId: parsed.userId, callbackUri, returnOrigin };
  } catch { return null; }
}

export const microsoftStartUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { microsoftAuthUrl, microsoftOAuthClientDiagnostics } = await import("@/lib/microsoft.server");
    const diagnostics = microsoftOAuthClientDiagnostics();
    if (!diagnostics.clientIdConfigured || !diagnostics.clientSecretConfigured) {
      return { ok: false as const, error: "missing_credentials", callbackUri: null, requiredCallbackUris: [callbackUrl(configuredAppOrigin())], diagnostics };
    }
    const returnOrigin = safeReturnOrigin(data.origin);
    const callbackUri = callbackUrl(configuredAppOrigin()); // Entra client tiene sólo un redirect fijo
    const state = await buildOAuthState(context.userId, callbackUri, returnOrigin);
    const url = microsoftAuthUrl(callbackUri, state);
    return { ok: true as const, url, callbackUri, returnOrigin, requiredCallbackUris: [callbackUri], diagnostics };
  });

export const getMicrosoftStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("profiles")
      .select("microsoft_email, microsoft_connected_at, microsoft_refresh_token")
      .eq("id", context.userId).maybeSingle();
    const base = {
      connected: !!data?.microsoft_email && !!data?.microsoft_refresh_token,
      email: data?.microsoft_email ?? null,
      connectedAt: data?.microsoft_connected_at ?? null,
      hasRefreshToken: !!data?.microsoft_refresh_token,
      hasMailScope: false as boolean,
      hasCalendarScope: false as boolean,
      hasTeamsScope: false as boolean,
      scopeCheckError: null as string | null,
    };
    if (!data?.microsoft_refresh_token) return base;
    try {
      const { refreshAccessToken, hasRequiredMicrosoftScopes } = await import("@/lib/microsoft.server");
      const tokens = await refreshAccessToken(data.microsoft_refresh_token);
      const scopes = hasRequiredMicrosoftScopes(tokens.scope, tokens.access_token);
      base.hasMailScope = scopes.hasMailScope;
      base.hasCalendarScope = scopes.hasCalendarScope;
      base.hasTeamsScope = scopes.hasTeamsScope;
    } catch (e: any) {
      base.scopeCheckError = e?.message ?? String(e);
    }
    return base;
  });

export const microsoftDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("profiles").update({
      microsoft_refresh_token: null, microsoft_email: null, microsoft_connected_at: null,
    }).eq("id", context.userId);
    return { ok: true };
  });
