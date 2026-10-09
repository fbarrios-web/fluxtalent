import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { DEMO_ORGANIZER_EMAIL, DEMO_TIMEZONE } from "@/lib/demo-scheduling.config";

const ruleSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  effectiveUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const blockedPeriodSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().trim().max(300).optional().default(""),
}).refine(value => new Date(value.endsAt) > new Date(value.startsAt), {
  message: "La finalización del bloqueo debe ser posterior al inicio.",
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw error;
  if (!data) throw new Error("Acción solo permitida para superadministradores.");
}

export const getDemoScheduling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: config }, { data: rules }, { data: blockedPeriods }, { data: slots }, { data: bookings }] = await Promise.all([
      supabaseAdmin.from("demo_scheduling_config").select("*").eq("id", true).maybeSingle(),
      supabaseAdmin.from("demo_availability_rules").select("*").order("weekday").order("start_time"),
      supabaseAdmin.from("demo_blocked_periods").select("*").gte("ends_at", new Date().toISOString()).order("starts_at"),
      supabaseAdmin.from("demo_slots").select("*").gte("start_at", new Date().toISOString()).order("start_at").limit(500),
      supabaseAdmin.from("demo_bookings").select("id, slot_id, first_name, last_name, email, phone, status, meet_link, created_at, demo_slots(start_at, end_at)").order("created_at", { ascending: false }).limit(100),
    ]);
    return { config, rules: rules ?? [], blockedPeriods: blockedPeriods ?? [], slots: slots ?? [], bookings: bookings ?? [] };
  });

export const saveDemoScheduling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    durationMinutes: z.number().int().min(15).max(240),
    enabled: z.boolean(),
    rules: z.array(ruleSchema).max(50),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: organizer } = await supabaseAdmin.from("profiles")
      .select("id")
      .eq("google_email", DEMO_ORGANIZER_EMAIL)
      .not("google_refresh_token", "is", null)
      .order("google_connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!organizer?.id) throw new Error("La cuenta Google de Florencia debe estar conectada.");

    const { error: configError } = await supabaseAdmin.from("demo_scheduling_config").upsert({
      id: true,
      organizer_id: organizer.id,
      duration_minutes: data.durationMinutes,
      timezone: DEMO_TIMEZONE,
      enabled: data.enabled,
      updated_at: new Date().toISOString(),
    });
    if (configError) throw configError;

    await supabaseAdmin.from("demo_availability_rules").delete().not("id", "is", null);
    const expandedRules = data.rules.flatMap(rule => rule.weekdays.map(weekday => ({
      weekday,
      start_time: rule.startTime,
      end_time: rule.endTime,
      effective_from: rule.effectiveFrom || null,
      effective_until: rule.effectiveUntil || null,
    })));
    if (expandedRules.length) {
      const { error } = await supabaseAdmin.from("demo_availability_rules").insert(expandedRules);
      if (error) throw error;
    }

    const { data: blockedPeriods } = await supabaseAdmin.from("demo_blocked_periods")
      .select("starts_at, ends_at")
      .gte("ends_at", new Date().toISOString());
    const { expandRulesToSlots, excludeBlockedSlots } = await import("@/lib/scheduling-overlap.server");
    const generated = excludeBlockedSlots(
      expandRulesToSlots(data.rules, data.durationMinutes, DEMO_TIMEZONE, 60),
      (blockedPeriods ?? []).map(period => ({ startsAt: period.starts_at, endsAt: period.ends_at })),
    );
    await supabaseAdmin.from("demo_slots").delete().eq("source", "rule").eq("status", "open").gt("start_at", new Date().toISOString());
    if (generated.length) {
      const { error } = await supabaseAdmin.from("demo_slots").upsert(
        generated.map(slot => ({ start_at: slot.start, end_at: slot.end, source: "rule", status: "open" })),
        { onConflict: "start_at,end_at", ignoreDuplicates: true },
      );
      if (error) throw error;
    }
    return { ok: true, generated: generated.length };
  });

export const createDemoBlockedPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => blockedPeriodSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conflictingBookings, error: conflictError } = await supabaseAdmin
      .from("demo_bookings")
      .select("id, demo_slots!inner(start_at, end_at)")
      .in("status", ["reserved", "confirmed"])
      .lt("demo_slots.start_at", data.endsAt)
      .gt("demo_slots.end_at", data.startsAt);
    if (conflictError) throw conflictError;

    const { data: blockedPeriod, error } = await supabaseAdmin.from("demo_blocked_periods").insert({
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      reason: data.reason || null,
      created_by: context.userId,
    }).select("*").single();
    if (error) throw error;
    return { blockedPeriod, conflictingBookings: conflictingBookings?.length ?? 0 };
  });

