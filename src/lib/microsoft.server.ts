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
    prompt: "consent",
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
  if (!res.ok) throw new Error(`Microsoft refresh falló: ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number; scope?: string; refresh_token?: string };
}

export async function getUserInfo(accessToken: string) {
  const res = await fetch(GRAPH_ME, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error("No se pudo obtener el perfil de Microsoft");
  const j = (await res.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
  return { email: j.mail || j.userPrincipalName || "", displayName: j.displayName ?? null };
}

/** Create an Outlook Calendar event with a Teams meeting link and send invites. */
export async function createOutlookEventWithTeams(params: {
  accessToken: string;
  subject: string;
  bodyHtml: string;
  startISO: string;
  endISO: string;
  timezone: string;
  attendees: { email: string; name?: string }[];
}) {
  const body = {
    subject: params.subject,
    body: { contentType: "HTML", content: params.bodyHtml },
    start: { dateTime: params.startISO, timeZone: params.timezone },
    end: { dateTime: params.endISO, timeZone: params.timezone },
    attendees: params.attendees.map(a => ({
      emailAddress: { address: a.email, name: a.name ?? a.email },
      type: "required",
    })),
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
  };
  const res = await fetch(GRAPH_CREATE_EVENT, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Outlook event insert falló: ${await res.text()}`);
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
  if (!res.ok && res.status !== 202) throw new Error(`Outlook sendMail falló: ${await res.text()}`);
  return { ok: true };
}
