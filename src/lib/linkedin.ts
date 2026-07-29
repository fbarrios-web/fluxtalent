// Normalización y validación de URLs de LinkedIn.
// Acepta "www.linkedin.com/in/xxx", "linkedin.com/in/xxx", "@xxx" o el usuario suelto.

export function normalizeLinkedin(raw?: string | null): string | null {
  if (!raw) return null;
  let v = String(raw).trim();
  if (!v) return null;
  v = v.replace(/\s+/g, "");
  v = v.replace(/^@+/, "");

  // Sin protocolo → agregarlo
  if (!/^https?:\/\//i.test(v)) {
    if (/^(www\.)?([a-z]{2,3}\.)?linkedin\.com\//i.test(v)) {
      v = "https://" + v;
    } else if (/^[A-Za-z0-9\-_%.]+$/.test(v)) {
      v = "https://www.linkedin.com/in/" + v;
    } else {
      return null;
    }
  }

  try {
    const u = new URL(v);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    u.protocol = "https:";
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function isValidLinkedin(raw?: string | null): boolean {
  if (!raw || !String(raw).trim()) return true; // opcional
  return normalizeLinkedin(raw) !== null;
}
