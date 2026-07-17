import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { MP_PLAN_LINKS, PLANS, type PlanId } from "@/lib/plans";

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
      .select("id, name, subscription_status, trial_ends_at, plan_price_ars, current_period_end, last_payment_at, mp_preapproval_id")
      .eq("id", orgId)
      .maybeSingle();
    if (error || !org) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: adminOrg } = await supabaseAdmin
        .from("organizations")
        .select("id, name, subscription_status, trial_ends_at, plan_price_ars, current_period_end, last_payment_at, mp_preapproval_id")
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
    const canWrite =
      (org.subscription_status === "trialing" && trialEnds > now) ||
      (org.subscription_status === "active" && (!org.current_period_end || periodEnds > now)) ||
      // Canceled subs keep access until the paid period ends.
      (org.subscription_status === "canceled" && org.current_period_end && periodEnds > now);

    return { ...org, daysLeft, canWrite };
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
    await supabaseAdmin
      .from("organizations")
      .update({
        plan_price_ars: plan.priceArs,
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
    const { data: org } = await supabaseAdmin.from("organizations").select("mp_preapproval_id").eq("id", orgId).maybeSingle();
    if (org?.mp_preapproval_id && token) {
      try {
        await fetch(`https://api.mercadopago.com/preapproval/${org.mp_preapproval_id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        });
      } catch (e) {
        console.error("[cancelSubscription] MP cancel failed", e);
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
      metadata: { source: "user_action", mp_preapproval_id: org?.mp_preapproval_id ?? null },
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

    const SUPPORT_EMAIL = "soporte@fluxtalent.com.ar";
    const esc = (s: string) => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    const subject = `Factura C · ${org?.name ?? "Cliente"}`;
    const html = `
      <h2>Nueva solicitud de Factura C</h2>
      <h3 style="margin-top:16px">Datos del usuario</h3>
      <p><strong>Organización:</strong> ${esc(org?.name ?? "—")}</p>
      <p><strong>Nombre:</strong> ${esc(profile?.full_name || profile?.display_name || "—")}</p>
      <p><strong>Email de la cuenta:</strong> ${esc(userEmail || "—")}</p>
      <p><strong>DNI del usuario:</strong> ${esc(profile?.dni || "—")}</p>
      <p><strong>Teléfono del perfil:</strong> —</p>
      <p><strong>País / Provincia:</strong> ${esc(profile?.country || "—")} / ${esc(profile?.province || "—")}</p>
      <h3 style="margin-top:16px">Datos del formulario de facturación</h3>
      <p><strong>Razón social / Nombre:</strong> ${esc(data.business_name)}</p>
      <p><strong>CUIT / DNI:</strong> ${esc(data.cuit_or_dni)}</p>
      <p><strong>Email de facturación:</strong> ${esc(data.email)}</p>
      <p><strong>Teléfono de contacto:</strong> ${esc(data.phone)}</p>
      <p><strong>Domicilio:</strong> ${esc(data.address || "—")}</p>
      <p><strong>Monto:</strong> ${data.amount_ars ?? org?.plan_price_ars ?? "—"} ARS</p>
      <p><strong>Notas:</strong> ${esc(data.notes || "—")}</p>
      <hr/>
      <p style="font-size:12px;color:#666">ID solicitud: ${inserted.id}</p>
    `;

    let emailWarning: string | null = null;
    let emailSent = false;

    // 1) Intento principal: Resend (si está configurado como secret RESEND_API_KEY)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "FLUX Talent <soporte@fluxtalent.com.ar>",
            to: [SUPPORT_EMAIL],
            reply_to: data.email,
            subject,
            html,
          }),
        });
        if (res.ok) emailSent = true;
        else console.error("[requestInvoiceC] Resend error:", res.status, await res.text());
      } catch (e: any) {
        console.error("[requestInvoiceC] Resend fetch failed:", e?.message ?? e);
      }
    }

    // 2) Fallback: Gmail del admin (si está conectado)
    if (!emailSent) {
      try {
        const { data: adminRole } = await supabaseAdmin
          .from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
        if (adminRole?.user_id) {
          const { data: adminProfile } = await supabaseAdmin
            .from("profiles")
            .select("google_refresh_token, google_email, display_name")
            .eq("id", adminRole.user_id)
            .maybeSingle();
          if (adminProfile?.google_refresh_token && adminProfile.google_email) {
            const { refreshAccessToken, sendGmail } = await import("@/lib/google.server");
            const { access_token } = await refreshAccessToken(adminProfile.google_refresh_token);
            await sendGmail({
              accessToken: access_token,
              fromName: adminProfile.display_name || "FLUX Talent",
              fromEmail: adminProfile.google_email,
              to: SUPPORT_EMAIL,
              subject,
              html,
              replyTo: data.email,
            });
            emailSent = true;
          }
        }
      } catch (e: any) {
        console.error("[requestInvoiceC] Gmail fallback failed:", e?.message ?? e);
      }
    }

    if (!emailSent) {
      // La solicitud queda guardada y visible en el panel admin.
      console.warn("[requestInvoiceC] no email transport available; request stored only");
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
