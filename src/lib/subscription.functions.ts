import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { MP_PLAN_LINKS, PLANS, type PlanId } from "@/lib/plans";
import { canWriteOrg, effectiveStatus } from "@/lib/entitlement";

async function createMissingWorkspace(supabaseAdmin: any, userId: string) {
  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
  const user = userRes?.user;
  const email = user?.email ?? "";
  const meta = (user?.user_metadata ?? {}) as Record<string, string>;

  const { data: newOrg, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: meta.org_name || "Mi empresa",
      trial_ends_at: new Date(Date.now() + 15 * 86_400_000).toISOString(),
      subscription_status: "trialing",
      plan_price_ars: 0,
    })
    .select("id")
    .single();
  if (orgErr) throw orgErr;

  const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    org_id: newOrg.id,
    display_name: meta.display_name || email.split("@")[0] || "Usuario",
  });
  if (profileErr) throw profileErr;

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "recruiter" }, { onConflict: "user_id,role" });

  return newOrg.id as string;
}

async function getOrCreateOrgId(supabase: any, userId: string) {
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();
  if (profile?.org_id) return profile.org_id as string;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: adminProfile } = await supabaseAdmin.from("profiles").select("org_id").eq("id", userId).maybeSingle();
  if (adminProfile?.org_id) return adminProfile.org_id as string;

  return createMissingWorkspace(supabaseAdmin, userId);
}

/** Returns full subscription snapshot for current user's org. */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrCreateOrgId(supabase, userId);

    const { data: org, error } = await supabase
      .from("organizations")
      .select("id, name, subscription_status, trial_ends_at, plan_price_ars, current_period_end, last_payment_at, mp_preapproval_id, paddle_subscription_id, paddle_customer_id, plan_currency, grace_until, is_unlimited")
      .eq("id", orgId)
      .maybeSingle();
    if (error || !org) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: adminOrg } = await supabaseAdmin
        .from("organizations")
        .select("id, name, subscription_status, trial_ends_at, plan_price_ars, current_period_end, last_payment_at, mp_preapproval_id, paddle_subscription_id, paddle_customer_id, plan_currency, grace_until, is_unlimited")
        .eq("id", orgId)
        .maybeSingle();
      if (!adminOrg) return null;
      return buildSubscriptionSnapshot(adminOrg);
    }

    return buildSubscriptionSnapshot(org);
  });

function buildSubscriptionSnapshot(org: any) {
    const now = Date.now();
    const trialEnds = org.trial_ends_at ? new Date(org.trial_ends_at).getTime() : 0;
    const periodEnds = org.current_period_end ? new Date(org.current_period_end).getTime() : 0;
    const daysLeft =
      org.subscription_status === "trialing"
        ? Math.max(0, Math.ceil((trialEnds - now) / 86_400_000))
        : org.subscription_status === "active"
          ? Math.max(0, Math.ceil((periodEnds - now) / 86_400_000))
          : 0;
    const canWrite = canWriteOrg(org, now);
    const status = effectiveStatus(org, now);
    return { ...org, daysLeft, canWrite, effective_status: status };
}

