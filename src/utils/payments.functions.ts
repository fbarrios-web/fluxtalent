import { createServerFn } from "@tanstack/react-start";
import { gatewayFetch, getPaddleClient, planFromPriceId, type PaddleEnv } from "@/lib/paddle.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const response = await gatewayFetch(data.environment, `/prices?external_id=${encodeURIComponent(data.priceId)}`);
    const result = await response.json();
    if (!result.data?.length) throw new Error("Price not found: " + data.priceId);
    return result.data[0].id as string;
  });

/** Change plan on an existing Paddle subscription (upgrade immediate, downgrade next cycle). */
export const changePaddlePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { newPriceId: 'starter_monthly_usd' | 'pro_monthly_usd' | 'enterprise_monthly_usd' }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();
    if (!profile?.org_id) throw new Error("Sin organización");

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id, price_id, environment")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.paddle_subscription_id) throw new Error("No hay suscripción USD activa");

    const currentTier = planFromPriceId(sub.price_id)?.priceArs ?? 0;
    const newTier = planFromPriceId(data.newPriceId)?.priceArs ?? 0;
    const isUpgrade = newTier > currentTier;

    // Resolve new Paddle price id
    const env = sub.environment as PaddleEnv;
    const priceResp = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(data.newPriceId)}`);
    const priceJson = await priceResp.json();
    const paddlePriceId = priceJson.data?.[0]?.id;
    if (!paddlePriceId) throw new Error("Precio Paddle no encontrado");

    const paddle = getPaddleClient(env);
    await paddle.subscriptions.update(sub.paddle_subscription_id, {
      items: [{ priceId: paddlePriceId, quantity: 1 }],
      prorationBillingMode: isUpgrade ? "prorated_immediately" : "prorated_next_billing_period",
    } as any);

    return { ok: true, applied: isUpgrade ? "immediate" : "next_cycle" as const };
  });

/** Open Paddle customer portal so user can update payment method or cancel. */
export const getPaddlePortalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();
    if (!profile?.org_id) throw new Error("Sin organización");

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id, paddle_customer_id, environment")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.paddle_customer_id) throw new Error("Sin cliente Paddle");

    const paddle = getPaddleClient(sub.environment as PaddleEnv);
    const portal = await paddle.customerPortalSessions.create(
      sub.paddle_customer_id,
      sub.paddle_subscription_id ? [sub.paddle_subscription_id] : [],
    );
    return { url: portal.urls.general.overview as string };
  });
