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
        const { resolveOrgId, applyApprovedPayment, applyFailedPayment } =
          await import("@/lib/billing-renew.server");

        async function fetchMP(path: string) {
          const r = await fetch(`https://api.mercadopago.com${path}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) {
            // 404 acá casi siempre significa que el token configurado pertenece a
            // otra cuenta de Mercado Pago que la que cobró: hay que loguearlo,
            // si no la activación falla en silencio.
            console.error(`[mp.webhook] MP fetch ${path} failed: ${r.status} ${await r.text().catch(() => "")}`);
            return null;
          }
          return r.json();
        }

        async function notifyConfirmation(orgId: string, plan: any, amount: number, periodEnd: string, paymentId: string) {
          try {
            const { data: owner } = await supabaseAdmin
              .from("profiles").select("id, full_name").eq("org_id", orgId).order("created_at", { ascending: true }).limit(1).maybeSingle();
            if (!owner?.id) return;
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(owner.id);
            const recipientEmail = authUser?.user?.email;
            if (!recipientEmail) return;
            const { dispatchTransactionalEmail } = await import("@/lib/email/dispatch.server");
            await dispatchTransactionalEmail({
              templateName: "subscription-confirmed",
              recipientEmail,
              templateData: { fullName: owner.full_name ?? undefined, planName: plan?.name, amountArs: amount, periodEnd },
              idempotencyKey: `sub-confirmed-${paymentId}`,
            });
          } catch (e) { console.error("[mp.webhook] email confirm failed", e); }
        }

        const { PLANS, planByPrice } = await import("@/lib/plans");

        if (type === "payment") {
          const p: any = await fetchMP(`/v1/payments/${dataId}`);
          if (!p) return new Response("ok");

          const preapprovalId =
            p.metadata?.preapproval_id ?? p.metadata?.preapprovalId ?? p.point_of_interaction?.transaction_data?.subscription_id ?? null;
          const { orgId, planIdRaw } = await resolveOrgId(supabaseAdmin, {
            externalReference: p.external_reference,
            preapprovalId,
            payerEmail: p.payer?.email,
          });
          if (!orgId) {
            console.error("[mp.webhook] no org for payment", dataId, p.external_reference, p.payer?.email);
            return new Response("ok");
          }

          const txAmount = Number(p.transaction_amount ?? 0);
          const planFromId = planIdRaw ? PLANS.find(x => x.id === planIdRaw) : undefined;
          const plan = planFromId ?? planByPrice(txAmount);

          if (p.status === "approved") {
            const { periodEnd, previousStatus } = await applyApprovedPayment(supabaseAdmin, {
              orgId,
              providerPaymentId: String(p.id),
              amountArs: txAmount,
              paidAt: p.date_approved ?? null,
              plan,
              preapprovalId,
              raw: { ...p, resolved_plan: plan.id },
              kind: previousActive(previousStatusPlaceholder) ? "renewal" : "checkout",
            });
            // Si la org tenía suscripción en USD, la cancelamos: una sola activa.
            try {
              const { cancelPaddleSubscription } = await import("@/lib/billing-provider.server");
              await cancelPaddleSubscription(supabaseAdmin, orgId);
            } catch (e) { console.error("[mp.webhook] paddle auto-cancel failed", e); }
            await notifyConfirmation(orgId, plan, txAmount, periodEnd, String(p.id));
            void previousStatus;
          } else if (["rejected", "cancelled", "refunded", "charged_back"].includes(p.status)) {
            await supabaseAdmin.from("payments").upsert({
              org_id: orgId,
              provider: "mercadopago",
              provider_payment_id: String(p.id),
              amount_ars: txAmount,
              status: p.status,
              paid_at: null,
              raw: p,
            }, { onConflict: "provider,provider_payment_id" });
            await applyFailedPayment(supabaseAdmin, { orgId, paymentId: String(p.id), status: p.status });
          }
        } else if (type === "subscription_authorized_payment" || type === "authorized_payment") {
          // COBRO RECURRENTE de una suscripción: es el evento que renueva el plan.
          const ap: any = await fetchMP(`/authorized_payments/${dataId}`);
          if (!ap) return new Response("ok");
          const preapprovalId = ap.preapproval_id ?? null;
          const pa: any = preapprovalId ? await fetchMP(`/preapproval/${preapprovalId}`) : null;
          const { orgId, planIdRaw } = await resolveOrgId(supabaseAdmin, {
            externalReference: ap.external_reference ?? pa?.external_reference,
            preapprovalId,
            payerEmail: pa?.payer_email,
          });
          if (!orgId) {
            console.error("[mp.webhook] no org for authorized_payment", dataId, preapprovalId);
            return new Response("ok");
          }

          const amount = Number(ap.transaction_amount ?? pa?.auto_recurring?.transaction_amount ?? 0);
          const plan = (planIdRaw ? PLANS.find(x => x.id === planIdRaw) : undefined) ?? planByPrice(amount);
          const status = ap.status ?? ap.payment?.status;
          const approved = status === "approved" || ap.payment?.status === "approved" || ap.payment?.status_detail === "accredited";

          if (approved) {
            const { periodEnd } = await applyApprovedPayment(supabaseAdmin, {
              orgId,
              providerPaymentId: String(ap.payment?.id ?? ap.id),
              amountArs: amount,
              paidAt: ap.date_created ?? null,
              plan,
              preapprovalId,
              nextPaymentDate: pa?.next_payment_date ?? null,
              raw: { ...ap, resolved_plan: plan.id },
              kind: "renewal",
            });
            await notifyConfirmation(orgId, plan, amount, periodEnd, String(ap.payment?.id ?? ap.id));
          } else if (["rejected", "cancelled", "recycling"].includes(String(status))) {
            await applyFailedPayment(supabaseAdmin, {
              orgId,
              paymentId: String(ap.payment?.id ?? ap.id),
              status: String(status),
            });
          }
        } else if (type === "preapproval" || type === "subscription_preapproval") {
          const pa: any = await fetchMP(`/preapproval/${dataId}`);
          if (!pa) return new Response("ok");
          const { orgId, planIdRaw } = await resolveOrgId(supabaseAdmin, {
            externalReference: pa.external_reference,
            preapprovalId: pa.id,
            payerEmail: pa.payer_email,
          });
          if (!orgId) {
            console.error("[mp.webhook] no org for preapproval", dataId, pa.external_reference);
            return new Response("ok");
          }
          const plan = planIdRaw ? PLANS.find(x => x.id === planIdRaw) : undefined;
          if (pa.status === "authorized") {
            // Fijamos el fin de período: sin esto, cancelar dejaba a la org sin
            // acceso al instante en vez de mantener el mes ya pagado.
            const { nextPeriodEnd } = await import("@/lib/billing-renew.server");
            const { data: cur } = await supabaseAdmin
              .from("organizations").select("current_period_end").eq("id", orgId).maybeSingle();
            const patch: Record<string, any> = {
              subscription_status: "active",
              mp_preapproval_id: pa.id,
              plan_currency: "ars",
              grace_until: null,
              current_period_end: pa.next_payment_date ?? nextPeriodEnd(cur?.current_period_end),
            };
            if (plan && plan.priceArs > 0) patch.plan_price_ars = plan.priceArs;
            await supabaseAdmin.from("organizations").update(patch as any).eq("id", orgId);
            await supabaseAdmin.from("activity_events").insert({
              org_id: orgId,
              event_type: "mp.preapproval_authorized",
              metadata: { preapproval_id: pa.id, plan_id: plan?.id, plan_name: plan?.name },
            });
          } else if (pa.status === "cancelled" || pa.status === "paused") {
            // Cancelación: mantenemos `current_period_end` para no cortar el acceso
            // del mes ya pagado.
            await supabaseAdmin
              .from("organizations")
              .update({ subscription_status: "canceled", mp_preapproval_id: pa.status === "cancelled" ? null : pa.id })
              .eq("id", orgId);
            await supabaseAdmin.from("activity_events").insert({
              org_id: orgId,
              event_type: "mp.preapproval_canceled",
              metadata: { preapproval_id: pa.id, status: pa.status },
            });
          }
        }

        return Response.json({ ok: true });
      },
      GET: async () => new Response("ok"),
    },
  },
});
