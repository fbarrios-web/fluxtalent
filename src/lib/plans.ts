// Catálogo central de planes de FLUX Talent.
// El precio del plan activo de cada org se guarda en organizations.plan_price_ars,
// así que matcheamos por precio para inferir el plan actual.

export type PlanId = "starter" | "pro" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  priceArs: number;
  tagline: string;
  maxVacancies: number; // -1 = ilimitado
  maxCvsPerMonth: number; // -1 = ilimitado
  features: string[];
  highlighted?: boolean;
}

export const TRIAL_DAYS = 15;

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceArs: 20000,
    tagline: "Ideal para equipos chicos que arrancan a profesionalizar su reclutamiento.",
    maxVacancies: 5,
    maxCvsPerMonth: 200,
    features: [
      "Hasta 5 vacantes activas",
      "200 CVs / mes con IA",
      "Pipeline Kanban",
      "Emails con tu marca",
      "Soporte por email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceArs: 45000,
    tagline: "Para consultoras y áreas de Talento con flujo constante.",
    maxVacancies: 20,
    maxCvsPerMonth: 1000,
    highlighted: true,
    features: [
      "Hasta 20 vacantes activas",
      "1.000 CVs / mes con IA",
      "Coordinación automática de entrevistas (Meet)",
      "Scorecards estructurados",
      "Soporte prioritario",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceArs: 90000,
    tagline: "Volumen alto, multi-equipo y soporte dedicado.",
    maxVacancies: -1,
    maxCvsPerMonth: -1,
    features: [
      "Vacantes ilimitadas",
      "CVs ilimitados",
      "Multi-organización y roles avanzados",
      "Onboarding dedicado",
      "SLA y soporte 24×5",
    ],
  },
];

export function planByPrice(price: number | string | null | undefined): Plan {
  const p = Number(price ?? 0);
  return PLANS.find(x => x.priceArs === p) ?? PLANS[0];
}

export function formatLimit(n: number): string {
  return n === -1 ? "Ilimitado" : n.toLocaleString("es-AR");
}

export function formatArs(n: number): string {
  return `ARS ${n.toLocaleString("es-AR")}`;
}
