import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Mercado Pago webhook (preapproval + payment notifications).
 * MP envía notificaciones tipo: ?type=payment&id=... o ?topic=preapproval&id=...
 * Verifica la firma HMAC-SHA256 del header `x-signature` usando MERCADOPAGO_WEBHOOK_SECRET.
 * Manifest: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
 */
function parseXSignature(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  const parts = header.split(",").map((p) => p.trim());
  const ts = parts.find((p) => p.startsWith("ts="))?.slice(3);
  const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!ts || !v1) return null;
  return { ts, v1 };
}

function verifyMpSignature(opts: {
  secret: string;
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string;
}): boolean {
  const parsed = parseXSignature(opts.signatureHeader);
  if (!parsed) return false;
  // Manifest format per MP docs.
  const manifest = `id:${opts.dataId};request-id:${opts.requestId ?? ""};ts:${parsed.ts};`;
  const computed = createHmac("sha256", opts.secret).update(manifest).digest("hex");
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(parsed.v1, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/mp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
        const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (!token) return new Response("MP not configured", { status: 503 });
        if (!webhookSecret) {
          console.error("[mp.webhook] MERCADOPAGO_WEBHOOK_SECRET not configured");
          return new Response("Webhook not configured", { status: 503 });
        }

        const url = new URL(request.url);
        const type = url.searchParams.get("type") || url.searchParams.get("topic");
        const id = url.searchParams.get("id") || url.searchParams.get("data.id");
        const bodyText = await request.text();
        let body: any = {};
        try { body = bodyText ? JSON.parse(bodyText) : {}; } catch {}
        const dataId = id ?? body?.data?.id ?? body?.id;

        if (!type || !dataId) return new Response("ok"); // ack noisy pings

        // Verify HMAC signature BEFORE doing any work.
        const sigOk = verifyMpSignature({
          secret: webhookSecret,
          signatureHeader: request.headers.get("x-signature"),
          requestId: request.headers.get("x-request-id"),
          dataId: String(dataId),
        });
        if (!sigOk) {
          console.warn("[mp.webhook] invalid signature");
          return new Response("Unauthorized", { status: 401 });
        }

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
            const amount = Number(p.transaction_amount ?? 0);
            const update: Record<string, unknown> = {
              subscription_status: "active",
              current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
              last_payment_at: p.date_approved ?? new Date().toISOString(),
            };
            if (amount > 0) update.plan_price_ars = amount;
            await supabaseAdmin.from("organizations").update(update).eq("id", orgId);
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
