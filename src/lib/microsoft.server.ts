// Server-only helpers for Microsoft OAuth (Entra ID) + Graph (Outlook Mail + Calendar + Teams).
// Never import this from route files at module scope — load via dynamic import in handlers.

const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const GRAPH_ME = "https://graph.microsoft.com/v1.0/me";
const GRAPH_SENDMAIL = "https://graph.microsoft.com/v1.0/me/sendMail";
const GRAPH_CREATE_EVENT = "https://graph.microsoft.com/v1.0/me/events";

// Delegated Graph permissions. offline_access → refresh_token; OnlineMeetings for Teams links.
export const MICROSOFT_SCOPES = [
  "openid",
  "email",
  "profile",
  "offline_access",
  "User.Read",
  "Mail.Send",
  "Calendars.ReadWrite",
  "OnlineMeetings.ReadWrite",
].join(" ");

const MICROSOFT_SCOPE_SET = new Set(MICROSOFT_SCOPES.split(/\s+/).filter(Boolean));

const IANA_TO_WINDOWS_TZ: Record<string, string> = {
  "America/Argentina/Buenos_Aires": "Argentina Standard Time",
  "America/Argentina/Cordoba": "Argentina Standard Time",
  "America/Argentina/Mendoza": "Argentina Standard Time",
  "America/Argentina/Rosario": "Argentina Standard Time",
  "America/Montevideo": "Montevideo Standard Time",
  "America/Santiago": "Pacific SA Standard Time",
  "America/Lima": "SA Pacific Standard Time",
  "America/Bogota": "SA Pacific Standard Time",
  "America/Mexico_City": "Central Standard Time (Mexico)",
  "America/New_York": "Eastern Standard Time",
  "America/Los_Angeles": "Pacific Standard Time",
  "Europe/Madrid": "Romance Standard Time",
  UTC: "UTC",
};

export function microsoftTimeZone(timezone: string | null | undefined) {
  if (!timezone) return "Argentina Standard Time";
  return IANA_TO_WINDOWS_TZ[timezone] ?? timezone;
}

function graphDateTime(iso: string, timezone: string | null | undefined) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.replace(/Z$/, "");
  const iana = timezone && IANA_TO_WINDOWS_TZ[timezone] ? timezone : timezone || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  } catch {
    return iso.replace(/\.\d{3}Z$/, "").replace(/Z$/, "");
  }
}

export function getMicrosoftTokenScopes(scope?: string | null): string[] {
  return (scope || "").split(/\s+/).filter(Boolean);
}

