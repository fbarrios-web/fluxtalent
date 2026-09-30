// Edad automática a partir del dato fijo tipo fecha "Fecha de nacimiento".
export function birthDateFieldId(fields: any[] | null | undefined): string | null {
  const dates = (fields ?? []).filter((f: any) => f?.type === "date");
  const f = dates.find((x: any) => /nac/i.test(String(x.label ?? ""))) ?? null;
  return f ? String(f.id) : null;
}

export function ageFromDate(value: unknown, today = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--;
  return age >= 0 && age < 120 ? age : null;
}