/** Create a Mercado Pago preapproval (suscripción mensual) and return checkout URL. */
export const createPreapproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) throw new Error("Mercado Pago no está configurado todavía. Pedile al admin que cargue MERCADOPAGO_ACCESS_TOKEN.");

    const orgId = await getOrCreateOrgId(supabase, userId);
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, plan_price_ars")
      .eq("id", orgId)
      .maybeSingle();
    if (!org) throw new Error("No pudimos cargar tu workspace. Probá recargar la página.");

    const origin = process.env.PUBLIC_APP_URL || "https://fluxtalent.lovable.app";
    const email = ((claims as any)?.email ?? "").toString().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Tu cuenta no tiene un email válido. Actualizá tu email en Configuración antes de suscribirte.");
    }
    const amount = Number(org.plan_price_ars);
    if (!amount || amount <= 0) {
      throw new Error("El plan no tiene precio configurado. Contactanos para activar tu suscripción.");
    }

    const body = {
      reason: `FLUX Talent - Plan mensual`,
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

/**
 * Inicia el checkout de un plan de Mercado Pago (no-code "Planes de suscripción").
 * MP cobra el monto recurrente; el webhook activa la org cuando paga.
 */
export const startPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ planId: z.enum(["starter", "pro", "enterprise"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const baseUrl = MP_PLAN_LINKS[data.planId as PlanId];
    if (!baseUrl) throw new Error("Plan sin link de Mercado Pago configurado.");

    const orgId = await getOrCreateOrgId(supabase, userId);
    const plan = PLANS.find(p => p.id === data.planId);
    if (!plan) throw new Error("Plan inválido.");

    // CRÍTICO: cuando el usuario elige un plan pago NO le damos acceso todavía.
    // Marcamos la org como `past_due` (= pendiente de pago) y limpiamos el trial.
    // Solo el webhook de Mercado Pago, al recibir un pago `approved`, pasa la org
    // a `active`. Esto evita que el usuario use el sistema si abandona el checkout
    // sin pagar (sin esto, el status `trialing` heredado del alta le daba acceso).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Una sola suscripción activa por org: cancelamos la anterior (cambio de
    // plan en ARS o migración desde USD) para evitar doble cobro.
    try {
      const { cancelMercadoPagoSubscription, cancelPaddleSubscription } =
        await import("@/lib/billing-provider.server");
      await cancelMercadoPagoSubscription(supabaseAdmin, orgId);
      await cancelPaddleSubscription(supabaseAdmin, orgId);
    } catch (e) {
      console.error("[startPlanCheckout] auto-cancel previo falló", e);
    }

    await supabaseAdmin
      .from("organizations")
      .update({
        plan_price_ars: plan.priceArs,
        plan_currency: "ars",
        paddle_subscription_id: null as any,
        grace_until: null as any,
        subscription_status: "past_due",
        trial_ends_at: null as any,
        current_period_end: null as any,
      })
      .eq("id", orgId);


    await supabaseAdmin.from("activity_events").insert({
      org_id: orgId,
      user_id: userId,
      event_type: "checkout.started",
      metadata: { plan_id: plan.id, plan_name: plan.name, amount: plan.priceArs },
    });
    // Stamp setup as completed so the user isn't re-routed to /app/setup after the redirect.
    // Their access remains blocked until the MP webhook flips status to `active`.
    await supabaseAdmin.from("profiles").update({ setup_completed_at: new Date().toISOString() } as any).eq("id", userId);



    // external_reference = "orgId:planId" — webhook lo usa para activar el plan correcto
    const ref = `${orgId}:${data.planId}`;
    const sep = baseUrl.includes("?") ? "&" : "?";
    return { url: `${baseUrl}${sep}external_reference=${encodeURIComponent(ref)}` };
  });

/**
 * Checkout en dólares con Mercado Pago (tarjeta internacional).
 * Intenta crear la suscripción con `currency_id: "USD"`; si la cuenta de MP no
 * admite USD (caso típico de cuentas AR), reintenta cobrando el equivalente en
 * ARS del plan. En ambos casos el webhook activa la org al aprobarse el pago.
 */
export const startUsdPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ planId: z.enum(["starter", "pro", "enterprise"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) throw new Error("Mercado Pago no está configurado todavía.");

    const plan = PLANS.find(p => p.id === data.planId);
    if (!plan || !plan.priceUsd || plan.priceUsd <= 0) throw new Error("Plan sin precio en dólares.");

    const orgId = await getOrCreateOrgId(supabase, userId);
    const email = ((claims as any)?.email ?? "").toString().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Tu cuenta no tiene un email válido. Actualizá tu email en Configuración antes de suscribirte.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Una sola suscripción activa por org.
    try {
      const { cancelMercadoPagoSubscription, cancelPaddleSubscription } =
        await import("@/lib/billing-provider.server");
      await cancelMercadoPagoSubscription(supabaseAdmin, orgId);
      await cancelPaddleSubscription(supabaseAdmin, orgId);
    } catch (e) {
      console.error("[startUsdPlanCheckout] auto-cancel previo falló", e);
    }

    const origin = process.env.PUBLIC_APP_URL || "https://fluxtalent.lovable.app";
    const ref = `${orgId}:${data.planId}`;

    async function createPreapproval(currency: "USD" | "ARS", amount: number) {
      const res = await fetch("https://api.mercadopago.com/preapproval", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: `FLUX Talent - Plan ${plan!.name}`,
          external_reference: ref,
          payer_email: email,
          back_url: `${origin}/app/subscription?ok=1`,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: amount,
            currency_id: currency,
          },
          status: "pending",
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      return { ok: res.ok, json };
    }

    let attempt = await createPreapproval("USD", plan.priceUsd);
    let currencyUsed: "usd" | "ars" = "usd";
    if (!attempt.ok) {
      console.error("[startUsdPlanCheckout] USD rechazado por MP, fallback ARS", attempt.json?.message);
      attempt = await createPreapproval("ARS", plan.priceArs);
      currencyUsed = "ars";
    }
    if (!attempt.ok) throw new Error(attempt.json?.message ?? "Mercado Pago rechazó el pago en dólares.");

    await supabaseAdmin
      .from("organizations")
      .update({
        plan_price_ars: plan.priceArs,
        plan_currency: currencyUsed,
        paddle_subscription_id: null as any,
        grace_until: null as any,
        subscription_status: "past_due",
        trial_ends_at: null as any,
        current_period_end: null as any,
        mp_preapproval_id: attempt.json.id,
      } as any)
      .eq("id", orgId);

    await supabaseAdmin.from("activity_events").insert({
      org_id: orgId,
      user_id: userId,
      event_type: "checkout.started",
      metadata: { plan_id: plan.id, plan_name: plan.name, amount: plan.priceUsd, currency: currencyUsed },
    });
    await supabaseAdmin.from("profiles").update({ setup_completed_at: new Date().toISOString() } as any).eq("id", userId);

    return { url: attempt.json.init_point as string, currency: currencyUsed };
  });




