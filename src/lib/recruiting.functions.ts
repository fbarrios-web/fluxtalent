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
      work_schedule: z.string().max(200).optional(),
      image_url: z.string().url().optional().or(z.literal("")),
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

    // Plan limit: active vacancies
    const { assertCanCreateVacancy } = await import("@/lib/plan-limits");
    await assertCanCreateVacancy(supabase, profile.org_id!);


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
        work_schedule: z.string().max(200).optional(),
        image_url: z.string().url().optional().or(z.literal("")),
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
    // Re-evaluate auto-rejection when min_match changes:
    // any "received" application with match_score below new threshold gets auto-rejected and gets rejection email.
    let autoRejected = 0;
    if (typeof data.patch.min_match === "number") {
      const min = data.patch.min_match;
      const { data: low } = await context.supabase
        .from("applications")
        .select("id, match_score")
        .eq("vacancy_id", data.id)
        .eq("stage", "received")
        .not("match_score", "is", null)
        .lt("match_score", min);
      if (low?.length) {
        const ids = low.map((a: any) => a.id);
        await context.supabase.from("applications").update({ stage: "rejected" }).in("id", ids);
        await context.supabase.from("application_events").insert(
          low.map((a: any) => ({
            application_id: a.id,
            actor_id: context.userId,
            type: "auto_reject",
            payload: { reason: `match ${a.match_score}% < ${min}% (umbral actualizado)` },
          })),
        );
        // Send rejection email to each (best-effort, in parallel)
        try {
          const { sendStageEmail } = await import("@/lib/scheduling.functions");
          await Promise.allSettled(
            ids.map((id: string) => sendStageEmail(context.supabase as any, context.userId, id, "rejection")),
          );
        } catch { /* noop */ }
        autoRejected = ids.length;
      }
    }
    return { ok: true, autoRejected };
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

