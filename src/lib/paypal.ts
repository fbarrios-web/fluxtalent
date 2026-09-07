// Configuración pública de PayPal (suscripciones en USD).
// El client-id es público: se usa para cargar el SDK en el navegador.

import type { PlanId } from "@/lib/plans";

export const PAYPAL_CLIENT_ID =
  "BAAAEgQpgarrvM5Yia9ogEr4pYY9mT69IN0P4jJjrJ2-YoEfuC-X-fq0e5Nghs9Bc2wS1a_MyZfxDzGOrc";

export const PAYPAL_PLAN_IDS: Partial<Record<PlanId, string>> = {
  starter: "P-1K4732998K7861738NKPMKSY",
  pro: "P-7H0322885X4933106NKPMMDY",
  enterprise: "P-3C707033BU0928302NKPMMZA",
};

export type PaypalPlanId = "starter" | "pro" | "enterprise";