/**
 * Verifica si una org puede activar el plan Free (trial de 15 días).
 * Solo cuentas nuevas: sin historial de pago, sin preapproval previo,
 * sin precio de plan configurado, y sin trial ya consumido.
 * Lanza un error con prefijo "FREE_NOT_AVAILABLE:" si no es elegible.
 * Se usa en CUALQUIER endpoint que pueda fijar plan Free para evitar
 * bypass desde la UI.
 */
async function assertFreeEligible(supabaseAdmin: any, orgId: string) {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("mp_preapproval_id, last_payment_at, trial_ends_at, subscription_status, plan_price_ars")
    .eq("id", orgId)
    .maybeSingle();
  const status = org?.subscription_status ?? "";
  const trialExpired = !!org?.trial_ends_at && new Date(org.trial_ends_at) < new Date();
  const hasPaidHistory = !!org?.mp_preapproval_id
    || !!org?.last_payment_at
    || (org?.plan_price_ars ?? 0) > 0
    || ["active", "canceled", "paused", "past_due"].includes(status);
  if (hasPaidHistory || (trialExpired && status !== "trialing")) {
    throw new Error("FREE_NOT_AVAILABLE: La prueba gratuita de 15 días solo está disponible para cuentas nuevas. Actualizá a un plan pago para continuar.");
  }
}

/** UI: consulta si la org actual puede activar el plan Free. */
export const canUseFreeTrial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrCreateOrgId(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      await assertFreeEligible(supabaseAdmin, orgId);
      return { eligible: true as const };
    } catch (e: any) {
      return { eligible: false as const, reason: String(e?.message ?? "").replace(/^FREE_NOT_AVAILABLE:\s*/, "") };
    }
  });

/** Activa el plan Free (15 días de prueba) en la org del usuario actual. Solo cuentas nuevas. */
export const chooseFreePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrCreateOrgId(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertFreeEligible(supabaseAdmin, orgId);

    await supabaseAdmin
      .from("organizations")
      .update({
        plan_price_ars: 0,
        subscription_status: "trialing",
        trial_ends_at: new Date(Date.now() + 15 * 86_400_000).toISOString(),
      })
      .eq("id", orgId);
    // Stamp setup as completed only when the user explicitly picked Free.
    await supabaseAdmin.from("profiles").update({ setup_completed_at: new Date().toISOString() } as any).eq("id", userId);
    return { ok: true };
  });






