// Server-only helpers to enforce plan quotas.
import { PLANS, planByPrice, type Plan } from "@/lib/plans";

type Sb = any;

export async function getOrgPlan(supabase: Sb, orgId: string): Promise<Plan> {
  const { data: org } = await supabase
    .from("organizations")
    .select("plan_price_ars, subscription_status, trial_ends_at")
    .eq("id", orgId).maybeSingle();
  if (!org) return PLANS[0];
  // Trial = Free plan limits
  if (org.subscription_status === "trialing") return PLANS[0];
  return planByPrice(org.plan_price_ars);
}

export async function getActiveVacancyCount(supabase: Sb, orgId: string): Promise<number> {
  const { count } = await supabase
    .from("vacancies")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["draft", "active", "paused"]);
  return count ?? 0;
}

export async function getCvsThisMonth(supabase: Sb, orgId: string): Promise<number> {
  const start = new Date();
  start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("cv_url", "is", null)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

export async function assertCanCreateVacancy(supabase: Sb, orgId: string) {
  const plan = await getOrgPlan(supabase, orgId);
  if (plan.maxVacancies === -1) return;
  const used = await getActiveVacancyCount(supabase, orgId);
  if (used >= plan.maxVacancies) {
    throw new Error(
      `Tu plan ${plan.name} incluye hasta ${plan.maxVacancies} vacante${plan.maxVacancies === 1 ? "" : "s"} activa${plan.maxVacancies === 1 ? "" : "s"}. Cerrá una vacante o actualizá tu plan para crear más.`
    );
  }
}

/** Returns true if CVs can still be analyzed by AI under the org's plan. */
export async function canAnalyzeMoreCvs(supabase: Sb, orgId: string): Promise<boolean> {
  const plan = await getOrgPlan(supabase, orgId);
  if (plan.maxCvsPerMonth === -1) return true;
  const used = await getCvsThisMonth(supabase, orgId);
  return used < plan.maxCvsPerMonth;
}
