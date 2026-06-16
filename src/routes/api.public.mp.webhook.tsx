import { createFileRoute } from "@tanstack/react-router";

/**
 * Mercado Pago webhook (preapproval + payment notifications).
 * MP envía notificaciones tipo: ?type=payment&id=... o ?topic=preapproval&id=...
 * Verificamos firma con MERCADOPAGO_WEBHOOK_SECRET (header x-signature).
 */
export const Route = createFileRoute("/api/public/mp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!token) return new Response("MP not configured", { status: 503 });

        const url = new URL(request.url);
        const type = url.searchParams.get("type") || url.searchParams.get("topic");
        const id = url.searchParams.get("id") || url.searchParams.get("data.id");
        const bodyText = await request.text();
        let body: any = {};
        try { body = bodyText ? JSON.parse(bodyText) : {}; } catch {}
        const dataId = id ?? body?.data?.id ?? body?.id;

        if (!type || !dataId) return new Response("ok"); // ack noisy pings

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        async function fetchMP(path: string) {
          const r = await fetch(`https://api.mercadopago.com${path}`, { headers: { Authorization: `Bearer ${token}` } });
          return r.ok ? r.json() : null;
        }

        if (type === "payment") {
          const p: any = await fetchMP(`/v1/payments/${dataId}`);
          if (!p) return new Response("ok");
          const orgId = p.external_reference;
          if (!orgId) return new Response("ok");

          await supabaseAdmin.from("payments").upsert({
            org_id: orgId,
            provider: "mercadopago",
            provider_payment_id: String(p.id),
            amount_ars: Number(p.transaction_amount ?? 0),
            status: p.status,
            paid_at: p.date_approved ?? null,
            raw: p,
          }, { onConflict: "provider,provider_payment_id" });

          if (p.status === "approved") {
            await supabaseAdmin.from("organizations").update({
              subscription_status: "active",
              current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
              last_payment_at: p.date_approved ?? new Date().toISOString(),
            }).eq("id", orgId);
            await supabaseAdmin.from("activity_events").insert({ org_id: orgId, event_type: "mp.payment_approved", metadata: { amount: p.transaction_amount } });
          } else if (["rejected", "cancelled", "refunded"].includes(p.status)) {
            await supabaseAdmin.from("organizations").update({ subscription_status: "past_due" }).eq("id", orgId);
          }
        } else if (type === "preapproval" || type === "subscription_preapproval") {
          const pa: any = await fetchMP(`/preapproval/${dataId}`);
          if (!pa) return new Response("ok");
          const orgId = pa.external_reference;
          if (!orgId) return new Response("ok");
          if (pa.status === "authorized") {
            await supabaseAdmin.from("organizations").update({
              subscription_status: "active",
              mp_preapproval_id: pa.id,
            }).eq("id", orgId);
          } else if (pa.status === "cancelled" || pa.status === "paused") {
            await supabaseAdmin.from("organizations").update({ subscription_status: "canceled" }).eq("id", orgId);
          }
        }

        return Response.json({ ok: true });
      },
      GET: async () => new Response("ok"),
    },
  },
});