export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const orgId = await getOrCreateOrgId(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("mp_preapproval_id, paddle_subscription_id, plan_currency")
      .eq("id", orgId)
      .maybeSingle();

    // Cancel Mercado Pago preapproval (ARS). Si no tenemos el id guardado,
    // lo buscamos en Mercado Pago por external_reference antes de rendirnos:
    // sin esto la suscripción seguía cobrándose todos los meses.
    let mpCanceled = false;
    let mpError: string | null = null;
    if (token) {
      try {
        let preapprovalId = org?.mp_preapproval_id as string | null;
        if (!preapprovalId) {
          const search = await fetch(
            `https://api.mercadopago.com/preapproval/search?external_reference=${encodeURIComponent(orgId)}&limit=10`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const json: any = search.ok ? await search.json() : null;
          const found = (json?.results ?? []).find((r: any) => r.status === "authorized" || r.status === "pending");
          preapprovalId = found?.id ?? null;
        }
        if (preapprovalId) {
          const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancelled" }),
          });
          if (res.ok) {
            mpCanceled = true;
            await supabaseAdmin.from("organizations").update({ mp_preapproval_id: null } as any).eq("id", orgId);
          } else {
            mpError = `${res.status}: ${await res.text().catch(() => "")}`;
            console.error("[cancelSubscription] MP cancel rejected", mpError);
          }
        }
      } catch (e: any) {
        mpError = e?.message ?? "unknown";
        console.error("[cancelSubscription] MP cancel failed", e);
      }
    }


    // Cancel Paddle subscription at end of period (USD)
    if (org?.paddle_subscription_id) {
      try {
        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("environment")
          .eq("paddle_subscription_id", org.paddle_subscription_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const env = (sub?.environment ?? "sandbox") as "sandbox" | "live";
        const { getPaddleClient } = await import("@/lib/paddle.server");
        const paddle = getPaddleClient(env);
        await paddle.subscriptions.cancel(org.paddle_subscription_id, { effectiveFrom: "next_billing_period" });
      } catch (e) {
        console.error("[cancelSubscription] Paddle cancel failed", e);
      }
    }

    // Soft cancel: keep `current_period_end` intact so the user retains access
    // through the end of the paid period (e.g., paid on 20/6 + canceled on 10/7
    // ⇒ still has access until 20/7). The webhook + canWrite logic handles expiry.
    const { data: orgRow } = await supabaseAdmin
      .from("organizations").select("current_period_end, plan_price_ars").eq("id", orgId).maybeSingle();
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ subscription_status: "canceled" })
      .eq("id", orgId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("activity_events").insert({
      org_id: orgId,
      user_id: userId,
      event_type: "subscription.canceled",
      metadata: {
        source: "user_action",
        mp_preapproval_id: org?.mp_preapproval_id ?? null,
        mp_canceled: mpCanceled,
        mp_error: mpError,
      },
    });
    // Cancellation email
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      const recipientEmail = authUser?.user?.email;
      if (recipientEmail) {
        const { data: prof } = await supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
        const { dispatchTransactionalEmail } = await import("@/lib/email/dispatch.server");
        await dispatchTransactionalEmail({
          templateName: "subscription-canceled",
          recipientEmail,
          templateData: { fullName: prof?.full_name ?? undefined, periodEnd: orgRow?.current_period_end ?? undefined },
          idempotencyKey: `sub-canceled-${orgId}-${Date.now()}`,
        });
      }
    } catch (e) { console.error("[cancelSubscription] email failed", e); }
    return {
      ok: true,
      mpCanceled,
      // Si el proveedor rechazó la baja, avisamos para que soporte la haga a mano
      // en vez de dejar al usuario creyendo que no le van a cobrar más.
      warning: mpError
        ? "Cancelamos tu plan en FLUX Talent, pero no pudimos confirmar la baja del débito automático en Mercado Pago. Escribinos a soporte@fluxtalent.com.ar para verificarlo."
        : null,
    };
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

