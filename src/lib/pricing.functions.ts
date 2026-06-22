import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type PlanPricingRow = {
  plan_id: string;
  base_price_ars: number;
  discount_pct: number;
};

/** Public: list plan pricing overrides for everyone (landing, subscription, etc). */
export const getPlanPricing = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.from("plan_pricing").select("plan_id, base_price_ars, discount_pct");
  if (error) throw error;
  return (data ?? []) as PlanPricingRow[];
});

/** Admin: upsert pricing for a plan. */
export const adminUpdatePlanPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      plan_id: z.string().min(2).max(40),
      base_price_ars: z.number().int(),
      discount_pct: z.number().int().min(0).max(100),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("plan_pricing")
      .upsert({ plan_id: data.plan_id, base_price_ars: data.base_price_ars, discount_pct: data.discount_pct, updated_at: new Date().toISOString() } as never);
    if (error) throw error;
    return { ok: true };
  });
