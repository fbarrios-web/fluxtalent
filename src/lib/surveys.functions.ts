import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKETS = [10, 30, 50] as const;
type Bucket = (typeof BUCKETS)[number];

/** Decide which bucket (if any) the user should be prompted with right now. */
export const getDueSurvey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const createdAt = u?.user?.created_at;
    if (!createdAt) return { dueBucket: null as Bucket | null, ageDays: 0 };
    const ageDays = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);

    const reached = BUCKETS.filter(b => ageDays >= b);
    if (reached.length === 0) return { dueBucket: null as Bucket | null, ageDays };

    const { data: existing } = await sb
      .from("satisfaction_surveys" as any)
      .select("bucket")
      .eq("user_id", context.userId);
    const filled = new Set((existing ?? []).map((r: any) => Number(r.bucket)));
    const due = reached.find(b => !filled.has(b)) ?? null;
    return { dueBucket: due as Bucket | null, ageDays };
  });

const SubmitSchema = z.object({
  bucket: z.union([z.literal(10), z.literal(30), z.literal(50)]),
  nps: z.number().int().min(0).max(10),
  comments: z.string().max(2000).optional().nullable(),
});

export const submitSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmitSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: prof } = await sb.from("profiles").select("org_id").eq("id", context.userId).maybeSingle();
    const { error } = await sb.from("satisfaction_surveys" as any).insert({
      user_id: context.userId,
      org_id: (prof as any)?.org_id ?? null,
      bucket: data.bucket,
      nps: data.nps,
      comments: data.comments ?? null,
    } as any);
    if (error && !/duplicate/i.test(error.message)) {
      throw new Error("No se pudo guardar la encuesta.");
    }
    return { ok: true };
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acción solo permitida para administradores.");
}

export const adminListSurveys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("satisfaction_surveys" as any)
      .select("id, user_id, org_id, bucket, nps, comments, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const orgIds = Array.from(new Set((rows ?? []).map((r: any) => r.org_id).filter(Boolean)));
    const [{ data: profs }, { data: orgs }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      orgIds.length
        ? supabaseAdmin.from("organizations").select("id, name").in("id", orgIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
    const omap = new Map((orgs ?? []).map((o: any) => [o.id, o.name]));

    const enriched = (rows ?? []).map((r: any) => ({
      ...r,
      user_name: pmap.get(r.user_id) ?? "—",
      org_name: r.org_id ? omap.get(r.org_id) ?? "—" : "—",
    }));

    // Aggregates
    const byBucket: Record<number, { count: number; avg: number; promoters: number; passives: number; detractors: number }> = {};
    for (const b of [10, 30, 50]) {
      const subset = enriched.filter(r => Number(r.bucket) === b);
      const count = subset.length;
      const avg = count ? subset.reduce((s, r) => s + Number(r.nps), 0) / count : 0;
      const promoters = subset.filter(r => r.nps >= 9).length;
      const passives = subset.filter(r => r.nps >= 7 && r.nps <= 8).length;
      const detractors = subset.filter(r => r.nps <= 6).length;
      byBucket[b] = { count, avg: Math.round(avg * 10) / 10, promoters, passives, detractors };
    }
    const total = enriched.length;
    const npsScore = total
      ? Math.round(((enriched.filter(r => r.nps >= 9).length - enriched.filter(r => r.nps <= 6).length) / total) * 100)
      : 0;

    return { rows: enriched, byBucket, total, npsScore };
  });
