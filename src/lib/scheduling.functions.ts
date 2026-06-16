import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STAGE_LABELS: Record<string, string> = {
  interview_1: "primera entrevista",
  interview_2: "segunda entrevista",
  interview_3: "entrevista final",
};

// ---------- Google connection ----------

const DEFAULT_APP_ORIGIN = "https://fluxtalent.lovable.app";
const GOOGLE_CALLBACK_PATH = "/api/public/google/callback";

function callbackUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}${GOOGLE_CALLBACK_PATH}`;
}

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
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
  } catch {
    return false;
  }
}

function safeReturnOrigin(inputOrigin: string) {
  const origin = normalizeOrigin(inputOrigin);
  return origin && isTrustedOrigin(origin) ? origin : configuredAppOrigin();
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function oauthCandidates(inputOrigin: string) {
  const returnOrigin = safeReturnOrigin(inputOrigin);
  const origins = unique([returnOrigin, configuredAppOrigin(), DEFAULT_APP_ORIGIN]);
  return { returnOrigin, callbackUris: origins.map(callbackUrl) };
}

type OAuthCheck = {
  callbackUri: string;
  ok: boolean;
  reason?: "redirect_uri_mismatch" | "verification_unavailable";
  statusCode?: number;
  detail?: string;
};

async function buildOAuthState(userId: string, callbackUri: string, returnOrigin: string) {
  const payload = JSON.stringify({ userId, callbackUri, returnOrigin, nonce: crypto.randomUUID(), ts: Date.now() });
  const sig = await hmac(payload, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return `${btoa(payload)}.${sig}`;
}

async function verifyGoogleAuthUrl(authUrl: string): Promise<Omit<OAuthCheck, "callbackUri">> {
  try {
    const res = await fetch(authUrl, { method: "GET", redirect: "manual" });
    const body = await res.text().catch(() => "");
    const location = res.headers.get("location") ?? "";
    const evidence = `${body} ${location}`;
    if (res.status === 400 && evidence.includes("redirect_uri_mismatch")) {
      return { ok: false, reason: "redirect_uri_mismatch", statusCode: res.status };
    }
    if (evidence.includes("redirect_uri_mismatch")) {
      return { ok: false, reason: "redirect_uri_mismatch", statusCode: res.status };
    }
    return { ok: true, statusCode: res.status };
  } catch (err) {
    return { ok: false, reason: "verification_unavailable", detail: err instanceof Error ? err.message : "No se pudo verificar Google OAuth" };
  }
}

async function resolveGoogleOAuth(userId: string, inputOrigin: string) {
  const { googleAuthUrl } = await import("@/lib/google.server");
  const { returnOrigin, callbackUris } = oauthCandidates(inputOrigin);
  const checks: OAuthCheck[] = [];

  for (const callbackUri of callbackUris) {
    const state = await buildOAuthState(userId, callbackUri, returnOrigin);
    const url = googleAuthUrl(callbackUri, state);
    const check = await verifyGoogleAuthUrl(url);
    checks.push({ callbackUri, ...check });

    if (check.ok || check.reason === "verification_unavailable") {
      return { ok: true as const, url, callbackUri, returnOrigin, requiredCallbackUris: callbackUris, checks, verified: check.ok };
    }
  }

  return {
    ok: false as const,
    error: "redirect_uri_mismatch",
    returnOrigin,
    requiredCallbackUris: callbackUris,
    checks,
  };
}

export const verifyGoogleOAuthConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { googleOAuthClientDiagnostics, verifyGoogleClientCredentials } = await import("@/lib/google.server");
    const result = await resolveGoogleOAuth(context.userId, data.origin);
    const firstCallback = oauthCandidates(data.origin).callbackUris[0];
    const credentials = firstCallback
      ? await verifyGoogleClientCredentials(firstCallback)
      : { ok: false, status: "unknown" as const };
    const diagnostics = googleOAuthClientDiagnostics();
    if (result.ok) {
      return {
        ok: true,
        callbackUri: result.callbackUri,
        returnOrigin: result.returnOrigin,
        requiredCallbackUris: result.requiredCallbackUris,
        checks: result.checks,
        verified: result.verified,
        credentials,
        diagnostics,
      };
    }
    return { ...result, credentials, diagnostics };
  });

export const googleStartUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    return resolveGoogleOAuth(context.userId, data.origin);
  });

async function hmac(payload: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyOAuthState(state: string): Promise<{ userId: string; callbackUri: string | null; returnOrigin: string | null } | null> {
  const [encoded, sig] = state.split(".");
  if (!encoded || !sig) return null;
  let payload: string;
  try { payload = atob(encoded); } catch { return null; }
  const expected = await hmac(payload, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  if (expected !== sig) return null;

  try {
    const parsed = JSON.parse(payload) as { userId?: string; callbackUri?: string; returnOrigin?: string; ts?: number };
    if (!parsed.userId || !parsed.ts || Date.now() - parsed.ts > 10 * 60_000) return null;
    const callbackUri = parsed.callbackUri && callbackUrl(new URL(parsed.callbackUri).origin) === parsed.callbackUri
      ? parsed.callbackUri
      : null;
    const returnOrigin = parsed.returnOrigin && isTrustedOrigin(parsed.returnOrigin) ? parsed.returnOrigin : null;
    return { userId: parsed.userId, callbackUri, returnOrigin };
  } catch {
    // Backward compatibility for links generated before the JSON state payload.
  }

  const [userId, , tsStr] = payload.split(".");
  const ts = Number(tsStr);
  if (!userId || !ts || Date.now() - ts > 10 * 60_000) return null;
  return { userId, callbackUri: null, returnOrigin: null };
}

export const googleDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("profiles").update({
      google_refresh_token: null, google_email: null, google_connected_at: null,
    }).eq("id", context.userId);
    return { ok: true };
  });

export const getGoogleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("profiles")
      .select("google_email, google_connected_at").eq("id", context.userId).maybeSingle();
    return {
      connected: !!data?.google_email,
      email: data?.google_email ?? null,
      connectedAt: data?.google_connected_at ?? null,
    };
  });

// ---------- Org branding ----------

export const saveOrgBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    consultancyName: z.string().max(120).optional().nullable(),
    contactEmail: z.string().email().max(255).optional().nullable().or(z.literal("").transform(() => null)),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    logoUrl: z.string().url().max(500).optional().nullable().or(z.literal("").transform(() => null)),
    signatureHtml: z.string().max(2000).optional().nullable(),
    timezone: z.string().max(60).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("profiles").select("org_id").eq("id", context.userId).maybeSingle();
    if (!p?.org_id) throw new Error("Organización no encontrada");
    const patch: Record<string, unknown> = {};
    if (data.consultancyName !== undefined) patch.consultancy_name = data.consultancyName;
    if (data.contactEmail !== undefined) patch.contact_email = data.contactEmail;
    if (data.brandColor !== undefined) patch.brand_color = data.brandColor;
    if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl;
    if (data.signatureHtml !== undefined) patch.signature_html = data.signatureHtml;
    if (data.timezone !== undefined) patch.timezone = data.timezone;
    const { error } = await context.supabase.from("organizations").update(patch as never).eq("id", p.org_id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Vacancy scheduling config & availability ----------

export const getVacancyScheduling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ vacancyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: cfg } = await context.supabase.from("vacancy_scheduling")
      .select("*").eq("vacancy_id", data.vacancyId).maybeSingle();
    const { data: rules } = await context.supabase.from("availability_rules")
      .select("*").eq("vacancy_id", data.vacancyId).order("weekday").order("start_time");
    const { data: slots } = await context.supabase.from("availability_slots")
      .select("*").eq("vacancy_id", data.vacancyId)
      .gte("start_at", new Date().toISOString())
      .order("start_at").limit(500);
    return { config: cfg, rules: rules ?? [], slots: slots ?? [] };
  });

export const saveVacancyScheduling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    vacancyId: z.string().uuid(),
    durationMinutes: z.number().int().min(15).max(240),
    instructions: z.string().max(2000).optional().nullable(),
    enabled: z.boolean().default(true),
    rules: z.array(z.object({
      weekday: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    })).max(50),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: vac } = await context.supabase.from("vacancies")
      .select("id, org_id, created_by").eq("id", data.vacancyId).maybeSingle();
    if (!vac) throw new Error("Vacante no encontrada");
    const orgId = vac.org_id;

    await context.supabase.from("vacancy_scheduling").upsert({
      vacancy_id: data.vacancyId,
      org_id: orgId,
      recruiter_id: vac.created_by ?? context.userId,
      duration_minutes: data.durationMinutes,
      instructions: data.instructions ?? null,
      enabled: data.enabled,
    });

    await context.supabase.from("availability_rules").delete().eq("vacancy_id", data.vacancyId);
    if (data.rules.length) {
      await context.supabase.from("availability_rules").insert(
        data.rules.map(r => ({
          vacancy_id: data.vacancyId,
          org_id: orgId,
          weekday: r.weekday,
          start_time: r.startTime,
          end_time: r.endTime,
        }))
      );
    }
    return { ok: true };
  });

export const regenerateSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    vacancyId: z.string().uuid(),
    days: z.number().int().min(7).max(60).default(30),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: cfg } = await context.supabase.from("vacancy_scheduling")
      .select("duration_minutes, org_id").eq("vacancy_id", data.vacancyId).maybeSingle();
    if (!cfg) throw new Error("Configurá primero la duración del slot.");
    const { data: rules } = await context.supabase.from("availability_rules")
      .select("*").eq("vacancy_id", data.vacancyId);
    if (!rules?.length) return { created: 0 };
    const { data: org } = await context.supabase.from("organizations")
      .select("timezone").eq("id", cfg.org_id).maybeSingle();
    const tz = org?.timezone || "America/Argentina/Buenos_Aires";

    const duration = cfg.duration_minutes;
    const inserts: { vacancy_id: string; org_id: string; start_at: string; end_at: string; source: string }[] = [];
    const now = new Date();
    for (let d = 0; d < data.days; d++) {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() + d);
      // Determine weekday in target timezone
      const wd = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(day));
      const isoWeekdayStr = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(day);
      const weekdayMap: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
      const weekday = weekdayMap[isoWeekdayStr] ?? wd;
      const ymd = new Intl.DateTimeFormat("sv-SE", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
      for (const r of rules.filter(x => x.weekday === weekday)) {
        const startLocal = `${ymd}T${r.start_time}`;
        const endLocal = `${ymd}T${r.end_time}`;
        const startUtcBase = zonedToUtc(startLocal, tz);
        const endUtc = zonedToUtc(endLocal, tz);
        let cursor = startUtcBase.getTime();
        while (cursor + duration * 60_000 <= endUtc.getTime()) {
          const s = new Date(cursor);
          const e = new Date(cursor + duration * 60_000);
          if (s.getTime() > Date.now() + 3600_000) {
            inserts.push({
              vacancy_id: data.vacancyId,
              org_id: cfg.org_id,
              start_at: s.toISOString(),
              end_at: e.toISOString(),
              source: "rule",
            });
          }
          cursor += duration * 60_000;
        }
      }
    }
    if (!inserts.length) return { created: 0 };
    // ON CONFLICT (vacancy_id, start_at) DO NOTHING via upsert with ignoreDuplicates
    const { error, count } = await context.supabase.from("availability_slots")
      .upsert(inserts, { onConflict: "vacancy_id,start_at", ignoreDuplicates: true, count: "exact" });
    if (error) throw error;
    return { created: count ?? inserts.length };
  });

// Convert "YYYY-MM-DDTHH:mm" interpreted in given IANA tz → UTC Date
function zonedToUtc(localISO: string, timeZone: string): Date {
  // Compute UTC offset for that wall-clock instant in given tz.
  const [date, time] = localISO.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Get the offset in minutes between local-as-tz vs UTC.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(asUtc));
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offset = local - asUtc; // ms tz ahead of UTC
  return new Date(asUtc - offset);
}

export const setSlotStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    slotId: z.string().uuid(),
    status: z.enum(["open", "blocked"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("availability_slots")
      .update({ status: data.status }).eq("id", data.slotId).neq("status", "booked");
    if (error) throw error;
    return { ok: true };
  });

export const addManualSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    vacancyId: z.string().uuid(),
    startISO: z.string(),
    durationMinutes: z.number().int().min(15).max(240),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: vac } = await context.supabase.from("vacancies")
      .select("org_id").eq("id", data.vacancyId).maybeSingle();
    if (!vac) throw new Error("Vacante no encontrada");
    const start = new Date(data.startISO);
    const end = new Date(start.getTime() + data.durationMinutes * 60_000);
    const { error } = await context.supabase.from("availability_slots").insert({
      vacancy_id: data.vacancyId, org_id: vac.org_id,
      start_at: start.toISOString(), end_at: end.toISOString(),
      source: "manual", status: "open",
    });
    if (error) throw error;
    return { ok: true };
  });

// ---------- Trigger interview invite ----------

export async function inviteForInterview(
  supabase: any,
  userId: string,
  applicationId: string,
  stage: "interview_1" | "interview_2" | "interview_3",
) {
  const { data: app } = await supabase.from("applications")
    .select("id, first_name, last_name, email, vacancy_id")
    .eq("id", applicationId).maybeSingle();
  if (!app) throw new Error("Postulante no encontrado");
  const { data: vac } = await supabase.from("vacancies")
    .select("id, title, org_id").eq("id", app.vacancy_id).maybeSingle();
  if (!vac) throw new Error("Vacante no encontrada");
  const { data: org } = await supabase.from("organizations")
    .select("name, consultancy_name, contact_email, brand_color, logo_url, signature_html, timezone")
    .eq("id", vac.org_id).maybeSingle();
  if (!org) throw new Error("Organización no encontrada");
  const { data: cfg } = await supabase.from("vacancy_scheduling")
    .select("recruiter_id, enabled").eq("vacancy_id", vac.id).maybeSingle();
  if (!cfg || !cfg.enabled) throw new Error("Configurá las entrevistas para esta vacante antes de invitar.");
  const recruiterId = cfg.recruiter_id ?? userId;
  const { data: recruiter } = await supabase.from("profiles")
    .select("google_refresh_token, google_email, display_name")
    .eq("id", recruiterId).maybeSingle();
  if (!recruiter?.google_refresh_token || !recruiter.google_email) {
    throw new Error("El reclutador debe conectar su Google Calendar antes de invitar.");
  }

  const { data: existing } = await supabase.from("interview_bookings")
    .select("id, booking_token, status").eq("application_id", app.id).eq("stage", stage).maybeSingle();
  let booking = existing;
  if (!booking) {
    const { data: created, error } = await supabase.from("interview_bookings").insert({
      application_id: app.id,
      vacancy_id: vac.id,
      org_id: vac.org_id,
      stage,
      recruiter_id: recruiterId,
    }).select("id, booking_token, status").single();
    if (error) throw error;
    booking = created;
  } else if (booking.status === "scheduled") {
    return { ok: true, bookingToken: booking.booking_token, skipped: "already_scheduled" };
  }

  const origin = process.env.PUBLIC_APP_URL || "https://fluxtalent.lovable.app";
  const scheduleUrl = `${origin}/schedule/${booking.booking_token}`;

  const { refreshAccessToken, sendGmail } = await import("@/lib/google.server");
  const { interviewInviteHtml } = await import("@/lib/email-templates");
  const { access_token } = await refreshAccessToken(recruiter.google_refresh_token);
  const brand = {
    consultancyName: org.consultancy_name || org.name,
    contactEmail: org.contact_email,
    brandColor: org.brand_color || "#0F766E",
    logoUrl: org.logo_url,
    signatureHtml: org.signature_html,
  };
  const stageLabel = STAGE_LABELS[stage];
  const html = interviewInviteHtml({
    ...brand,
    firstName: app.first_name || "",
    vacancyTitle: vac.title,
    scheduleUrl,
    stageLabel,
  });
  await sendGmail({
    accessToken: access_token,
    fromName: brand.consultancyName,
    fromEmail: recruiter.google_email,
    to: app.email,
    subject: `Coordinemos tu ${stageLabel} — ${vac.title}`,
    html,
    replyTo: brand.contactEmail || undefined,
  });

  await supabase.from("application_events").insert({
    application_id: app.id,
    actor_id: userId,
    type: "interview_invite_sent",
    payload: { stage, booking_id: booking.id },
  });

  return { ok: true, bookingToken: booking.booking_token };
}

export const sendInterviewInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    applicationId: z.string().uuid(),
    stage: z.enum(["interview_1", "interview_2", "interview_3"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    return await inviteForInterview(context.supabase, context.userId, data.applicationId, data.stage);
  });

