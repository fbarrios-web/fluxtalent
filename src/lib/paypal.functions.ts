import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/lib/plans";
import { PAYPAL_PLAN_IDS, type PaypalPlanId } from "@/lib/paypal";

const MONTH_MS = 30 * 86_400_000;

/**
 * Activa la suscripción USD de la organización después de que PayPal aprueba el pago.
 * Verifica contra la API de PayPal cuando hay credenciales configuradas.
 */
export const activatePaypalSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { subscriptionId: string; planId: PaypalPlanId }) => {
    if (!data?.subscriptionId || !/^[A-Za-z0-9-]{5,50}$/.test(data.subscriptionId)) {
      throw new Error("Suscripción de PayPal inválida");
    }
    if (!["starter", "pro", "enterprise"].includes(data.planId)) throw new Error("Plan inválido");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const plan = PLANS.find(p => p.id === data.planId)!;

    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();
    const orgId = profile?.org_id;
    if (!orgId) throw new Error("Sin organización");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPaypalSubscription, paypalConfigured } = await import("@/lib/paypal.server");

    let periodEnd = new Date(Date.now() + MONTH_MS).toISOString();
    let verified = false;

    if (paypalConfigured()) {
      const sub = await getPaypalSubscription(data.subscriptionId);
      if (!sub) throw new Error("No pudimos verificar la suscripción con PayPal. Escribinos a soporte@fluxtalent.com.ar.");
      const expectedPlan = PAYPAL_PLAN_IDS[data.planId];
      if (expectedPlan && sub.plan_id && sub.plan_id !== expectedPlan) throw new Error("La suscripción no corresponde al plan elegido");
      if (!["ACTIVE", "APPROVED", "APPROVAL_PENDING"].includes(String(sub.status))) {
        throw new Error("La suscripción de PayPal no está activa");
      }
      verified = true;
      const next = sub.billing_info?.next_billing_time;
      if (next) periodEnd = new Date(next).toISOString();
    }

    // Evitamos doble cobro: si venía pagando en pesos, cancelamos la preapproval.
    try {
      const { cancelMercadoPagoSubscription } = await import("@/lib/billing-provider.server");
      await cancelMercadoPagoSubscription(supabaseAdmin, orgId);
    } catch (e) {
      console.error("[activatePaypalSubscription] no se pudo cancelar MP", e);
    }

    const { error } = await supabaseAdmin
      .from("organizations")
      .update({
        paypal_subscription_id: data.subscriptionId,
        plan_currency: "usd",
        plan_price_ars: plan.priceArs,
        subscription_status: "active",
        current_period_end: periodEnd,
        last_payment_at: new Date().toISOString(),
        grace_until: null,
      } as any)
      .eq("id", orgId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("payments").upsert(
      {
        org_id: orgId,
        provider: "paypal",
        provider_payment_id: data.subscriptionId,
        amount_ars: plan.priceUsd ?? 0,
        currency: "usd",
        status: "approved",
        paid_at: new Date().toISOString(),
        raw: { plan_id: PAYPAL_PLAN_IDS[data.planId], verified },
      } as any,
      { onConflict: "provider,provider_payment_id" },
    );

    await supabaseAdmin.from("profiles").update({ setup_completed_at: new Date().toISOString() } as any).eq("id", userId);

    await supabaseAdmin.from("activity_events").insert({
      org_id: orgId,
      user_id: userId,
      event_type: "subscription.activated",
      metadata: { provider: "paypal", subscription_id: data.subscriptionId, plan_id: data.planId, verified },
    });

    return { ok: true, periodEnd };
  });
