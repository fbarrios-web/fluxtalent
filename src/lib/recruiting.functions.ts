import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
      screening: z.array(z.object({ question: z.string().min(3).max(300), required: z.boolean().default(false) })).max(5).default([]),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", userId).single();
    if (!profile?.org_id) throw new Error("No org");

    const { screening, ...rest } = data;
    const { data: vac, error } = await supabase
      .from("vacancies")
      .insert({ ...rest, org_id: profile.org_id, created_by: userId })
      .select("id, public_slug")
      .single();
    if (error) throw error;

    if (screening.length) {
      await supabase.from("screening_questions").insert(
        screening.map((q, i) => ({ vacancy_id: vac.id, position: i, question: q.question, required: q.required }))
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
        status: z.enum(["draft", "active", "paused", "closed"]).optional(),
        min_match: z.number().int().min(0).max(100).optional(),
        description: z.string().optional(),
        responsibilities: z.string().optional(),
        requirements: z.string().optional(),
        nice_to_have: z.string().optional(),
        competencies: z.array(z.string()).optional(),
      }),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vacancies").update(data.patch).eq("id", data.id);
    if (error) throw error;
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
    return { ok: true };
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
