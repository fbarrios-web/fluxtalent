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
          // external_reference puede ser "<orgId>" o "<orgId>:<planId>"
          const ref = String(p.external_reference ?? "");
          if (!ref) return new Response("ok");
          const [orgId, planIdRaw] = ref.split(":");
          if (!orgId) return new Response("ok");

          // Resolver plan desde el catálogo (autoritativo). Fallback: matchear por precio.
          const { PLANS, planByPrice } = await import("@/lib/plans");
          const txAmount = Number(p.transaction_amount ?? 0);
          const planFromId = planIdRaw ? PLANS.find(x => x.id === planIdRaw) : undefined;
          const plan = planFromId ?? planByPrice(txAmount);

          await supabaseAdmin.from("payments").upsert({
            org_id: orgId,
            provider: "mercadopago",
            provider_payment_id: String(p.id),
            amount_ars: txAmount,
            status: p.status,
            paid_at: p.date_approved ?? null,
            raw: { ...p, resolved_plan: plan.id },
          }, { onConflict: "provider,provider_payment_id" });

          if (p.status === "approved") {
            const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();
            const update: { subscription_status: "active"; current_period_end: string; last_payment_at: string; plan_price_ars: number } = {
              subscription_status: "active",
              current_period_end: periodEnd,
              last_payment_at: p.date_approved ?? new Date().toISOString(),
              plan_price_ars: plan.priceArs > 0 ? plan.priceArs : txAmount,
            };
            await supabaseAdmin.from("organizations").update(update).eq("id", orgId);
            await supabaseAdmin.from("activity_events").insert({
              org_id: orgId,
              event_type: "mp.payment_approved",
              metadata: { amount: txAmount, plan_id: plan.id, plan_name: plan.name },
            });
            // Send subscription confirmation email to org owner
            try {
              const { data: owner } = await supabaseAdmin
                .from("profiles").select("id, full_name").eq("org_id", orgId).order("created_at", { ascending: true }).limit(1).maybeSingle();
              const userId = owner?.id;
              const fullName = owner?.full_name ?? undefined;
              if (userId) {
                const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
                const recipientEmail = authUser?.user?.email;
                if (recipientEmail) {
                  const { dispatchTransactionalEmail } = await import("@/lib/email/dispatch.server");
                  await dispatchTransactionalEmail({
                    templateName: "subscription-confirmed",
                    recipientEmail,
                    templateData: { fullName, planName: plan.name, amountArs: txAmount, periodEnd },
                    idempotencyKey: `sub-confirmed-${p.id}`,
                  });
                }
              }
            } catch (e) { console.error("[mp.webhook] email confirm failed", e); }
          } else if (["rejected", "cancelled", "refunded"].includes(p.status)) {
            await supabaseAdmin.from("organizations").update({ subscription_status: "past_due" }).eq("id", orgId);
          }
        } else if (type === "preapproval" || type === "subscription_preapproval") {
          const pa: any = await fetchMP(`/preapproval/${dataId}`);
          if (!pa) return new Response("ok");
          const ref = String(pa.external_reference ?? "");
          const [orgId, planIdRaw] = ref.split(":");
          if (!orgId) return new Response("ok");
          const { PLANS } = await import("@/lib/plans");
          const plan = planIdRaw ? PLANS.find(x => x.id === planIdRaw) : undefined;
          if (pa.status === "authorized") {
            const patch: { subscription_status: "active"; mp_preapproval_id: string; plan_price_ars?: number } = {
              subscription_status: "active",
              mp_preapproval_id: pa.id,
            };
            if (plan && plan.priceArs > 0) patch.plan_price_ars = plan.priceArs;
            await supabaseAdmin.from("organizations").update(patch).eq("id", orgId);
            await supabaseAdmin.from("activity_events").insert({
              org_id: orgId,
              event_type: "mp.preapproval_authorized",
              metadata: { preapproval_id: pa.id, plan_id: plan?.id, plan_name: plan?.name },
            });
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
