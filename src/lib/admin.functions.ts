import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw error;
  if (!data) throw new Error("Forbidden: admin only");
}

export const adminAmI = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: !!data };
  });

export const adminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin;

    const [{ count: orgs }, { count: users }, { count: vacancies }, { count: applications }, { data: orgsByStatus }, { data: payments30 }, { data: signups14 }, { data: events7 }] = await Promise.all([
      sb.from("organizations").select("*", { count: "exact", head: true }),
      sb.from("profiles").select("*", { count: "exact", head: true }),
      sb.from("vacancies").select("*", { count: "exact", head: true }),
      sb.from("applications").select("*", { count: "exact", head: true }),
      sb.from("organizations").select("subscription_status"),
      sb.from("payments").select("amount_ars, paid_at, created_at").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
      sb.from("organizations").select("created_at").gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString()),
      sb.from("activity_events").select("event_type, created_at").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    ]);

    const byStatus = (orgsByStatus ?? []).reduce<Record<string, number>>((acc, r: any) => {
      acc[r.subscription_status] = (acc[r.subscription_status] ?? 0) + 1;
      return acc;
    }, {});
    const mrr = Object.entries(byStatus).reduce((sum, [k, v]) => (k === "active" ? sum + v * 20000 : sum), 0);
    const revenue30 = (payments30 ?? []).reduce((sum: number, p: any) => sum + Number(p.amount_ars || 0), 0);

    // Daily signup buckets (14 days)
    const days: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const count = (signups14 ?? []).filter((s: any) => s.created_at.slice(0, 10) === key).length;
      days.push({ date: key.slice(5), count });
    }

    // Top event types last 7d
    const eventCounts: Record<string, number> = {};
    (events7 ?? []).forEach((e: any) => { eventCounts[e.event_type] = (eventCounts[e.event_type] ?? 0) + 1; });
    const topEvents = Object.entries(eventCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ type: k, count: v }));

    return {
      orgs: orgs ?? 0,
      users: users ?? 0,
      vacancies: vacancies ?? 0,
      applications: applications ?? 0,
      byStatus,
      mrr,
      revenue30,
      signupsByDay: days,
      topEvents,
    };
  });

export const adminListOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("id, name, subscription_status, trial_ends_at, current_period_end, plan_price_ars, last_payment_at, created_at, mp_preapproval_id")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const adminGrantLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      org_id: z.string().uuid(),
      action: z.enum(["activate_30", "activate_90", "activate_365", "extend_trial_15", "mark_paid_manual", "suspend", "cancel"]),
    }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, any> = {};
    const now = Date.now();
    const days = (d: number) => new Date(now + d * 86400000).toISOString();

    switch (data.action) {
      case "activate_30": patch.subscription_status = "active"; patch.current_period_end = days(30); patch.last_payment_at = new Date().toISOString(); break;
      case "activate_90": patch.subscription_status = "active"; patch.current_period_end = days(90); patch.last_payment_at = new Date().toISOString(); break;
      case "activate_365": patch.subscription_status = "active"; patch.current_period_end = days(365); patch.last_payment_at = new Date().toISOString(); break;
      case "extend_trial_15": patch.subscription_status = "trialing"; patch.trial_ends_at = days(15); break;
      case "mark_paid_manual": patch.subscription_status = "active"; patch.current_period_end = days(30); patch.last_payment_at = new Date().toISOString(); break;
      case "suspend": patch.subscription_status = "past_due"; break;
      case "cancel": patch.subscription_status = "canceled"; break;
    }

    const { error } = await supabaseAdmin.from("organizations").update(patch).eq("id", data.org_id);
    if (error) throw error;

    if (data.action === "mark_paid_manual" || data.action.startsWith("activate_")) {
      await supabaseAdmin.from("payments").insert({
        org_id: data.org_id,
        provider: "manual",
        amount_ars: 20000,
        status: "approved",
        paid_at: new Date().toISOString(),
        raw: { by: context.userId, action: data.action },
      });
    }

    await supabaseAdmin.from("activity_events").insert({
      org_id: data.org_id, user_id: context.userId, event_type: `admin.${data.action}`, metadata: {},
    });

    return { ok: true };
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(72),
      display_name: z.string().min(1).max(80),
      org_name: z.string().min(1).max(120),
      grant_license: z.enum(["none", "trial_15", "active_30", "active_365"]).default("trial_15"),
    }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { org_name: data.org_name, display_name: data.display_name },
    });
    if (createErr) throw createErr;
    const newUserId = created.user!.id;

    // Wait for trigger to create org/profile
    let orgId: string | null = null;
    for (let i = 0; i < 5; i++) {
      const { data: prof } = await supabaseAdmin.from("profiles").select("org_id").eq("id", newUserId).single();
      if (prof?.org_id) { orgId = prof.org_id; break; }
      await new Promise(r => setTimeout(r, 250));
    }

    if (orgId && data.grant_license !== "none") {
      const now = Date.now();
      const patch: any = {};
      if (data.grant_license === "trial_15") {
        patch.subscription_status = "trialing";
        patch.trial_ends_at = new Date(now + 15 * 86400000).toISOString();
      } else if (data.grant_license === "active_30") {
        patch.subscription_status = "active";
        patch.current_period_end = new Date(now + 30 * 86400000).toISOString();
        patch.last_payment_at = new Date().toISOString();
      } else if (data.grant_license === "active_365") {
        patch.subscription_status = "active";
        patch.current_period_end = new Date(now + 365 * 86400000).toISOString();
        patch.last_payment_at = new Date().toISOString();
      }
      await supabaseAdmin.from("organizations").update(patch).eq("id", orgId);
    }

    return { user_id: newUserId, org_id: orgId };
  });

export const adminListPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("id, org_id, provider, provider_payment_id, amount_ars, status, paid_at, created_at, organizations(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, org_id, organizations(name, subscription_status)")
      .order("created_at", { ascending: false })
      .limit(500);
    return profiles ?? [];
  });
