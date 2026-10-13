export function isFreddoEntry(hostname: string, search: string): boolean {
  return hostname === "freddo.fluxtalent.com.ar"
    || hostname === "www.freddo.fluxtalent.com.ar"
    || new URLSearchParams(search).get("org") === "freddo";
}