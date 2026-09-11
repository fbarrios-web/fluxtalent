// Otorga la promo "Starter free por 1 mes" al activar la primera vacante.
import { addOneMonth, isPromoSignupWindow, PROMO_PLAN_ID } from "@/lib/promo";

type Sb = any;

/**
 * Devuelve la fecha de fin de la promo si se otorgó recién, o null si la org
 * no es elegible (fuera de la ventana de alta, ya la usó, o ya paga un plan).
 */
export async function grantStarterPromoIfEligible(supabase: Sb, orgId: string): Promise<string | null> {
  const { data: org } = await supabase
    .from("organizations")
    .select("id, created_at, subscription_status, trial_ends_at, is_unlimited, promo_plan_id, promo_ends_at")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return null;
  if (org.promo_plan_id) return null; // ya la usó
  if (org.is_unlimited) return null;
  if (org.subscription_status !== "trialing") return null; // ya tiene plan pago
  if (!isPromoSignupWindow(org.created_at)) return null;

  const now = new Date();
  const end = addOneMonth(now);
  const trialEnds = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const newTrialEnds = trialEnds && trialEnds.getTime() > end.getTime() ? trialEnds : end;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("organizations")
    .update({
      promo_plan_id: PROMO_PLAN_ID,
      promo_started_at: now.toISOString(),
      promo_ends_at: end.toISOString(),
      promo_ack_at: null,
      trial_ends_at: newTrialEnds.toISOString(),
    })
    .eq("id", orgId)
    .is("promo_plan_id", null);
  if (error) {
    console.error("[promo] no se pudo activar la promo Starter", error);
    return null;
  }

  await supabaseAdmin.from("activity_events").insert({
    org_id: orgId,
    event_type: "promo.starter_granted",
    metadata: { plan: PROMO_PLAN_ID, ends_at: end.toISOString() },
  });
  return end.toISOString();
}
