// Server-only helpers to enforce plan quotas by billing cycle.
import { PLANS, planByPrice, type Plan } from "@/lib/plans";
import { isPromoActive, PROMO_PLAN_ID } from "@/lib/promo";

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
    .select("subscription_status, trial_ends_at, current_period_end, created_at, promo_plan_id, promo_started_at, promo_ends_at, usage_cycle_start")
    .eq("id", orgId).maybeSingle();
  const now = new Date();
  // Inicio de ciclo de consumo fijado a mano (ej.: cambio de plan a mitad de mes):
  // el consumo se cuenta desde esa fecha aunque el período de facturación arranque después.
  const overrideStart = (org as any)?.usage_cycle_start
    ? new Date((org as any).usage_cycle_start)
    : null;
  const withOverrideStart = (c: CycleInfo): CycleInfo =>
    overrideStart && overrideStart < c.start && overrideStart <= now
      ? { start: overrideStart, end: c.end }
      : c;
  // Promo Starter free: el ciclo es el mes de la promo.
  if (isPromoActive(org)) {
    return withOverrideStart({
      start: new Date(org.promo_started_at ?? now.toISOString()),
      end: new Date(org.promo_ends_at),
    });
  }
  if (org?.subscription_status === "trialing" && org.trial_ends_at) {
    const end = new Date(org.trial_ends_at);
    const start = new Date(end.getTime() - 15 * 86_400_000);
    return withOverrideStart({ start, end });
  }
  if (org?.current_period_end) {
    const end = new Date(org.current_period_end);
    const start = new Date(end.getTime() - 30 * 86_400_000);
    return withOverrideStart({ start, end });
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
    .select("plan_price_ars, subscription_status, trial_ends_at, is_unlimited, promo_plan_id, promo_ends_at, cv_limit_override")
    .eq("id", orgId).maybeSingle();
  if (!org) return PLANS[0];
  // Cupo de CVs a medida para una cuenta puntual (acordado comercialmente).
  const override = Number((org as any).cv_limit_override ?? 0);
  const withOverride = (p: Plan): Plan =>
    override > 0 && p.maxCvsPerMonth !== -1 ? { ...p, maxCvsPerMonth: override } : p;

  if ((org as any).is_unlimited) {
    return { ...PLANS[0], id: "custom", name: "Admin (ilimitado)", maxVacancies: -1, maxNewVacanciesPerCycle: -1, maxCvsPerMonth: -1 };
  }
  // Promo vigente: límites del plan Starter sin costo.
  if (isPromoActive(org)) {
    const promoPlan = PLANS.find(p => p.id === PROMO_PLAN_ID)!;
    return withOverride({ ...promoPlan, name: `${promoPlan.name} (promo)` });
  }
  if (org.subscription_status === "trialing") return withOverride(PLANS[0]);
  return withOverride(planByPrice(org.plan_price_ars));
}

/**
 * Vacantes activas del CICLO ACTUAL (draft/active/paused creadas dentro del ciclo).
 * El cupo de vacantes activas es mensual: las vacantes de ciclos anteriores
 * siguen accesibles pero no consumen el cupo del mes en curso.
 */
export async function getActiveVacancyCount(supabase: Sb, orgId: string): Promise<number> {
  const { start } = await getCurrentCycle(supabase, orgId);
  const { count } = await supabase
    .from("vacancies")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["draft", "active", "paused"])
    .gte("created_at", start.toISOString());
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
      const { end } = await getCurrentCycle(supabase, orgId);
      throw new Error(
        `Alcanzaste el máximo de ${plan.maxVacancies} vacante${plan.maxVacancies === 1 ? "" : "s"} activa${plan.maxVacancies === 1 ? "" : "s"} del mes (plan ${plan.name}). El cupo se renueva el ${end.toLocaleDateString("es-AR")}.`
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

/** Al REACTIVAR una vacante: cuenta el cupo de vacantes activas del mes. */
export async function assertCanActivateVacancy(supabase: Sb, orgId: string) {
  const plan = await getOrgPlan(supabase, orgId);
  if (plan.maxVacancies === -1) return;
  const active = await getActiveVacancyCount(supabase, orgId);
  if (active >= plan.maxVacancies) {
    const { end } = await getCurrentCycle(supabase, orgId);
    throw new Error(
      `No podés reactivar: ya tenés ${active} vacante${active === 1 ? "" : "s"} activa${active === 1 ? "" : "s"} este mes y tu plan ${plan.name} permite hasta ${plan.maxVacancies}. El cupo se renueva el ${end.toLocaleDateString("es-AR")}.`
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
