// Edad automática a partir del dato fijo tipo fecha "Fecha de nacimiento".
export function birthDateFieldId(fields: any[] | null | undefined): string | null {
  const dates = (fields ?? []).filter((f: any) => f?.type === "date");
  const f = dates.find((x: any) => /nac/i.test(String(x.label ?? ""))) ?? null;
  return f ? String(f.id) : null;
}

function normalizeDate(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(s);
  if (!m) return null;
  let y = +m[3];
  if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function ageFromDate(value: unknown, today = new Date()): number | null {
  const n = normalizeDate(value);
  const m = n ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(n) : null;
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--;
  return age >= 0 && age < 120 ? age : null;
}

// Edad de una postulación: primero el dato personal; si no, la pregunta filtro
// "Fecha de nacimiento" (CVs cargados antes de los datos fijos).
export function applicationAge(app: any, birthFieldId: string | null): number | null {
  if (birthFieldId) {
    const a = ageFromDate(app?.sensitive_answers?.[birthFieldId]);
    if (a != null) return a;
  }
  const sa = app?.screening_answers ?? {};
  for (const k of Object.keys(sa)) {
    if (/nac/i.test(k)) {
      const a = ageFromDate(sa[k]);
      if (a != null) return a;
    }
  }
  return null;
}
