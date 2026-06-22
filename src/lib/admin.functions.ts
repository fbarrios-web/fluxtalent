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
      .select("id, name, subscription_status, trial_ends_at, current_period_end, plan_price_ars, last_payment_at, created_at, mp_preapproval_id, parent_org_id")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const orgs = data ?? [];

    // Look up the owner email for each org (first profile in the org)
    const orgIds = orgs.map((o: any) => o.id);
    const ownerByOrg = new Map<string, { display_name: string; email: string }>();
    if (orgIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, org_id, display_name, created_at")
        .in("org_id", orgIds)
        .order("created_at", { ascending: true });
      const firstProfByOrg = new Map<string, { id: string; display_name: string }>();
      (profs ?? []).forEach((p: any) => {
        if (p.org_id && !firstProfByOrg.has(p.org_id)) {
          firstProfByOrg.set(p.org_id, { id: p.id, display_name: p.display_name ?? "" });
        }
      });
      // Page through auth.users to map id → email
      const emailById = new Map<string, string>();
      let page = 1;
      while (true) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        list?.users?.forEach((u: any) => emailById.set(u.id, u.email ?? ""));
        if (!list?.users?.length || list.users.length < 200) break;
        page++;
        if (page > 50) break;
      }
      firstProfByOrg.forEach((p, orgId) => {
        ownerByOrg.set(orgId, { display_name: p.display_name, email: emailById.get(p.id) ?? "" });
      });
    }

    return orgs.map((o: any) => ({
      ...o,
      owner_email: ownerByOrg.get(o.id)?.email ?? "",
      owner_name: ownerByOrg.get(o.id)?.display_name ?? "",
    }));
  });

export const adminGrantLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      org_id: z.string().uuid(),
      action: z.enum(["activate_30", "activate_90", "activate_365", "extend_trial_15", "mark_paid_manual", "suspend", "cancel", "set_plan"]),
      plan_price_ars: z.number().int().nonnegative().optional(),
      days: z.number().int().positive().max(3650).optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const days = (d: number) => new Date(now + d * 86400000).toISOString();
    let patch: Record<string, unknown> = {};


    switch (data.action) {
      case "activate_30": patch = { subscription_status: "active", current_period_end: days(30), last_payment_at: new Date().toISOString() }; break;
      case "activate_90": patch = { subscription_status: "active", current_period_end: days(90), last_payment_at: new Date().toISOString() }; break;
      case "activate_365": patch = { subscription_status: "active", current_period_end: days(365), last_payment_at: new Date().toISOString() }; break;
      case "extend_trial_15": patch = { subscription_status: "trialing", trial_ends_at: days(15) }; break;
      case "mark_paid_manual": patch = { subscription_status: "active", current_period_end: days(30), last_payment_at: new Date().toISOString() }; break;
      case "suspend": patch = { subscription_status: "past_due" }; break;
      case "cancel": patch = { subscription_status: "canceled" }; break;
      case "set_plan": {
        if (data.plan_price_ars === undefined) throw new Error("Falta el precio del plan");
        const periodDays = data.days ?? 30;
        patch = {
          subscription_status: "active",
          plan_price_ars: data.plan_price_ars,
          current_period_end: days(periodDays),
          last_payment_at: new Date().toISOString(),
        };
        break;
      }
    }

    const { error } = await supabaseAdmin.from("organizations").update(patch as never).eq("id", data.org_id);
    if (error) throw error;



    if (data.action === "mark_paid_manual" || data.action === "set_plan" || data.action.startsWith("activate_")) {
      await supabaseAdmin.from("payments").insert({
        org_id: data.org_id,
        provider: "manual",
        amount_ars: data.action === "set_plan" ? (data.plan_price_ars ?? 0) : 20000,
        status: "approved",
        paid_at: new Date().toISOString(),
        raw: { by: context.userId, action: data.action, plan_price_ars: data.plan_price_ars, days: data.days },
      });
    }

    await supabaseAdmin.from("activity_events").insert({
      org_id: data.org_id, user_id: context.userId, event_type: `admin.${data.action}`, metadata: { plan_price_ars: data.plan_price_ars, days: data.days },
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
      await supabaseAdmin.from("organizations").update(patch as never).eq("id", orgId);
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

/** Export full client base (organizations + key contact) for admin. */
export const adminExportClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: orgs }, { data: profiles }, { data: payments }] = await Promise.all([
      supabaseAdmin.from("organizations")
        .select("id, name, subscription_status, trial_ends_at, current_period_end, plan_price_ars, last_payment_at, created_at, parent_org_id")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, org_id, display_name"),
      supabaseAdmin.from("payments").select("org_id, amount_ars, status"),
    ]);

    const ids = (profiles ?? []).map((p: any) => p.id);
    const emailMap = new Map<string, string>();
    if (ids.length) {
      // paginate auth.admin.listUsers if needed
      let page = 1;
      while (true) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        list?.users?.forEach((u: any) => emailMap.set(u.id, u.email ?? ""));
        if (!list?.users?.length || list.users.length < 200) break;
        page++;
        if (page > 50) break;
      }
    }

    const ownerByOrg = new Map<string, { name: string; email: string }>();
    (profiles ?? []).forEach((p: any) => {
      if (p.org_id && !ownerByOrg.has(p.org_id)) {
        ownerByOrg.set(p.org_id, { name: p.display_name ?? "", email: emailMap.get(p.id) ?? "" });
      }
    });

    const paidByOrg = new Map<string, number>();
    (payments ?? []).forEach((p: any) => {
      if (p.status === "approved") paidByOrg.set(p.org_id, (paidByOrg.get(p.org_id) ?? 0) + Number(p.amount_ars || 0));
    });

    return (orgs ?? []).map((o: any) => {
      const owner = ownerByOrg.get(o.id);
      return {
        org_id: o.id,
        organizacion: o.name,
        es_sub_organizacion: o.parent_org_id ? "Sí" : "No",
        contacto: owner?.name ?? "",
        email: owner?.email ?? "",
        estado: o.subscription_status,
        plan_ars: Number(o.plan_price_ars ?? 0),
        trial_vence: o.trial_ends_at ?? "",
        periodo_vence: o.current_period_end ?? "",
        ultimo_pago: o.last_payment_at ?? "",
        total_pagado_ars: paidByOrg.get(o.id) ?? 0,
        creada: o.created_at,
      };
    });
  });
