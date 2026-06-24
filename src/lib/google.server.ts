// Server-only helpers for Google OAuth + Calendar + Gmail.
// Never import this from route files at module scope — load via dynamic import in handlers.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const CALENDAR_INSERT = (calId = "primary") =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?conferenceDataVersion=1&sendUpdates=all`;
const GMAIL_SEND = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

function clientCreds() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Google OAuth no está configurado.");
  return { id, secret };
}

export function googleOAuthClientDiagnostics() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  return {
    clientIdConfigured: !!id,
    clientSecretConfigured: !!secret,
    clientId: id ?? null,
  };
}

export async function verifyGoogleClientCredentials(redirectUri: string) {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!id || !secret) {
    return { ok: false, status: "missing_credentials" as const };
  }

  const body = new URLSearchParams({
    code: "lovable-oauth-diagnostic",
    client_id: id,
    client_secret: secret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (text.includes("invalid_grant")) return { ok: true, status: "credentials_accepted" as const };
  if (text.includes("redirect_uri_mismatch")) return { ok: false, status: "redirect_uri_mismatch" as const };
  if (text.includes("invalid_client") || res.status === 401) return { ok: false, status: "invalid_client" as const };
  return { ok: false, status: "unknown" as const };
}

export function googleAuthUrl(redirectUri: string, state: string) {
  const { id } = clientCreds();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const { id, secret } = clientCreds();
  const body = new URLSearchParams({
    code,
    client_id: id,
    client_secret: secret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google token exchange falló: ${await res.text()}`);
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
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google refresh falló: ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number; scope?: string };
}

export async function getTokenScopes(accessToken: string): Promise<string[]> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!res.ok) return [];
  const j = (await res.json()) as { scope?: string };
  return (j.scope || "").split(/\s+/).filter(Boolean);
}


export async function getUserInfo(accessToken: string) {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error("No se pudo obtener el email de Google");
  return (await res.json()) as { email: string };
}

export async function createCalendarEventWithMeet(params: {
  accessToken: string;
  summary: string;
  description: string;
  startISO: string;
  endISO: string;
  timezone: string;
  attendees: { email: string; name?: string }[];
}) {
  const body = {
    summary: params.summary,
    description: params.description,
    start: { dateTime: params.startISO, timeZone: params.timezone },
    end: { dateTime: params.endISO, timeZone: params.timezone },
    attendees: params.attendees.map(a => ({ email: a.email, displayName: a.name })),
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: { useDefault: true },
  };
  const res = await fetch(CALENDAR_INSERT("primary"), {
    method: "POST",
    headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Calendar insert falló: ${await res.text()}`);
  const ev = (await res.json()) as any;
  const meetLink: string | undefined =
    ev.hangoutLink ??
    ev.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri;
  return { eventId: ev.id as string, meetLink: meetLink ?? null, htmlLink: ev.htmlLink as string };
}

function b64url(s: string) {
  // Encode UTF-8 → base64url
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendGmail(params: {
  accessToken: string;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const subjectEnc = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`;
  const headers = [
    `From: "${params.fromName.replace(/"/g, "")}" <${params.fromEmail}>`,
    `To: ${params.to}`,
    params.replyTo ? `Reply-To: ${params.replyTo}` : "",
    `Subject: ${subjectEnc}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
  ].filter(Boolean).join("\r\n");
  const raw = b64url(`${headers}\r\n\r\n${params.html}`);
  const res = await fetch(GMAIL_SEND, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail send falló: ${await res.text()}`);
  return (await res.json()) as { id: string };
}
