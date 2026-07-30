/**
 * Helpers server-only para mantener UNA sola suscripción activa por organización.
 * Si la org se pasa de ARS (Mercado Pago) a USD (Paddle) o cambia de plan en ARS,
 * cancelamos automáticamente la suscripción anterior para evitar doble cobro.
 */

type Sb = any;

/** Cancela la preapproval de Mercado Pago de la org (si existe) y limpia el id. */
export async function cancelMercadoPagoSubscription(supabaseAdmin: Sb, orgId: string): Promise<boolean> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("mp_preapproval_id")
    .eq("id", orgId)
    .maybeSingle();
  const preapprovalId = org?.mp_preapproval_id;
  if (!preapprovalId) return false;

  if (token) {
    try {
      await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
    } catch (e) {
      console.error("[cancelMercadoPagoSubscription] failed", e);
      return false;
    }
  }

  await supabaseAdmin.from("organizations").update({ mp_preapproval_id: null }).eq("id", orgId);
  await supabaseAdmin.from("activity_events").insert({
    org_id: orgId,
    event_type: "subscription.auto_canceled",
    metadata: { provider: "mercadopago", preapproval_id: preapprovalId },
  });
  return true;
}

/** Cancela la suscripción de Paddle de la org (si existe), al final del período. */
export async function cancelPaddleSubscription(
  supabaseAdmin: Sb,
  orgId: string,
  immediate = false,
): Promise<boolean> {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("paddle_subscription_id")
    .eq("id", orgId)
    .maybeSingle();
  const subId = org?.paddle_subscription_id;
  if (!subId) return false;

  try {
    const { data: subRow } = await supabaseAdmin
      .from("subscriptions")
      .select("environment")
      .eq("paddle_subscription_id", subId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const env = (subRow?.environment ?? "sandbox") as "sandbox" | "live";
    const { getPaddleClient } = await import("@/lib/paddle.server");
    const paddle = getPaddleClient(env);
    await paddle.subscriptions.cancel(subId, {
      effectiveFrom: immediate ? "immediately" : "next_billing_period",
    });
  } catch (e) {
    console.error("[cancelPaddleSubscription] failed", e);
    return false;
  }

  await supabaseAdmin.from("activity_events").insert({
    org_id: orgId,
    event_type: "subscription.auto_canceled",
    metadata: { provider: "paddle", subscription_id: subId, immediate },
  });
  return true;
}
