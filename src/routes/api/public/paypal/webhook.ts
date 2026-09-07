import { createFileRoute } from "@tanstack/react-router";

const MONTH_MS = 30 * 86_400_000;

async function handle(event: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const type = String(event?.event_type ?? "");
  const res = event?.resource ?? {};
  const subscriptionId: string | null =
    res.id?.startsWith?.("I-") ? res.id : (res.billing_agreement_id ?? res.subscription_id ?? null);
  if (!subscriptionId) return;

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, current_period_end")
    .eq("paypal_subscription_id", subscriptionId)
    .maybeSingle();
  if (!org?.id) return;

  if (type === "PAYMENT.SALE.COMPLETED" || type === "BILLING.SUBSCRIPTION.ACTIVATED") {
    const cur = org.current_period_end ? new Date(org.current_period_end).getTime() : 0;
    const base = cur > Date.now() ? cur : Date.now();
    const periodEnd = new Date(base + MONTH_MS).toISOString();
    await supabaseAdmin
      .from("organizations")
      .update({
        subscription_status: "active",
        current_period_end: periodEnd,
        last_payment_at: new Date().toISOString(),
        grace_until: null,
      } as any)
      .eq("id", org.id);
    if (res.id && type === "PAYMENT.SALE.COMPLETED") {
      await supabaseAdmin.from("payments").upsert(
        {
          org_id: org.id,
          provider: "paypal",
          provider_payment_id: String(res.id),
          amount_ars: Number(res.amount?.total ?? 0),
          currency: "usd",
          status: "approved",
          paid_at: new Date().toISOString(),
          raw: event,
        } as any,
        { onConflict: "provider,provider_payment_id" },
      );
    }
  } else if (
    type === "BILLING.SUBSCRIPTION.CANCELLED" ||
    type === "BILLING.SUBSCRIPTION.EXPIRED" ||
    type === "BILLING.SUBSCRIPTION.SUSPENDED"
  ) {
    await supabaseAdmin.from("organizations").update({ subscription_status: "canceled" } as any).eq("id", org.id);
  } else if (type === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
    const { graceDeadline } = await import("@/lib/entitlement");
    await supabaseAdmin
      .from("organizations")
      .update({ subscription_status: "past_due", grace_until: graceDeadline() } as any)
      .eq("id", org.id);
  }

  await supabaseAdmin.from("activity_events").insert({
    org_id: org.id,
    event_type: `paypal.${type.toLowerCase()}`,
    metadata: { subscription_id: subscriptionId },
  });
}

export const Route = createFileRoute("/api/public/paypal/webhook")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { ok: true, service: "paypal-webhook" },
          { headers: { "cache-control": "no-store" } },
        ),
      POST: async ({ request }) => {
        const raw = await request.text();
        try {
          const { verifyPaypalWebhook } = await import("@/lib/paypal.server");
          const ok = await verifyPaypalWebhook(request.headers, raw);
          if (!ok) return new Response("Invalid signature", { status: 401 });
          await handle(JSON.parse(raw));
        } catch (e) {
          console.error("[paypal webhook]", e);
          return new Response("error", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
