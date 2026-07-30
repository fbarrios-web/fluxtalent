/**
 * Regla ÚNICA de acceso de escritura por estado de suscripción.
 * Se usa en el cliente (banner), en los server functions (crear vacante)
 * y en el endpoint público de postulaciones, para que no haya criterios
 * distintos según el camino.
 *
 * Reglas:
 * - trialing: acceso mientras `trial_ends_at` esté en el futuro.
 * - active: acceso mientras `current_period_end` esté en el futuro (o sea nulo).
 * - canceled: acceso hasta terminar el período ya pagado.
 * - past_due (cobro rechazado): 2 días de gracia (`grace_until`) mientras el
 *   proveedor reintenta el cobro.
 * - is_unlimited (cuentas internas / admin): siempre.
 */

export const GRACE_DAYS = 2;

export interface OrgBillingFields {
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  grace_until?: string | null;
  is_unlimited?: boolean | null;
}

const ts = (v: string | null | undefined) => (v ? new Date(v).getTime() : 0);

export function canWriteOrg(org: OrgBillingFields | null | undefined, now = Date.now()): boolean {
  if (!org) return false;
  if (org.is_unlimited) return true;
  const status = org.subscription_status ?? "";
  const trialEnds = ts(org.trial_ends_at);
  const periodEnds = ts(org.current_period_end);
  const graceEnds = ts(org.grace_until);

  if (status === "trialing") return trialEnds > now;
  if (status === "active") return !org.current_period_end || periodEnds > now;
  if (status === "canceled") return periodEnds > now;
  if (status === "past_due") return graceEnds > now;
  return false;
}

/** Estado "efectivo" para mostrar en UI (contempla vencimientos). */
export function effectiveStatus(org: OrgBillingFields | null | undefined, now = Date.now()) {
  if (!org) return "unknown" as const;
  const status = org.subscription_status ?? "";
  if (status === "trialing" && ts(org.trial_ends_at) <= now) return "trial_expired" as const;
  if (status === "active" && org.current_period_end && ts(org.current_period_end) <= now) return "subscription_expired" as const;
  if (status === "canceled" && ts(org.current_period_end) <= now) return "canceled_expired" as const;
  if (status === "past_due") return ts(org.grace_until) > now ? ("grace" as const) : ("past_due" as const);
  return status as "trialing" | "active" | "canceled";
}

/** Fecha hasta la cual dura la gracia por pago fallido. */
export function graceDeadline(from = Date.now()): string {
  return new Date(from + GRACE_DAYS * 86_400_000).toISOString();
}

export const BILLING_SELECT =
  "subscription_status, trial_ends_at, current_period_end, grace_until, is_unlimited";
