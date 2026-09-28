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

    const isEnterprisePlan = Number(org.plan_price_ars) >= 90000 || Number(org.plan_price_ars) === -1;
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
    if (Number(org.plan_price_ars) < 90000 && Number(org.plan_price_ars) !== -1) throw new Error("Multi-organización requiere plan Enterprise");

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
    if (Number(rootOrg.plan_price_ars) < 90000 && Number(rootOrg.plan_price_ars) !== -1) throw new Error("Requiere plan Enterprise");

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

// ---------- Team members with vacancy-level access (same organization) ----------

async function requireManager(supabase: any, userId: string) {
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();
  if (!profile?.org_id) throw new Error("Sin organización");
  const { data: org } = await supabase
    .from("organizations").select("id, plan_price_ars, parent_org_id").eq("id", profile.org_id).maybeSingle();
  if (!org) throw new Error("Organización no encontrada");
  if (Number(org.plan_price_ars) < 90000 && Number(org.plan_price_ars) !== -1) throw new Error("Requiere plan Enterprise o Custom");
  const { data: access } = await supabase
    .from("org_member_access").select("all_vacancies").eq("user_id", userId).maybeSingle();
  if (access && access.all_vacancies === false) throw new Error("No tenés permisos para administrar usuarios");
  return org.id as string;
}

async function writeAccess(admin: any, orgId: string, userId: string, allVacancies: boolean, vacancyIds: string[]) {
  const { error } = await admin.from("org_member_access").upsert({
    user_id: userId, org_id: orgId, all_vacancies: allVacancies, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await admin.from("vacancy_assignees").delete().eq("user_id", userId);
  if (!allVacancies && vacancyIds.length) {
    const { data: valid } = await admin.from("vacancies").select("id").eq("org_id", orgId).in("id", vacancyIds);
    const rows = (valid ?? []).map((v: any) => ({ vacancy_id: v.id, user_id: userId }));
    if (rows.length) {
      const { error: e2 } = await admin.from("vacancy_assignees").insert(rows);
      if (e2) throw e2;
    }
  }
}

export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await requireManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profs }, { data: access }, { data: vacs }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, display_name, full_name").eq("org_id", orgId),
      supabaseAdmin.from("org_member_access").select("user_id, all_vacancies").eq("org_id", orgId),
      supabaseAdmin.from("vacancies").select("id, title, status").eq("org_id", orgId).order("created_at", { ascending: false }),
    ]);
    const vacIds = (vacs ?? []).map((v: any) => v.id);
    const { data: assigns } = vacIds.length
      ? await supabaseAdmin.from("vacancy_assignees").select("user_id, vacancy_id").in("vacancy_id", vacIds)
      : { data: [] as any[] };
    const accessMap = new Map((access ?? []).map((a: any) => [a.user_id, a.all_vacancies]));
    const members = await Promise.all((profs ?? []).map(async (p: any) => {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id);
      return {
        id: p.id,
        name: p.display_name || p.full_name || u?.user?.email || "—",
        email: u?.user?.email ?? "",
        is_me: p.id === context.userId,
        all_vacancies: accessMap.has(p.id) ? accessMap.get(p.id) : true,
        vacancy_ids: (assigns ?? []).filter((a: any) => a.user_id === p.id).map((a: any) => a.vacancy_id),
      };
    }));
    return { members, vacancies: vacs ?? [] };
  });

export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().trim().email().max(255),
      password: z.string().min(8).max(72),
      display_name: z.string().trim().min(1).max(80),
      all_vacancies: z.boolean(),
      vacancy_ids: z.array(z.string().uuid()).max(500),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const orgId = await requireManager(context.supabase, context.userId);
    if (!data.all_vacancies && data.vacancy_ids.length === 0) throw new Error("Elegí al menos una vacante");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { display_name: data.display_name, org_name: "—" },
    });
    if (error) throw new Error(error.message.includes("already") ? "Ya existe un usuario con ese email" : error.message);
    const newId = created.user!.id;
    const { data: autoProfile } = await supabaseAdmin.from("profiles").select("org_id").eq("id", newId).maybeSingle();
    await supabaseAdmin.from("profiles").upsert({
      id: newId, org_id: orgId, display_name: data.display_name, setup_completed_at: new Date().toISOString(),
    });
    // Clean up the empty org created automatically on signup
    if (autoProfile?.org_id && autoProfile.org_id !== orgId) {
      await supabaseAdmin.from("organizations").delete().eq("id", autoProfile.org_id);
    }
    await writeAccess(supabaseAdmin, orgId, newId, data.all_vacancies, data.vacancy_ids);
    return { user_id: newId };
  });

export const updateTeamMemberAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      all_vacancies: z.boolean(),
      vacancy_ids: z.array(z.string().uuid()).max(500),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const orgId = await requireManager(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("No podés cambiar tu propio acceso");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("org_id").eq("id", data.user_id).maybeSingle();
    if (prof?.org_id !== orgId) throw new Error("Usuario inválido");
    await writeAccess(supabaseAdmin, orgId, data.user_id, data.all_vacancies, data.vacancy_ids);
    return { ok: true };
  });
