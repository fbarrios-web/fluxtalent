import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
      plan_price_ars: 20000,
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
      (org.subscription_status === "active" && (!org.current_period_end || periodEnds > now));

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

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const orgId = await getOrCreateOrgId(supabase, userId);
    const { data: org } = await supabase.from("organizations").select("mp_preapproval_id").eq("id", orgId).maybeSingle();
    if (org?.mp_preapproval_id && token) {
      await fetch(`https://api.mercadopago.com/preapproval/${org.mp_preapproval_id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
    }
    await supabase.from("organizations").update({ subscription_status: "canceled" }).eq("id", orgId);
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
      address: z.string().trim().max(300).optional().or(z.literal("")),
      notes: z.string().trim().max(1000).optional().or(z.literal("")),
      amount_ars: z.number().nonnegative().optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrCreateOrgId(supabase, userId);

    const { data: org } = await supabase
      .from("organizations")
      .select("name, plan_price_ars")
      .eq("id", orgId)
      .maybeSingle();

    const { data: inserted, error } = await supabase
      .from("invoice_requests")
      .insert({
        org_id: orgId,
        user_id: userId,
        invoice_type: "C",
        business_name: data.business_name,
        cuit_or_dni: data.cuit_or_dni,
        email: data.email,
        address: data.address || null,
        notes: data.notes || null,
        amount_ars: data.amount_ars ?? org?.plan_price_ars ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    let emailWarning: string | null = null;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
          const esc = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
          const html = `
            <h2>Nueva solicitud de Factura C</h2>
            <p><strong>Organización:</strong> ${esc(org?.name ?? "—")}</p>
            <p><strong>Razón social / Nombre:</strong> ${esc(data.business_name)}</p>
            <p><strong>CUIT/DNI:</strong> ${esc(data.cuit_or_dni)}</p>
            <p><strong>Email de facturación:</strong> ${esc(data.email)}</p>
            <p><strong>Domicilio:</strong> ${esc(data.address || "—")}</p>
            <p><strong>Monto:</strong> ${data.amount_ars ?? org?.plan_price_ars ?? "—"} ARS</p>
            <p><strong>Notas:</strong> ${esc(data.notes || "—")}</p>
          `;
          await sendGmail({
            accessToken: access_token,
            fromName: adminProfile.display_name || "FLUX Talent",
            fromEmail: adminProfile.google_email,
            to: adminProfile.google_email,
            subject: `Factura C · ${org?.name ?? "Cliente"}`,
            html,
            replyTo: data.email,
          });
        } else {
          emailWarning = "Solicitud guardada. El admin debe conectar Gmail para recibir la notificación por email.";
        }
      }
    } catch (e: any) {
      emailWarning = `Solicitud guardada, pero falló el envío del email: ${e?.message ?? "error"}`;
    }

    return { id: inserted.id, emailWarning };
  });
