// Catálogo central de planes de FLUX Talent.
// El precio del plan activo de cada org se guarda en organizations.plan_price_ars,
// así que matcheamos por precio para inferir el plan actual.

export type PlanId = "free" | "starter" | "pro" | "enterprise" | "custom";

export interface Plan {
  id: PlanId;
  name: string;
  priceArs: number; // 0 = gratuito; -1 = a medida
  originalPriceArs?: number; // precio "de lista" para mostrar descuento
  tagline: string;
  maxVacancies: number; // -1 = ilimitado
  maxCvsPerMonth: number; // -1 = ilimitado
  features: string[];
  highlighted?: boolean;
  contactOnly?: boolean;
}

export const TRIAL_DAYS = 15;

/** Links de Mercado Pago "Planes de suscripción" (no-code). MP gestiona el cobro recurrente. */
export const MP_PLAN_LINKS: Partial<Record<PlanId, string>> = {
  starter: "https://mpago.la/1Keo3Qf",
  pro: "https://mpago.la/1K1ThMx",
  enterprise: "https://mpago.la/1PPH9TE",
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceArs: 0,
    tagline: "Free por 15 días",
    maxVacancies: 1,
    maxCvsPerMonth: 20,
    features: [
      "1 vacante activa",
      "20 CVs analizados con IA",
      "Acceso al proceso end-to-end",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    priceArs: 24000,
    originalPriceArs: 30000,
    tagline: "Ideal para reclutadores freelancers",
    maxVacancies: 5,
    maxCvsPerMonth: 200,
    features: [
      "Hasta 5 vacantes activas",
      "200 CVs analizados con IA",
      "Acceso al proceso end-to-end",
      "Soporte por mails (SLA 72hs)",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceArs: 48000,
    originalPriceArs: 60000,
    tagline: "Ideal para consultoras y áreas de Talento con flujo constante.",
    maxVacancies: 20,
    maxCvsPerMonth: 1000,
    highlighted: true,
    features: [
      "Hasta 20 vacantes activas",
      "1.000 CVs analizados con IA",
      "Acceso al proceso end-to-end",
      "Soporte prioritario (SLA 48hs)",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceArs: 96000,
    originalPriceArs: 120000,
    tagline: "Volumen alto, multi-equipo y soporte dedicado.",
    maxVacancies: -1,
    maxCvsPerMonth: 1000,
    features: [
      "Vacantes ilimitadas",
      "1.000 CVs analizados con IA",
      "Acceso al proceso end-to-end",
      "Soporte prioritario (SLA 24hs)",
    ],
  },
  {
    id: "custom",
    name: "Custom",
    priceArs: -1,
    tagline: "Todo lo de Enterprise + integraciones e informes a medida.",
    maxVacancies: -1,
    maxCvsPerMonth: -1,
    contactOnly: true,
    features: [
      "Todo lo del plan Enterprise",
      "Integraciones personalizadas",
      "Informes automáticos a medida",
      "Workflows hechos para tu equipo",
      "Contacto directo: soporte@fluxtalent.com.ar",
    ],
  },
];

export function planByPrice(price: number | string | null | undefined): Plan {
  const p = Number(price ?? 0);
  // Legacy price mapping for backward compatibility
  if (p === 0) return PLANS.find(x => x.id === "free")!;
  if (p === 20000 || p === 24000) return PLANS.find(x => x.id === "starter")!;
  if (p === 45000 || p === 48000) return PLANS.find(x => x.id === "pro")!;
  if (p === 90000 || p === 96000) return PLANS.find(x => x.id === "enterprise")!;
  return PLANS.find(x => x.priceArs === p && !x.contactOnly) ?? PLANS[1];
}

export function formatLimit(n: number): string {
  return n === -1 ? "Ilimitado" : n.toLocaleString("es-AR");
}

export function formatArs(n: number): string {
  if (n === -1) return "A medida";
  if (n === 0) return "Gratis";
  return `ARS ${n.toLocaleString("es-AR")}`;
}

export type PricingOverride = { plan_id: string; base_price_ars: number; discount_pct: number };

/** Returns PLANS with priceArs / originalPriceArs overridden from DB pricing overrides. */
export function mergePlanOverrides(overrides: PricingOverride[] | null | undefined): Plan[] {
  const byId = new Map((overrides ?? []).map(o => [o.plan_id, o] as const));
  return PLANS.map(p => {
    const o = byId.get(p.id);
    if (!o) return p;
    const base = Number(o.base_price_ars);
    const disc = Math.max(0, Math.min(100, Number(o.discount_pct ?? 0)));
    if (base < 0) return { ...p, priceArs: -1, originalPriceArs: undefined };
    const final = Math.round(base * (1 - disc / 100));
    return {
      ...p,
      priceArs: final,
      originalPriceArs: disc > 0 ? base : undefined,
    };
  });
}


