/**
 * Promoción "Starter free por 1 mes".
 *
 * Toda organización creada entre el 11/09 y el 30/09 (hora Argentina) accede
 * automáticamente al plan Starter sin costo por un mes corrido, contado desde
 * la fecha en que activa su primera vacante. Al terminar el mes se cae la
 * licencia y la cuenta queda en modo solo-lectura hasta que se suscriba.
 */

export const PROMO_PLAN_ID = "starter" as const;

/** Ventana de alta de cuentas elegibles (11/09 00:00 a 30/09 23:59:59, UTC-3). */
export const PROMO_SIGNUP_FROM = "2026-09-11T03:00:00.000Z";
export const PROMO_SIGNUP_UNTIL = "2026-10-01T02:59:59.999Z";

export interface PromoFields {
  promo_plan_id?: string | null;
  promo_started_at?: string | null;
  promo_ends_at?: string | null;
  promo_ack_at?: string | null;
}

export const PROMO_SELECT = "promo_plan_id, promo_started_at, promo_ends_at, promo_ack_at";

/** Suma un mes calendario. */
export function addOneMonth(from: Date): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 1);
  // Si el mes destino no tiene ese día (31 -> 30), Date lo desborda: lo corregimos.
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d;
}

export function isPromoSignupWindow(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  return t >= new Date(PROMO_SIGNUP_FROM).getTime() && t <= new Date(PROMO_SIGNUP_UNTIL).getTime();
}

export function isPromoActive(org: PromoFields | null | undefined, now = Date.now()): boolean {
  if (!org?.promo_plan_id || !org.promo_ends_at) return false;
  return new Date(org.promo_ends_at).getTime() > now;
}

export function promoDaysLeft(org: PromoFields | null | undefined, now = Date.now()): number {
  if (!org?.promo_ends_at) return 0;
  return Math.max(0, Math.ceil((new Date(org.promo_ends_at).getTime() - now) / 86_400_000));
}
