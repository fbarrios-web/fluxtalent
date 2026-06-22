import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Returns the user's org including parent info + whether they are root admin of an Enterprise group. */
export const myEnterprise = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();
    if (!profile?.org_id) return null;
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, plan_price_ars, subscription_status, parent_org_id")
      .eq("id", profile.org_id).maybeSingle();
    if (!org) return null;

    const isEnterprisePlan = Number(org.plan_price_ars) >= 90000;
    const rootId = org.parent_org_id ?? org.id;

    // List sub-orgs of the root org (admin client: user's RLS only sees their own org row)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subOrgs } = await supabaseAdmin
      .from("organizations")
      .select("id, name, created_at")
      .eq("parent_org_id", rootId)
      .order("created_at", { ascending: false });

    return {
      org,
      rootOrgId: rootId,
      isRoot: !org.parent_org_id,
      isEnterprise: isEnterprisePlan,
      subOrgs: subOrgs ?? [],
    };
  });

/** Create a sub-organization under the user's Enterprise root org. */
export const createSubOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().trim().min(2).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();
    if (!profile?.org_id) throw new Error("Sin organización");

    const { data: org } = await supabase
      .from("organizations").select("id, plan_price_ars, parent_org_id").eq("id", profile.org_id).maybeSingle();
    if (!org) throw new Error("Organización no encontrada");
    if (org.parent_org_id) throw new Error("Solo la organización raíz puede crear sub-organizaciones");
    if (Number(org.plan_price_ars) < 90000) throw new Error("Multi-organización requiere plan Enterprise");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.from("organizations").insert({
      name: data.name,
      parent_org_id: org.id,
      subscription_status: "active",
      plan_price_ars: org.plan_price_ars,
      current_period_end: new Date(Date.now() + 365 * 86400000).toISOString(),
    }).select("id, name").single();
    if (error) throw error;
    return created;
  });

/** Create a user assigned to a specific sub-org. */
export const createSubOrgUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      sub_org_id: z.string().uuid(),
      email: z.string().email(),
      password: z.string().min(8).max(72),
      display_name: z.string().min(1).max(80),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();
    if (!profile?.org_id) throw new Error("Sin organización");

    const { data: rootOrg } = await supabase
      .from("organizations").select("id, plan_price_ars, parent_org_id").eq("id", profile.org_id).maybeSingle();
    if (!rootOrg || rootOrg.parent_org_id) throw new Error("Solo la org raíz puede crear usuarios");
    if (Number(rootOrg.plan_price_ars) < 90000) throw new Error("Requiere plan Enterprise");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verify sub_org belongs to this root
    const { data: subOrg } = await supabaseAdmin
      .from("organizations").select("id, parent_org_id").eq("id", data.sub_org_id).maybeSingle();
    if (!subOrg || subOrg.parent_org_id !== rootOrg.id) throw new Error("Sub-organización inválida");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name, org_name: "—" },
    });
    if (error) throw error;
    const newUserId = created.user!.id;

    // Reassign their profile to the sub-org (trigger creates a new org by default)
    await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      org_id: data.sub_org_id,
      display_name: data.display_name,
    });

    return { user_id: newUserId };
  });

/** List users for the root org (across sub-orgs). */
export const listEnterpriseUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();
    if (!profile?.org_id) return [];
    const { data: org } = await supabase
      .from("organizations").select("id, parent_org_id").eq("id", profile.org_id).maybeSingle();
    const rootId = org?.parent_org_id ?? org?.id;
    if (!rootId) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orgs } = await supabaseAdmin
      .from("organizations").select("id, name").or(`id.eq.${rootId},parent_org_id.eq.${rootId}`);
    const orgIds = (orgs ?? []).map((o: any) => o.id);
    if (!orgIds.length) return [];
    const { data: profs } = await supabaseAdmin
      .from("profiles").select("id, display_name, org_id").in("org_id", orgIds);
    const orgName = new Map((orgs ?? []).map((o: any) => [o.id, o.name]));
    return (profs ?? []).map((p: any) => ({
      id: p.id,
      display_name: p.display_name,
      org_id: p.org_id,
      org_name: orgName.get(p.org_id) ?? "—",
    }));
  });

/** Assign / unassign a recruiter to a vacancy. */
export const setVacancyAssignees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      vacancy_id: z.string().uuid(),
      user_ids: z.array(z.string().uuid()),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("vacancy_assignees").delete().eq("vacancy_id", data.vacancy_id);
    if (data.user_ids.length) {
      const rows = data.user_ids.map(uid => ({ vacancy_id: data.vacancy_id, user_id: uid }));
      const { error } = await supabase.from("vacancy_assignees").insert(rows);
      if (error) throw error;
    }
    return { ok: true };
  });

export const listVacancyAssignees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ vacancy_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("vacancy_assignees").select("user_id").eq("vacancy_id", data.vacancy_id);
    return (rows ?? []).map(r => r.user_id);
  });
