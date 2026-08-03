/**
 * Helpers server-only para activar / renovar la suscripción de una org a partir
 * de un pago de Mercado Pago (checkout inicial o cobro recurrente automático).
 *
 * Reglas:
 * - El período se extiende desde `current_period_end` si todavía está vigente
 *   (así una renovación anticipada no "regala" ni "come" días), y desde hoy si
 *   ya venció.
 * - Cualquier pago aprobado limpia `grace_until` y vuelve la org a `active`,
 *   incluso si estaba en `past_due` o `canceled` (reactivación automática).
 */

type Sb = any;

const MONTH_MS = 30 * 86_400_000;

export function nextPeriodEnd(currentEnd: string | null | undefined, from = Date.now()): string {
  const cur = currentEnd ? new Date(currentEnd).getTime() : 0;
  const base = cur > from ? cur : from;
  return new Date(base + MONTH_MS).toISOString();
}

/**
 * Resuelve el org_id de un evento de Mercado Pago probando, en orden:
 * external_reference ("<orgId>" o "<orgId>:<planId>"), el preapproval guardado
 * en la org, y por último el email del pagador.
 */
export async function resolveOrgId(
  supabaseAdmin: Sb,
  opts: { externalReference?: string | null; preapprovalId?: string | null; payerEmail?: string | null },
): Promise<{ orgId: string | null; planIdRaw?: string }> {
  const ref = String(opts.externalReference ?? "").trim();
  if (ref) {
    const [orgId, planIdRaw] = ref.split(":");
    if (orgId && /^[0-9a-f-]{36}$/i.test(orgId)) {
      const { data } = await supabaseAdmin.from("organizations").select("id").eq("id", orgId).maybeSingle();
      if (data?.id) return { orgId: data.id, planIdRaw };
    }
  }

  if (opts.preapprovalId) {
    const { data } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("mp_preapproval_id", String(opts.preapprovalId))
      .maybeSingle();
    if (data?.id) return { orgId: data.id };
  }

  const email = String(opts.payerEmail ?? "").trim().toLowerCase();
  if (email) {
    try {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const user = (list?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === email);
      if (user) {
        const { data: prof } = await supabaseAdmin.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
        if (prof?.org_id) return { orgId: prof.org_id };
      }
    } catch (e) {
      console.error("[resolveOrgId] email lookup failed", e);
    }
  }

  return { orgId: null };
}

/** Registra el pago (idempotente) y deja la org activa con el período extendido. */
export async function applyApprovedPayment(
  supabaseAdmin: Sb,
  args: {
    orgId: string;
    providerPaymentId: string;
    amountArs: number;
    paidAt?: string | null;
    plan?: { id: string; name: string; priceArs: number } | null;
    preapprovalId?: string | null;
    nextPaymentDate?: string | null;
    raw?: any;
    kind?: "checkout" | "renewal";
  },
) {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("current_period_end, plan_price_ars, subscription_status")
    .eq("id", args.orgId)
    .maybeSingle();

  const periodEnd = args.nextPaymentDate
    ? new Date(args.nextPaymentDate).toISOString()
    : nextPeriodEnd(org?.current_period_end);

  await supabaseAdmin.from("payments").upsert(
    {
      org_id: args.orgId,
      provider: "mercadopago",
      provider_payment_id: String(args.providerPaymentId),
      amount_ars: args.amountArs,
      status: "approved",
      paid_at: args.paidAt ?? new Date().toISOString(),
      raw: args.raw ?? null,
    },
    { onConflict: "provider,provider_payment_id" },
  );

  const patch: Record<string, any> = {
    subscription_status: "active",
    current_period_end: periodEnd,
    last_payment_at: args.paidAt ?? new Date().toISOString(),
    plan_currency: "ars",
    grace_until: null,
  };
  if (args.plan && args.plan.priceArs > 0) patch.plan_price_ars = args.plan.priceArs;
  else if (args.amountArs > 0 && !org?.plan_price_ars) patch.plan_price_ars = args.amountArs;
  if (args.preapprovalId) patch.mp_preapproval_id = String(args.preapprovalId);

  const { error } = await supabaseAdmin.from("organizations").update(patch).eq("id", args.orgId);
  if (error) console.error("[applyApprovedPayment] org update failed:", error.message);

  await supabaseAdmin.from("activity_events").insert({
    org_id: args.orgId,
    event_type: args.kind === "renewal" ? "mp.subscription_renewed" : "mp.payment_approved",
    metadata: {
      payment_id: String(args.providerPaymentId),
      amount: args.amountArs,
      plan_id: args.plan?.id ?? null,
      period_end: periodEnd,
      previous_status: org?.subscription_status ?? null,
    },
  });

  return { periodEnd, previousStatus: org?.subscription_status ?? null };
}

/** Cobro rechazado: pasa la org a past_due con ventana de gracia. */
export async function applyFailedPayment(
  supabaseAdmin: Sb,
  args: { orgId: string; paymentId: string; status: string },
) {
  const { graceDeadline } = await import("@/lib/entitlement");
  const graceUntil = graceDeadline();
  await supabaseAdmin
    .from("organizations")
    .update({ subscription_status: "past_due", grace_until: graceUntil })
    .eq("id", args.orgId);
  await supabaseAdmin.from("activity_events").insert({
    org_id: args.orgId,
    event_type: "payment.failed",
    metadata: { provider: "mercadopago", payment_id: args.paymentId, status: args.status, grace_until: graceUntil },
  });
}
