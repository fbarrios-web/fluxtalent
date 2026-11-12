import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HIRED_API_ORG_ID, HIRED_API_USER_ID, serializeHiredCandidate, type HiredApplication } from "./hired-candidates";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
}).strict();

export function validHiredApiKey(provided: string | null, expected: string | undefined) {
  if (!expected || expected.length < 32 || !provided || provided.length > 512) return false;
  return timingSafeEqual(createHash("sha256").update(provided).digest(), createHash("sha256").update(expected).digest());
}

export async function handleHiredCandidates(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "Vary": "X-API-Key", "X-Content-Type-Options": "nosniff" };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  const expected = process.env["HIRED_CANDIDATES_API_KEY"];
  if (!expected || expected.length < 32) return reply({ error: "API pendiente de configuración" }, 503);
  if (!validHiredApiKey(request.headers.get("X-API-Key"), expected)) return reply({ error: "Clave de acceso inválida" }, 401);
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse(Object.fromEntries(params));
  if (!parsed.success || params.size !== new Set(params.keys()).size) return reply({ error: "Parámetros inválidos. Usá limit (1–100) y cursor." }, 400);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The integration is pinned to this account and never accepts an organization from callers.
    const { data: profile, error: profileError } = await supabaseAdmin.from("profiles").select("org_id").eq("id", HIRED_API_USER_ID).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.org_id !== HIRED_API_ORG_ID) return reply({ error: "La cuenta de esta integración cambió; revisá su configuración" }, 503);
    let query = supabaseAdmin.from("applications")
      .select("id, org_id, vacancy_id, stage, first_name, last_name, email, phone, linkedin, ai_summary, application_events(type, payload, created_at)")
      .eq("org_id", HIRED_API_ORG_ID).eq("stage", "hired").order("id", { ascending: true }).limit(parsed.data.limit + 1);
    if (parsed.data.cursor) query = query.gt("id", parsed.data.cursor);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    const page = rows.slice(0, parsed.data.limit);
    const candidates = page.map((row) => serializeHiredCandidate(row as HiredApplication)).filter((row) => row !== null);
    return reply({ candidatos: candidates, cantidad: candidates.length, siguiente_cursor: rows.length > parsed.data.limit ? page.at(-1)?.id ?? null : null });
  } catch {
    return reply({ error: "No se pudieron consultar los candidatos" }, 500);
  }
}