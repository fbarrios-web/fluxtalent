// Server-only helpers to enforce plan quotas by billing cycle.
import { PLANS, planByPrice, type Plan } from "@/lib/plans";

type Sb = any;

export interface CycleInfo {
  start: Date;
  end: Date; // renewal date (approx if unknown)
}

/**
 * Compute the current billing cycle window for the org.
 * - trialing: [trial_ends_at - 15d, trial_ends_at]
 * - active/canceled/past_due with current_period_end: [end - 30d, end]
 * - fallback: monthly window anchored at org.created_at
 */
export async function getCurrentCycle(supabase: Sb, orgId: string): Promise<CycleInfo> {
  const { data: org } = await supabase
    .from("organizations")
    .select("subscription_status, trial_ends_at, current_period_end, created_at")
    .eq("id", orgId).maybeSingle();
  const now = new Date();
  if (org?.subscription_status === "trialing" && org.trial_ends_at) {
    const end = new Date(org.trial_ends_at);
    const start = new Date(end.getTime() - 15 * 86_400_000);
    return { start, end };
  }
  if (org?.current_period_end) {
    const end = new Date(org.current_period_end);
    const start = new Date(end.getTime() - 30 * 86_400_000);
    return { start, end };
  }
  // Fallback: monthly window anchored to org creation
  const anchor = org?.created_at ? new Date(org.created_at) : now;
  const start = new Date(now);
  start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  // Prefer anchor day-of-month when it's in past
  const anchorDay = Math.min(anchor.getUTCDate(), 28);
  const cycleStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), anchorDay));
  if (cycleStart > now) cycleStart.setUTCMonth(cycleStart.getUTCMonth() - 1);
  const cycleEnd = new Date(cycleStart); cycleEnd.setUTCMonth(cycleEnd.getUTCMonth() + 1);
  return { start: cycleStart, end: cycleEnd };
}

export async function getOrgPlan(supabase: Sb, orgId: string): Promise<Plan> {
  const { data: org } = await supabase
    .from("organizations")
    .select("plan_price_ars, subscription_status, trial_ends_at, is_unlimited")
    .eq("id", orgId).maybeSingle();
  if (!org) return PLANS[0];
  if ((org as any).is_unlimited) {
    return { ...PLANS[0], id: "custom", name: "Admin (ilimitado)", maxVacancies: -1, maxNewVacanciesPerCycle: -1, maxCvsPerMonth: -1 };
  }
  if (org.subscription_status === "trialing") return PLANS[0];
  return planByPrice(org.plan_price_ars);
}

/** Vacantes activas simultáneas (draft/active/paused). */
export async function getActiveVacancyCount(supabase: Sb, orgId: string): Promise<number> {
  const { count } = await supabase
    .from("vacancies")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["draft", "active", "paused"]);
  return count ?? 0;
}

/** Vacantes creadas dentro del ciclo actual (todas, sin importar estado). */
export async function getNewVacanciesThisCycle(supabase: Sb, orgId: string): Promise<number> {
  const { start } = await getCurrentCycle(supabase, orgId);
  const { count } = await supabase
    .from("vacancies")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

/** CVs procesados en el ciclo actual. */
export async function getCvsThisCycle(supabase: Sb, orgId: string): Promise<number> {
  const { start } = await getCurrentCycle(supabase, orgId);
  const { count } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("cv_url", "is", null)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

/** Back-compat alias (misma semántica: CVs del ciclo actual). */
export const getCvsThisMonth = getCvsThisCycle;

/** Al CREAR una vacante: revisa ambos límites (activas simultáneas + nuevas por ciclo). */
export async function assertCanCreateVacancy(supabase: Sb, orgId: string) {
  const plan = await getOrgPlan(supabase, orgId);
  if (plan.maxVacancies !== -1) {
    const active = await getActiveVacancyCount(supabase, orgId);
    if (active >= plan.maxVacancies) {
      throw new Error(
        `Alcanzaste el máximo de ${plan.maxVacancies} vacante${plan.maxVacancies === 1 ? "" : "s"} activa${plan.maxVacancies === 1 ? "" : "s"} del plan ${plan.name}. Cerrá o pausá una vacante antes de crear otra.`
      );
    }
  }
  if (plan.maxNewVacanciesPerCycle !== -1) {
    const created = await getNewVacanciesThisCycle(supabase, orgId);
    if (created >= plan.maxNewVacanciesPerCycle) {
      const { end } = await getCurrentCycle(supabase, orgId);
      throw new Error(
        `Usaste las ${plan.maxNewVacanciesPerCycle} vacante${plan.maxNewVacanciesPerCycle === 1 ? "" : "s"} nueva${plan.maxNewVacanciesPerCycle === 1 ? "" : "s"} de tu ciclo (plan ${plan.name}). El cupo se renueva el ${end.toLocaleDateString("es-AR")}.`
      );
    }
  }
}

/** Al REACTIVAR una vacante cerrada: sólo cuenta el cupo de activas simultáneas (no consume cupo mensual). */
export async function assertCanActivateVacancy(supabase: Sb, orgId: string) {
  const plan = await getOrgPlan(supabase, orgId);
  if (plan.maxVacancies === -1) return;
  const active = await getActiveVacancyCount(supabase, orgId);
  if (active >= plan.maxVacancies) {
    throw new Error(
      `No podés reactivar: ya tenés ${active} vacantes activas y tu plan ${plan.name} permite hasta ${plan.maxVacancies}. Cerrá otra antes.`
    );
  }
}

/** Returns true if CVs can still be analyzed by AI under the org's plan. */
export async function canAnalyzeMoreCvs(supabase: Sb, orgId: string): Promise<boolean> {
  const plan = await getOrgPlan(supabase, orgId);
  if (plan.maxCvsPerMonth === -1) return true;
  const used = await getCvsThisCycle(supabase, orgId);
  return used < plan.maxCvsPerMonth;
}
