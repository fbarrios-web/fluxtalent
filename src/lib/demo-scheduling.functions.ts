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
    const [{ data: config }, { data: rules }, { data: slots }, { data: bookings }] = await Promise.all([
      supabaseAdmin.from("demo_scheduling_config").select("*").eq("id", true).maybeSingle(),
      supabaseAdmin.from("demo_availability_rules").select("*").order("weekday").order("start_time"),
      supabaseAdmin.from("demo_slots").select("*").gte("start_at", new Date().toISOString()).order("start_at").limit(500),
      supabaseAdmin.from("demo_bookings").select("id, slot_id, first_name, last_name, email, phone, status, meet_link, created_at, demo_slots(start_at, end_at)").order("created_at", { ascending: false }).limit(100),
    ]);
    return { config, rules: rules ?? [], slots: slots ?? [], bookings: bookings ?? [] };
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

    const { expandRulesToSlots } = await import("@/lib/scheduling-overlap.server");
    const generated = expandRulesToSlots(data.rules, data.durationMinutes, DEMO_TIMEZONE, 60);
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