// Helper para el link público de una vacante.
// Si la organización tiene subdominio propio (plan Custom) y la vacante se creó
// después de activarlo (vacancies.public_host), el link usa ese subdominio.
// Las vacantes anteriores mantienen el dominio general.

export const MAIN_APP_HOST = "fluxtalent.com.ar";

export function vacancyPublicUrl(vacancy: { public_slug: string; public_host?: string | null }): string {
  if (vacancy.public_host) return `https://${vacancy.public_host}/apply/${vacancy.public_slug}`;
  const origin = typeof window !== "undefined" ? window.location.origin : `https://${MAIN_APP_HOST}`;
  return `${origin}/apply/${vacancy.public_slug}`;
}

/** Host del subdominio de una org, si tiene la función activa. */
export function orgSubdomainHost(org: { subdomain?: string | null; custom_features?: any }): string | null {
  const enabled = org?.custom_features?.subdomain === true;
  if (!enabled || !org.subdomain) return null;
  return `${org.subdomain}.${MAIN_APP_HOST}`;
}