export const createDemoBlockedPeriods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    periods: z.array(z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime() })
      .refine(v => new Date(v.endsAt) > new Date(v.startsAt), { message: "La hora final debe ser posterior a la inicial." })).min(1).max(400),
    reason: z.string().trim().max(300).optional().default(""),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("demo_blocked_periods").insert(data.periods.map(p => ({
      starts_at: p.startsAt, ends_at: p.endsAt, reason: data.reason || null, created_by: context.userId,
    })));
    if (error) throw error;
    return { created: data.periods.length };
  });

export const deleteDemoBlockedPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("demo_blocked_periods").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
async function organizerToken(supabaseAdmin: any) {
  const { data: config } = await supabaseAdmin.from("demo_scheduling_config").select("organizer_id, timezone").eq("id", true).maybeSingle();
  const { data: organizer } = await supabaseAdmin.from("profiles")
    .select("id, google_refresh_token, google_email, google_connected_at")
    .eq("id", config?.organizer_id).maybeSingle();
  if (!organizer?.google_refresh_token) throw new Error("La cuenta Google organizadora no está conectada.");
  const { refreshAccessToken } = await import("@/lib/google.server");
  const { access_token } = await refreshAccessToken(organizer.google_refresh_token);
  return { accessToken: access_token as string, timezone: (config?.timezone ?? DEMO_TIMEZONE) as string };
}

const fmtWhen = (iso: string, tz: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short", timeZone: tz }).format(new Date(iso));

async function loadActiveBooking(supabaseAdmin: any, id: string) {
  const { data: booking, error } = await supabaseAdmin.from("demo_bookings")
    .select("id, slot_id, first_name, email, status, google_event_id, meet_link, demo_slots(start_at, end_at)")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  if (!booking || !["reserved", "confirmed"].includes(booking.status)) throw new Error("La reunión ya no está activa.");
  return booking;
}

export const cancelDemoBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const booking = await loadActiveBooking(supabaseAdmin, data.bookingId);
    const { accessToken, timezone } = await organizerToken(supabaseAdmin);
    if (booking.google_event_id) {
      const { cancelCalendarEvent } = await import("@/lib/google.server");
      await cancelCalendarEvent({ accessToken, eventId: booking.google_event_id });
    }
    await supabaseAdmin.from("demo_bookings").update({ status: "canceled" }).eq("id", booking.id);
    await supabaseAdmin.from("demo_slots").update({ status: "open" }).eq("id", booking.slot_id).gt("start_at", new Date().toISOString());
    const { dispatchTransactionalEmail } = await import("@/lib/email/dispatch.server");
    const mail = await dispatchTransactionalEmail({
      templateName: "demo-update", recipientEmail: booking.email, idempotencyKey: `demo-cancel:${booking.id}`,
      templateData: { kind: "canceled", firstName: booking.first_name, previousLabel: booking.demo_slots?.start_at ? fmtWhen(booking.demo_slots.start_at, timezone) : "" },
    });
    return { ok: true, emailSent: mail.ok };
  });

export const rescheduleDemoBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid(), slotId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const booking = await loadActiveBooking(supabaseAdmin, data.bookingId);
    const { data: claimed, error: claimError } = await supabaseAdmin.from("demo_slots")
      .update({ status: "booked" }).eq("id", data.slotId).eq("status", "open").gt("start_at", new Date().toISOString())
      .select("id, start_at, end_at").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) throw new Error("Ese horario ya no está disponible.");
    try {
      const { accessToken, timezone } = await organizerToken(supabaseAdmin);
      if (booking.google_event_id) {
        const { rescheduleCalendarEvent } = await import("@/lib/google.server");
        await rescheduleCalendarEvent({ accessToken, eventId: booking.google_event_id, startISO: claimed.start_at, endISO: claimed.end_at, timezone });
      }
      await supabaseAdmin.from("demo_bookings").update({ slot_id: claimed.id }).eq("id", booking.id);
      await supabaseAdmin.from("demo_slots").update({ status: "open" }).eq("id", booking.slot_id).gt("start_at", new Date().toISOString());
      const { dispatchTransactionalEmail } = await import("@/lib/email/dispatch.server");
      const mail = await dispatchTransactionalEmail({
        templateName: "demo-update", recipientEmail: booking.email, idempotencyKey: `demo-reschedule:${booking.id}:${claimed.id}`,
        templateData: {
          kind: "rescheduled", firstName: booking.first_name, meetLink: booking.meet_link ?? "",
          whenLabel: fmtWhen(claimed.start_at, timezone),
          previousLabel: booking.demo_slots?.start_at ? fmtWhen(booking.demo_slots.start_at, timezone) : "",
        },
      });
      return { ok: true, emailSent: mail.ok };
    } catch (error) {
      await supabaseAdmin.from("demo_slots").update({ status: "open" }).eq("id", claimed.id);
      throw error;
    }
  });