// Authenticated-only: avoids letting anonymous callers enumerate whether a
// given DNI/name/birthdate triplet belongs to a registered user.
// Pre-signup uniqueness is still enforced by saveIdentity (unique constraint).
export const checkIdentityAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      dni: z.string().trim().min(6).max(20),
      full_name: z.string().trim().min(3).max(120),
      birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: exists, error } = await context.supabase.rpc("identity_exists", {
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

// Manually create an application from the recruiter side (upload CV + trigger AI).
export const manualCreateApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      vacancy_id: z.string().uuid(),
      first_name: z.string().trim().min(1).max(80),
      last_name: z.string().trim().min(1).max(80),
      email: z.string().trim().email().max(200),
      phone: z.string().trim().max(40).optional().nullable(),
      linkedin: z.string().trim().max(300).optional().nullable(),
      cv_base64: z.string().optional().nullable(),
      cv_filename: z.string().max(200).optional().nullable(),
      cv_mime: z.string().max(120).optional().nullable(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();
    if (!profile?.org_id) throw new Error("Perfil sin organización");
    const { data: vac } = await supabase.from("vacancies").select("id, org_id").eq("id", data.vacancy_id).maybeSingle();
    if (!vac || vac.org_id !== profile.org_id) throw new Error("Vacante no disponible");

    let cv_url: string | null = null;
    if (data.cv_base64) {
      // Use admin client to upload (cvs bucket has no authenticated INSERT policy)
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const ext = (data.cv_filename?.split(".").pop() || "pdf").toLowerCase();
      const path = `${vac.org_id}/${vac.id}/${crypto.randomUUID()}.${ext}`;
      const bin = Uint8Array.from(atob(data.cv_base64), c => c.charCodeAt(0));
      const { error: upErr } = await supabaseAdmin.storage.from("cvs").upload(path, bin, {
        contentType: data.cv_mime || "application/pdf", upsert: false,
      });
      if (upErr) throw new Error("Error al subir CV: " + upErr.message);
      cv_url = path;
    }

    // Plan limit: skip AI analysis if monthly CV cap reached
    let analyzeAi = !!cv_url;
    if (cv_url) {
      const { canAnalyzeMoreCvs } = await import("@/lib/plan-limits");
      analyzeAi = await canAnalyzeMoreCvs(supabase, vac.org_id);
    }

    const { data: appRow, error } = await supabase.from("applications").insert({
      vacancy_id: vac.id, org_id: vac.org_id,
      first_name: data.first_name, last_name: data.last_name,
      email: data.email, phone: data.phone || null, linkedin: data.linkedin || null,
      cv_url, source: "manual",
      ai_status: analyzeAi ? "pending" : "skipped",
    }).select("id").single();
    if (error) throw error;

    await supabase.from("application_events").insert({
      application_id: appRow.id, actor_id: userId, type: "manual_created", payload: { ai_skipped_by_plan: cv_url && !analyzeAi },
    });

    // The application is left at ai_status='pending'. A pg_cron-backed worker
    // (/api/public/hooks/process-cv-queue) drains the queue every minute and
    // updates the row to 'done'/'error'. Fire-and-forget fetches don't work
    // reliably on Cloudflare Workers (the request context is destroyed when
    // the handler returns), so we don't try to kick the worker from here.

    return { id: appRow.id };
  });


// Extract first_name/last_name/email from a CV using AI, then create the application
// reusing the same flow as manualCreateApplication (upload + async analyze).
export const bulkCreateApplicationFromCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      vacancy_id: z.string().uuid(),
      cv_base64: z.string().min(1),
      cv_filename: z.string().max(200),
      cv_mime: z.string().max(120).optional().nullable(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();
    if (!profile?.org_id) throw new Error("Perfil sin organización");
    const { data: vac } = await supabase.from("vacancies").select("id, org_id").eq("id", data.vacancy_id).maybeSingle();
    if (!vac || vac.org_id !== profile.org_id) throw new Error("Vacante no disponible");

    // Extract name + email via AI
    const { aiJSON } = await import("@/lib/ai-gateway.server");
    const mime = data.cv_mime || "application/pdf";
    let extracted: { first_name: string; last_name: string; email: string } = { first_name: "", last_name: "", email: "" };
    try {
      extracted = await aiJSON<{ first_name: string; last_name: string; email: string }>({
        system: "Extraés datos de contacto de un CV. Devolvés sólo JSON.",
        user: [
          { type: "text", text: `Del CV adjunto extraé el nombre, apellido y email principal del candidato. Si algún dato no aparece, devolvé string vacío. Nombre y apellido en formato propio (Title Case). Archivo: ${data.cv_filename}.` },
          { type: "file", file: { filename: data.cv_filename, file_data: `data:${mime};base64,${data.cv_base64}` } },
        ],
        schema: {
          name: "cv_contact",
          description: "Datos de contacto del CV",
          parameters: {
            type: "object",
            properties: {
              first_name: { type: "string" },
              last_name: { type: "string" },
              email: { type: "string" },
            },
            required: ["first_name", "last_name", "email"],
          },
        },
      });
    } catch (e: any) {
      throw new Error("No se pudo leer el CV: " + (e?.message ?? "error de IA"));
    }

    const first_name = (extracted.first_name || "").trim() || "Sin nombre";
    const last_name = (extracted.last_name || "").trim() || "—";
    const email = (extracted.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`No se detectó un email válido en "${data.cv_filename}"`);
    }

    // Upload CV (admin client, cvs bucket has no authenticated INSERT policy)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = (data.cv_filename.split(".").pop() || "pdf").toLowerCase();
    const path = `${vac.org_id}/${vac.id}/${crypto.randomUUID()}.${ext}`;
    const bin = Uint8Array.from(atob(data.cv_base64), c => c.charCodeAt(0));
    const { error: upErr } = await supabaseAdmin.storage.from("cvs").upload(path, bin, {
      contentType: mime, upsert: false,
    });
    if (upErr) throw new Error("Error al subir CV: " + upErr.message);

    const { canAnalyzeMoreCvs } = await import("@/lib/plan-limits");
    const analyzeAi = await canAnalyzeMoreCvs(supabase, vac.org_id);

    const { data: appRow, error } = await supabase.from("applications").insert({
      vacancy_id: vac.id, org_id: vac.org_id,
      first_name, last_name, email,
      cv_url: path, source: "manual",
      ai_status: analyzeAi ? "pending" : "skipped",
    }).select("id").single();
    if (error) throw error;

    await supabase.from("application_events").insert({
      application_id: appRow.id, actor_id: userId, type: "bulk_uploaded", payload: { filename: data.cv_filename, ai_skipped_by_plan: !analyzeAi },
    });

    // Queued for the AI worker — see manualCreateApplication note above.
    return { id: appRow.id, first_name, last_name, email };
  });

