import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Returns full subscription snapshot for current user's org. */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).single();
    if (!profile?.org_id) return null;

    const { data: org, error } = await supabase
      .from("organizations")
      .select("id, name, subscription_status, trial_ends_at, plan_price_ars, current_period_end, last_payment_at, mp_preapproval_id")
      .eq("id", profile.org_id)
      .single();
    if (error || !org) return null;


    const now = Date.now();
    const trialEnds = org.trial_ends_at ? new Date(org.trial_ends_at).getTime() : 0;
    const periodEnds = org.current_period_end ? new Date(org.current_period_end).getTime() : 0;
    const daysLeft =
      org.subscription_status === "trialing"
        ? Math.max(0, Math.ceil((trialEnds - now) / 86_400_000))
        : org.subscription_status === "active"
          ? Math.max(0, Math.ceil((periodEnds - now) / 86_400_000))
          : 0;
    const canWrite =
      (org.subscription_status === "trialing" && trialEnds > now) ||
      (org.subscription_status === "active" && (!org.current_period_end || periodEnds > now));

    return { ...org, daysLeft, canWrite };
  });

/** Create a Mercado Pago preapproval (suscripción mensual) and return checkout URL. */
export const createPreapproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) throw new Error("Mercado Pago no está configurado todavía. Pedile al admin que cargue MERCADOPAGO_ACCESS_TOKEN.");

    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).single();
    if (!profile?.org_id) throw new Error("No org");
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, plan_price_ars")
      .eq("id", profile.org_id)
      .single();
    if (!org) throw new Error("Org no encontrada");

    const origin = process.env.PUBLIC_APP_URL || "https://project--f6700845-18a2-42a5-b8fb-c9d0dd25ca9a.lovable.app";
    const email = (claims as any).email ?? `org+${org.id}@flux.app`;
    const amount = Number(org.plan_price_ars);

    const body = {
      reason: `FLUX Talent — ${org.name}`,
      external_reference: org.id,
      payer_email: email,
      back_url: `${origin}/app/subscription?ok=1`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amount,
        currency_id: "ARS",
      },
      status: "pending",
    };

    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: any = await res.json();
    if (!res.ok) throw new Error(json?.message ?? "Mercado Pago error");

    await supabase.from("organizations").update({ mp_preapproval_id: json.id }).eq("id", org.id);
    return { init_point: json.init_point as string, id: json.id as string };
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).single();
    if (!profile?.org_id) throw new Error("No org");
    const { data: org } = await supabase.from("organizations").select("mp_preapproval_id").eq("id", profile.org_id).single();
    if (org?.mp_preapproval_id && token) {
      await fetch(`https://api.mercadopago.com/preapproval/${org.mp_preapproval_id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
    }
    await supabase.from("organizations").update({ subscription_status: "canceled" }).eq("id", profile.org_id);
    return { ok: true };
  });

/** Log a navigation/usage event from the client. */
export const logEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      event_type: z.string().min(1).max(80),
      metadata: z.record(z.string(), z.any()).optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).single();
    await supabase.from("activity_events").insert({
      org_id: profile?.org_id ?? null,
      user_id: userId,
      event_type: data.event_type,
      metadata: data.metadata ?? {},
    });
    return { ok: true };
  });