function tokenPayload(accessToken?: string | null): Record<string, unknown> | null {
  if (!accessToken) return null;
  const [, payload] = accessToken.split(".");
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getMicrosoftGrantedScopes(scope?: string | null, accessToken?: string | null): string[] {
  const payload = tokenPayload(accessToken);
  const jwtScope = typeof payload?.scp === "string" ? payload.scp : "";
  return getMicrosoftTokenScopes([scope, jwtScope].filter(Boolean).join(" "));
}

export function hasRequiredMicrosoftScopes(scope?: string | null, accessToken?: string | null) {
  const granted = new Set(getMicrosoftGrantedScopes(scope, accessToken).map(s => s.toLowerCase()));
  const has = (value: string) => granted.has(value.toLowerCase());
  return {
    hasMailScope: has("Mail.Send"),
    hasCalendarScope: has("Calendars.ReadWrite"),
    hasTeamsScope: has("OnlineMeetings.ReadWrite"),
    hasOfflineAccess: has("offline_access") || MICROSOFT_SCOPE_SET.has("offline_access"),
  };
}

function clientCreds() {
  const id = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const secret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Microsoft OAuth no está configurado.");
  return { id, secret };
}

export function microsoftOAuthClientDiagnostics() {
  const id = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const secret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  return {
    clientIdConfigured: !!id,
    clientSecretConfigured: !!secret,
    clientId: id ?? null,
  };
}

export function microsoftAuthUrl(redirectUri: string, state: string) {
  const { id } = clientCreds();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: MICROSOFT_SCOPES,
    response_mode: "query",
    prompt: "select_account",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const { id, secret } = clientCreds();
  const body = new URLSearchParams({
    code,
    client_id: id,
    client_secret: secret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: MICROSOFT_SCOPES,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Microsoft token exchange falló: ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const { id, secret } = clientCreds();
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: MICROSOFT_SCOPES,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Microsoft refresh falló [${res.status}]: ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number; scope?: string; refresh_token?: string };
}

export async function getUserInfo(accessToken: string) {
  const res = await fetch(GRAPH_ME, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error("No se pudo obtener el perfil de Microsoft");
  const j = (await res.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
  return { email: j.mail || j.userPrincipalName || "", displayName: j.displayName ?? null };
}

/** Create an Outlook Calendar event with a Teams meeting link and send invites.
 *  Falls back to a plain calendar event (no online meeting) when the account
 *  can't provision Teams (personal MSA accounts, tenants without Teams). */
export async function createOutlookEventWithTeams(params: {
  accessToken: string;
  subject: string;
  bodyHtml: string;
  startISO: string;
  endISO: string;
  timezone: string;
  attendees: { email: string; name?: string }[];
}) {
  const timeZone = microsoftTimeZone(params.timezone);
  const baseBody = {
    subject: params.subject,
    body: { contentType: "HTML", content: params.bodyHtml },
    start: { dateTime: graphDateTime(params.startISO, params.timezone), timeZone },
    end: { dateTime: graphDateTime(params.endISO, params.timezone), timeZone },
    attendees: params.attendees.map(a => ({
      emailAddress: { address: a.email, name: a.name ?? a.email },
      type: "required",
    })),
  };
  async function post(body: unknown) {
    return fetch(GRAPH_CREATE_EVENT, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  let res = await post({ ...baseBody, isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" });
  if (!res.ok) {
    const errText = await res.text();
    if (/teamsForBusiness|OnlineMeeting|not supported|does not have a valid license|ErrorInvalidRequest|UnableToCreateOnlineMeeting|consumer/i.test(errText)) {
      console.warn("[microsoft] teamsForBusiness falló, reintentando con teamsForConsumer:", errText);
      res = await post({ ...baseBody, isOnlineMeeting: true, onlineMeetingProvider: "teamsForConsumer" });
      if (!res.ok) {
        const err2 = await res.text();
        console.warn("[microsoft] teamsForConsumer falló, reintentando sin proveedor específico:", err2);
        res = await post({ ...baseBody, isOnlineMeeting: true });
        if (!res.ok) {
          const err3 = await res.text();
          console.warn("[microsoft] isOnlineMeeting sin proveedor falló, creando evento plano:", err3);
          res = await post(baseBody);
          if (!res.ok) throw new Error(`Outlook event insert falló [${res.status}]: ${await res.text()}`);
        }
      }
    } else {
      throw new Error(`Outlook event insert falló [${res.status}]: ${errText}`);
    }
  }
  const ev = (await res.json()) as any;
  return {
    eventId: ev.id as string,
    joinUrl: (ev.onlineMeeting?.joinUrl as string | undefined) ?? null,
    webLink: ev.webLink as string,
  };
}

/** Send an HTML email through the connected user's Outlook mailbox. */
export async function sendOutlookMail(params: {
  accessToken: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const body = {
    message: {
      subject: params.subject,
      body: { contentType: "HTML", content: params.html },
      toRecipients: [{ emailAddress: { address: params.to } }],
      ...(params.replyTo ? { replyTo: [{ emailAddress: { address: params.replyTo } }] } : {}),
    },
    saveToSentItems: true,
  };
  const res = await fetch(GRAPH_SENDMAIL, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 202) throw new Error(`Outlook sendMail falló [${res.status}]: ${await res.text()}`);
  return { ok: true };
}
