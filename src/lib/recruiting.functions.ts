import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const screeningQuestionSchema = z.object({
  question: z.string().min(3).max(300),
  required: z.boolean().default(false),
  qtype: z.enum(["text", "single", "multi"]).default("text"),
  options: z.array(z.object({
    value: z.string().min(1).max(120),
    discard: z.boolean().default(false),
  })).max(20).default([]),
});

export const createVacancy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      title: z.string().min(2).max(120),
      area: z.string().max(80).optional(),
      seniority: z.enum(["intern", "junior", "mid", "senior", "lead", "manager", "director"]).optional(),
      modality: z.enum(["remote", "hybrid", "onsite"]).optional(),
      location: z.string().max(120).optional(),
      description: z.string().max(5000).optional(),
      responsibilities: z.string().max(5000).optional(),
      requirements: z.string().max(5000).optional(),
      nice_to_have: z.string().max(5000).optional(),
      competencies: z.array(z.string().max(60)).max(20).optional(),
      min_match: z.number().int().min(0).max(100).default(60),
      status: z.enum(["draft", "active", "paused", "closed"]).default("draft"),
      screening: z.array(screeningQuestionSchema).max(10).default([]),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();

    // Backfill: if profile/org missing (e.g. trigger failed at signup), create them now
    if (!profile?.org_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
      const email = u?.user?.email ?? "";
      const meta = (u?.user?.user_metadata ?? {}) as Record<string, string>;
      const { data: newOrg, error: orgErr } = await supabaseAdmin
        .from("organizations")
        .insert({ name: meta.org_name || "Mi empresa", trial_ends_at: new Date(Date.now() + 15 * 86400000).toISOString(), subscription_status: "trialing" })
        .select("id").single();
      if (orgErr) throw orgErr;
      const { error: profErr } = await supabaseAdmin.from("profiles").upsert({
        id: userId, org_id: newOrg.id, display_name: meta.display_name || email.split("@")[0] || "Usuario",
      });
      if (profErr) throw profErr;
      await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "recruiter" as any }, { onConflict: "user_id,role" });
      profile = { org_id: newOrg.id };
    }

    // Gate: Gmail + branding must be configured before creating a vacancy.
    const { data: gateProfile } = await supabase
      .from("profiles").select("google_refresh_token").eq("id", userId).maybeSingle();
    const { data: gateOrg } = await supabase
      .from("organizations").select("sender_email, name").eq("id", profile.org_id!).maybeSingle();
    if (!gateProfile?.google_refresh_token) {
      throw new Error("Conectá tu cuenta de Gmail en Integraciones antes de crear vacantes.");
    }
    if (!gateOrg?.sender_email || !gateOrg?.name) {
      throw new Error("Completá el nombre de la empresa y el email remitente en Configuración antes de crear vacantes.");
    }

    const { screening, ...rest } = data;
    const { data: vac, error } = await supabase
      .from("vacancies")
      .insert({ ...rest, org_id: profile.org_id!, created_by: userId })
      .select("id, public_slug")
      .single();
    if (error) throw error;

    if (screening.length) {
      await supabase.from("screening_questions").insert(
        screening.map((q, i) => ({
          vacancy_id: vac.id, position: i,
          question: q.question, required: q.required,
          qtype: q.qtype, options: q.options as any,
        }))
      );
    }
    return vac;
  });

export const updateVacancy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      patch: z.object({
        title: z.string().optional(),
        area: z.string().optional(),
        seniority: z.enum(["intern", "junior", "mid", "senior", "lead", "manager", "director"]).optional(),
        modality: z.enum(["remote", "hybrid", "onsite"]).optional(),
        location: z.string().optional(),
        status: z.enum(["draft", "active", "paused", "closed"]).optional(),
        min_match: z.number().int().min(0).max(100).optional(),
        description: z.string().optional(),
        responsibilities: z.string().optional(),
        requirements: z.string().optional(),
        nice_to_have: z.string().optional(),
        competencies: z.array(z.string()).optional(),
      }),
      screening: z.array(screeningQuestionSchema).max(10).optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vacancies").update(data.patch).eq("id", data.id);
    if (error) throw error;
    if (data.screening) {
      await context.supabase.from("screening_questions").delete().eq("vacancy_id", data.id);
      if (data.screening.length) {
        await context.supabase.from("screening_questions").insert(
          data.screening.map((q, i) => ({
            vacancy_id: data.id, position: i,
            question: q.question, required: q.required,
            qtype: q.qtype, options: q.options as any,
          }))
        );
      }
    }
    return { ok: true };
  });

export const moveApplicationStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      stage: z.enum(["received", "shortlisted", "interview_1", "interview_2", "interview_3", "offer", "hired", "rejected"]),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("applications").update({ stage: data.stage }).eq("id", data.id);
    if (error) throw error;
    await context.supabase.from("application_events").insert({
      application_id: data.id,
      actor_id: context.userId,
      type: "stage_change",
      payload: { stage: data.stage },
    });

    // Auto-trigger emails based on new stage
    let inviteWarning: string | null = null;
    if (data.stage === "interview_1" || data.stage === "interview_2" || data.stage === "interview_3") {
      try {
        const { inviteForInterview } = await import("@/lib/scheduling.functions");
        await inviteForInterview(context.supabase as any, context.userId, data.id, data.stage);
      } catch (e: any) {
        inviteWarning = e?.message ?? "No se pudo enviar la invitación";
      }
    } else if (data.stage === "rejected" || data.stage === "offer") {
      try {
        const { sendStageEmail } = await import("@/lib/scheduling.functions");
        await sendStageEmail(context.supabase as any, context.userId, data.id, data.stage === "rejected" ? "rejection" : "offer");
      } catch (e: any) {
        inviteWarning = e?.message ?? "No se pudo enviar el email";
      }
    }
    return { ok: true, inviteWarning };
  });

export const saveScorecard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      application_id: z.string().uuid(),
      stage: z.string(),
      ratings: z.record(z.string(), z.number().int().min(1).max(5)),
      overall: z.number().int().min(1).max(5),
      recommendation: z.string().max(40),
      notes: z.string().max(4000).optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("scorecards").insert({
      application_id: data.application_id,
      interviewer_id: context.userId,
      stage: data.stage as any,
      ratings: data.ratings,
      overall: data.overall,
      recommendation: data.recommendation,
      notes: data.notes,
    });
    if (error) throw error;
    return { ok: true };
  });

export const getSignedCvUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage.from("cvs").createSignedUrl(data.path, 60 * 10);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

export const checkIdentityAvailable = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      dni: z.string().trim().min(6).max(20),
      full_name: z.string().trim().min(3).max(120),
      birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exists, error } = await supabaseAdmin.rpc("identity_exists", {
      _dni: data.dni, _full_name: data.full_name, _birth_date: data.birth_date,
    });
    if (error) throw error;
    return { available: !exists };
  });

export const saveIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      dni: z.string().trim().min(6).max(20),
      full_name: z.string().trim().min(3).max(120),
      birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update({
      dni: data.dni, full_name: data.full_name, birth_date: data.birth_date,
    } as any).eq("id", context.userId);
    if (error) {
      if ((error as any).code === "23505") {
        throw new Error("Ya existe una cuenta con esos datos. Usá la cuenta original o contactanos.");
      }
      throw error;
    }
    return { ok: true };
  });
