// Detección de superposición de horarios entre vacantes / agendas (etapas).

export type CandidateSlot = { start: string; end: string };

export function zonedToUtc(localISO: string, timeZone: string): Date {
  const [date, time] = localISO.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(asUtc));
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(asUtc - (local - asUtc));
}

export type RuleInput = {
  weekdays: number[];
  startTime: string;
  endTime: string;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
};

const WEEKDAY_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

export function expandRulesToSlots(
  rules: RuleInput[],
  durationMinutes: number,
  tz: string,
  days: number,
): CandidateSlot[] {
  const out: CandidateSlot[] = [];
  const now = new Date();
  for (let d = 0; d < days; d++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + d);
    const longName = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(day);
    const weekday = WEEKDAY_MAP[longName] ?? 0;
    const ymd = new Intl.DateTimeFormat("sv-SE", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
    for (const r of rules) {
      if (!r.weekdays.includes(weekday)) continue;
      if (r.effectiveFrom && ymd < r.effectiveFrom) continue;
      if (r.effectiveUntil && ymd > r.effectiveUntil) continue;
      const startUtc = zonedToUtc(`${ymd}T${r.startTime}`, tz).getTime();
      const endUtc = zonedToUtc(`${ymd}T${r.endTime}`, tz).getTime();
      let cursor = startUtc;
      while (cursor + durationMinutes * 60_000 <= endUtc) {
        if (cursor > Date.now() + 3600_000) {
          out.push({ start: new Date(cursor).toISOString(), end: new Date(cursor + durationMinutes * 60_000).toISOString() });
        }
        cursor += durationMinutes * 60_000;
      }
    }
  }
  return out;
}

export type Overlap = {
  start: string;
  vacancyTitle: string;
  stage: string;
  sameVacancy: boolean;
};

/** Busca choques entre los slots propuestos y los slots futuros de otras vacantes/etapas de la organización. */
export async function findOverlaps(
  supabase: any,
  opts: { orgId: string; vacancyId: string; stage: string; candidates: CandidateSlot[] },
): Promise<Overlap[]> {
  if (!opts.candidates.length) return [];
  const starts = opts.candidates.map(c => new Date(c.start).getTime()).sort((a, b) => a - b);
  const ends = opts.candidates.map(c => new Date(c.end).getTime()).sort((a, b) => a - b);
  const rangeStart = new Date(starts[0]).toISOString();
  const rangeEnd = new Date(ends[ends.length - 1]).toISOString();

  const { data: existing } = await supabase
    .from("availability_slots")
    .select("start_at, end_at, stage, vacancy_id, status")
    .eq("org_id", opts.orgId)
    .neq("status", "blocked")
    .gte("start_at", rangeStart)
    .lte("start_at", rangeEnd)
    .limit(3000);

  const others = (existing ?? []).filter(
    (s: any) => !(s.vacancy_id === opts.vacancyId && s.stage === opts.stage),
  );
  if (!others.length) return [];

  const vacancyIds = Array.from(new Set(others.map((s: any) => s.vacancy_id)));
  const { data: vacs } = await supabase.from("vacancies").select("id, title").in("id", vacancyIds);
  const titles = new Map<string, string>((vacs ?? []).map((v: any) => [v.id, v.title]));

  const overlaps: Overlap[] = [];
  const seen = new Set<string>();
  for (const c of opts.candidates) {
    const cs = new Date(c.start).getTime();
    const ce = new Date(c.end).getTime();
    for (const s of others) {
      const os = new Date(s.start_at).getTime();
      const oe = new Date(s.end_at).getTime();
      if (cs < oe && os < ce) {
        const key = `${c.start}|${s.vacancy_id}|${s.stage}`;
        if (seen.has(key)) continue;
        seen.add(key);
        overlaps.push({
          start: c.start,
          vacancyTitle: titles.get(s.vacancy_id) ?? "Otra vacante",
          stage: s.stage,
          sameVacancy: s.vacancy_id === opts.vacancyId,
        });
      }
    }
  }
  overlaps.sort((a, b) => a.start.localeCompare(b.start));
  return overlaps;
}
