import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/microsoft/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        if (error || !code || !state) {
          throw redirect({ to: "/app/integrations", search: { error: error || "missing_code" } as any });
        }
        const { verifyMicrosoftOAuthState } = await import("@/lib/microsoft.functions");
        const verified = await verifyMicrosoftOAuthState(state);
        if (!verified) {
          throw redirect({ to: "/app/integrations", search: { error: "invalid_state" } as any });
        }

        const { exchangeCodeForTokens, getUserInfo } = await import("@/lib/microsoft.server");
        const callbackUri = verified.callbackUri ?? `${process.env.PUBLIC_APP_URL || "https://fluxtalent.lovable.app"}/api/public/microsoft/callback`;
        const returnOrigin = verified.returnOrigin ?? "";
        const integrationsPath = returnOrigin ? `${returnOrigin}/app/integrations` : "/app/integrations";
        let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
        try {
          tokens = await exchangeCodeForTokens(code, callbackUri);
        } catch (e: any) {
          const msg = e?.message ?? String(e);
          console.error("[microsoft.callback] token exchange failed", msg);
          const reason = /AADSTS7000215|invalid_client|client secret/i.test(msg)
            ? "invalid_microsoft_secret"
            : "microsoft_token_exchange_failed";
          throw redirect({ href: `${integrationsPath}?error=${reason}` });
        }
        if (!tokens.refresh_token) {
          throw redirect({ href: `${integrationsPath}?error=no_refresh` });
        }

        let info: Awaited<ReturnType<typeof getUserInfo>>;
        try {
          info = await getUserInfo(tokens.access_token);
        } catch (e: any) {
          console.error("[microsoft.callback] profile lookup failed", e?.message ?? String(e));
          throw redirect({ href: `${integrationsPath}?error=microsoft_profile_failed` });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: updErr } = await supabaseAdmin.from("profiles").update({
          microsoft_refresh_token: tokens.refresh_token,
          microsoft_email: info.email,
          microsoft_connected_at: new Date().toISOString(),
          google_refresh_token: null,
          google_email: null,
          google_connected_at: null,
        }).eq("id", verified.userId);
        if (updErr) {
          throw redirect({ href: `${integrationsPath}?error=store_failed` });
        }
        throw redirect({ href: `${integrationsPath}?ok_ms=1` });
      },
    },
  },
});
