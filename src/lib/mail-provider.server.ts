// Unified email + calendar provider selector.
// Picks Microsoft if the recruiter connected it more recently than Google (o solo tiene Microsoft),
// si no usa Google. Mismo comportamiento que el ecosistema Google anterior.
// Server-only. Cargar dinámicamente desde handlers.

export type ProviderProfile = {
  id?: string | null;
  google_refresh_token?: string | null;
  google_email?: string | null;
  google_connected_at?: string | null;
  microsoft_refresh_token?: string | null;
  microsoft_email?: string | null;
  microsoft_connected_at?: string | null;
  display_name?: string | null;
};

export type Provider = "google" | "microsoft";

export function pickProvider(p: ProviderProfile): Provider | null {
  const hasG = !!p.google_refresh_token && !!p.google_email;
  const hasM = !!p.microsoft_refresh_token && !!p.microsoft_email;
  if (hasG && hasM) {
    const g = p.google_connected_at ? Date.parse(p.google_connected_at) : 0;
    const m = p.microsoft_connected_at ? Date.parse(p.microsoft_connected_at) : 0;
    return m >= g ? "microsoft" : "google";
  }
  if (hasM) return "microsoft";
  if (hasG) return "google";
  return null;
}

export function providerEmail(p: ProviderProfile, provider: Provider): string {
  return (provider === "microsoft" ? p.microsoft_email : p.google_email) as string;
}

/** Return a fresh access token from the provider's refresh token. */
export async function providerAccessToken(p: ProviderProfile, provider: Provider): Promise<string> {
  if (provider === "microsoft") {
    const { refreshAccessToken } = await import("@/lib/microsoft.server");
    const { access_token, refresh_token } = await refreshAccessToken(p.microsoft_refresh_token!);
    if (refresh_token && refresh_token !== p.microsoft_refresh_token && p.id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("profiles").update({ microsoft_refresh_token: refresh_token }).eq("id", p.id);
    }
    return access_token;
  }
  const { refreshAccessToken } = await import("@/lib/google.server");
  const { access_token } = await refreshAccessToken(p.google_refresh_token!);
  return access_token;
}

/** Send an HTML email as the connected user, through their provider. */
export async function sendUserMail(params: {
  profile: ProviderProfile;
  provider: Provider;
  accessToken: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  if (params.provider === "microsoft") {
    const { sendOutlookMail } = await import("@/lib/microsoft.server");
    return sendOutlookMail({
      accessToken: params.accessToken,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
    });
  }
  const { sendGmail } = await import("@/lib/google.server");
  return sendGmail({
    accessToken: params.accessToken,
    fromName: params.fromName,
    fromEmail: providerEmail(params.profile, "google"),
    to: params.to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
  });
}

/** Create a calendar event with an online meeting (Google Meet or Teams). */
export async function createUserMeetingEvent(params: {
  provider: Provider;
  accessToken: string;
  summary: string;
  descriptionHtml: string;
  descriptionText: string;
  startISO: string;
  endISO: string;
  timezone: string;
  attendees: { email: string; name?: string }[];
}): Promise<{ eventId: string; meetingLink: string | null; webLink: string | null; kind: "meet" | "teams" }> {
  if (params.provider === "microsoft") {
    const { createOutlookEventWithTeams } = await import("@/lib/microsoft.server");
    const ev = await createOutlookEventWithTeams({
      accessToken: params.accessToken,
      subject: params.summary,
      bodyHtml: params.descriptionHtml,
      startISO: params.startISO,
      endISO: params.endISO,
      timezone: params.timezone,
      attendees: params.attendees,
    });
    return { eventId: ev.eventId, meetingLink: ev.joinUrl, webLink: ev.webLink, kind: "teams" };
  }
  const { createCalendarEventWithMeet } = await import("@/lib/google.server");
  const ev = await createCalendarEventWithMeet({
    accessToken: params.accessToken,
    summary: params.summary,
    description: params.descriptionText,
    startISO: params.startISO,
    endISO: params.endISO,
    timezone: params.timezone,
    attendees: params.attendees,
  });
  return { eventId: ev.eventId, meetingLink: ev.meetLink, webLink: ev.htmlLink, kind: "meet" };
}