/** Solicita Factura C: guarda la solicitud y notifica al admin por email. */
export const requestInvoiceC = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      business_name: z.string().trim().min(2).max(200),
      cuit_or_dni: z.string().trim().min(7).max(20),
      email: z.string().trim().email().max(200),
      phone: z.string().trim().min(6).max(40),
      address: z.string().trim().max(300).optional().or(z.literal("")),
      notes: z.string().trim().max(1000).optional().or(z.literal("")),
      amount_ars: z.number().nonnegative().optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const orgId = await getOrCreateOrgId(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org } = await supabase
      .from("organizations")
      .select("name, plan_price_ars")
      .eq("id", orgId)
      .maybeSingle();

    // Datos del usuario que hace la solicitud (para incluirlos en el mail)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, full_name, dni, country, province, google_email")
      .eq("id", userId)
      .maybeSingle();
    const userEmail = ((claims as any)?.email ?? (profile as any)?.google_email ?? "").toString();


    const { data: inserted, error } = await supabase
      .from("invoice_requests")
      .insert({
        org_id: orgId,
        user_id: userId,
        invoice_type: "C",
        business_name: data.business_name,
        cuit_or_dni: data.cuit_or_dni,
        email: data.email,
        phone: data.phone,
        address: data.address || null,
        notes: data.notes || null,
        amount_ars: data.amount_ars ?? org?.plan_price_ars ?? null,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Enviamos la notificación por el mismo pipeline que el resto de los mails
    // (Lovable Emails / dominio verificado notify.fluxtalent.com.ar).
    // El template tiene `to: 'soporte@fluxtalent.com.ar'` fijo, así que el
    // recipientEmail que pasemos se ignora — igual usamos el del solicitante
    // para que quede registrado en el log.
    let emailSent = false;
    let emailWarning: string | null = null;
    try {
      const { dispatchTransactionalEmail } = await import("@/lib/email/dispatch.server");
      const res = await dispatchTransactionalEmail({
        templateName: "invoice-request",
        recipientEmail: "soporte@fluxtalent.com.ar",
        idempotencyKey: `invoice-c-${inserted.id}`,
        templateData: {
          orgName: org?.name ?? "Cliente",
          requestId: inserted.id,
          amountArs: data.amount_ars ?? org?.plan_price_ars ?? undefined,
          fullName: profile?.full_name || profile?.display_name || undefined,
          userEmail: userEmail || undefined,
          userDni: profile?.dni || undefined,
          country: profile?.country || undefined,
          province: profile?.province || undefined,
          businessName: data.business_name,
          cuitOrDni: data.cuit_or_dni,
          billingEmail: data.email,
          phone: data.phone,
          address: data.address || undefined,
          notes: data.notes || undefined,
        },
      });
      if (res.ok) emailSent = true;
      else {
        emailWarning = res.error ?? null;
        console.error("[requestInvoiceC] dispatch failed:", res.error);
      }
    } catch (e: any) {
      emailWarning = e?.message ?? "dispatch_failed";
      console.error("[requestInvoiceC] dispatch threw:", e?.message ?? e);
    }

    if (!emailSent) {
      console.warn("[requestInvoiceC] email not sent, request stored:", inserted.id);
    }

    return { id: inserted.id, emailWarning };
  });


/** Returns a live usage snapshot: active vacancies, new vacancies this cycle, CVs this cycle, renewal date, plan limits. */
export const getUsageSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrCreateOrgId(supabase, userId);
    const {
      getOrgPlan, getActiveVacancyCount, getNewVacanciesThisCycle,
      getCvsThisCycle, getCurrentCycle,
    } = await import("@/lib/plan-limits");
    const [plan, activeVacancies, newVacancies, cvs, cycle] = await Promise.all([
      getOrgPlan(supabase, orgId),
      getActiveVacancyCount(supabase, orgId),
      getNewVacanciesThisCycle(supabase, orgId),
      getCvsThisCycle(supabase, orgId),
      getCurrentCycle(supabase, orgId),
    ]);
    // Fire-and-forget capacity warning email at 80%+ (deduped by 7d activity event)
    try {
      const pct = (n: number, m: number) => (m > 0 ? (n / m) * 100 : 0);
      const worst = Math.max(
        pct(activeVacancies, plan.maxVacancies ?? 0),
        pct(newVacancies, plan.maxNewVacanciesPerCycle ?? 0),
        pct(cvs, plan.maxCvsPerMonth ?? 0),
      );
      if (worst >= 80) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: recent } = await supabaseAdmin
          .from("activity_events").select("id")
          .eq("org_id", orgId).eq("event_type", "capacity.warning_sent")
          .gte("created_at", sevenDaysAgo).limit(1).maybeSingle();
        if (!recent) {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
          const recipientEmail = authUser?.user?.email;
          if (recipientEmail) {
            const { data: prof } = await supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
            const isFree = (plan.id ?? "").toLowerCase().includes("free");
            const { dispatchTransactionalEmail } = await import("@/lib/email/dispatch.server");
            await dispatchTransactionalEmail({
              templateName: "capacity-warning",
              recipientEmail,
              templateData: { fullName: prof?.full_name ?? undefined, planName: plan.name, isFree, usagePct: Math.round(worst), resourceLabel: "tu plan" },
              idempotencyKey: `cap-warn-${orgId}-${new Date().toISOString().slice(0, 10)}`,
            });
            await supabaseAdmin.from("activity_events").insert({ org_id: orgId, event_type: "capacity.warning_sent", metadata: { pct: Math.round(worst) } });
          }
        }
      }
    } catch (e) { console.error("[getUsageSummary] capacity email failed", e); }
    return {
      planId: plan.id,
      planName: plan.name,
      activeVacancies,
      maxActiveVacancies: plan.maxVacancies,
      newVacanciesThisCycle: newVacancies,
      maxNewVacanciesPerCycle: plan.maxNewVacanciesPerCycle,
      cvsThisCycle: cvs,
      maxCvsPerCycle: plan.maxCvsPerMonth,
      cycleStart: cycle.start.toISOString(),
      cycleEnd: cycle.end.toISOString(),
    };
  });
