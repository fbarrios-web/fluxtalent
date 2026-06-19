import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============ AI: redactar descripción de vacante ============
export const aiDraftVacancy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      title: z.string().min(2).max(120),
      seniority: z.string().optional(),
      area: z.string().optional(),
      modality: z.string().optional(),
      extra: z.string().max(2000).optional(),
    }).parse(input))
  .handler(async ({ data }) => {
    const { aiJSON } = await import("@/lib/ai-gateway.server");
    return aiJSON<{
      description: string;
      responsibilities: string;
      requirements: string;
      nice_to_have: string;
      competencies: string[];
    }>({
      system:
        "Sos un Senior Talent Acquisition Lead. Escribís descripciones de vacantes claras, modernas, sin clichés ni sesgos. Respondés en español neutro.",
      user: `Generá una descripción completa de vacante para:
Título: ${data.title}
Seniority: ${data.seniority ?? "N/A"}
Área: ${data.area ?? "N/A"}
Modalidad: ${data.modality ?? "N/A"}
Contexto adicional: ${data.extra ?? "ninguno"}

Devolvé JSON con: description (3-5 oraciones), responsibilities (bullets en markdown, 5-7), requirements (excluyentes, bullets, 4-6), nice_to_have (bullets, 3-5), competencies (array de 4-6 soft skills clave).`,
      schema: {
        name: "vacancy_draft",
        description: "Borrador de vacante",
        parameters: {
          type: "object",
          properties: {
            description: { type: "string" },
            responsibilities: { type: "string" },
            requirements: { type: "string" },
            nice_to_have: { type: "string" },
            competencies: { type: "array", items: { type: "string" } },
          },
          required: ["description", "responsibilities", "requirements", "nice_to_have", "competencies"],
        },
      },
    });
  });

// ============ AI: analizar candidato (parse + score) ============
async function fetchCvAsBase64(supabase: any, path: string): Promise<{ b64: string; mime: string } | null> {
  const { data, error } = await supabase.storage.from("cvs").download(path);
  if (error || !data) return null;
  const buf = new Uint8Array(await data.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  const b64 = btoa(s);
  return { b64, mime: data.type || "application/pdf" };
}

export const analyzeApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ applicationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { aiJSON } = await import("@/lib/ai-gateway.server");
    const { supabase } = context;

    const { data: app, error } = await supabase
      .from("applications")
      .select("*, vacancy:vacancies(*)")
      .eq("id", data.applicationId)
      .single();
    if (error || !app) throw new Error("Application no encontrada");

    await supabase.from("applications").update({ ai_status: "running" }).eq("id", app.id);

    try {
      let userContent: any;
      if (app.cv_url) {
        const cv = await fetchCvAsBase64(supabase, app.cv_url);
        if (cv) {
          userContent = [
            { type: "text", text: buildAnalysisPrompt(app, app.vacancy) },
            { type: "file", file: { filename: "cv.pdf", file_data: `data:${cv.mime};base64,${cv.b64}` } },
          ];
        }
      }
      if (!userContent) userContent = buildAnalysisPrompt(app, app.vacancy) + "\n(No hay CV adjunto, evaluá con los datos disponibles.)";

      const result = await aiJSON<{
        cv_text: string;
        parsed: { experience: string[]; education: string[]; skills: string[] };
        match_score: number;
        match_breakdown: { experience: number; education: number; skills: number; competencies: number };
        ai_summary: string;
        strengths: string[];
        gaps: string[];
        red_flags: string[];
      }>({
        system:
          "Sos un experto en evaluación técnica de CVs. Sos objetivo, conciso y sin sesgos. Respondés sólo el JSON pedido.",
        user: userContent,
        schema: {
          name: "candidate_evaluation",
          description: "Evaluación estructurada del candidato vs vacante",
          parameters: {
            type: "object",
            properties: {
              cv_text: { type: "string", description: "Texto plano extraído del CV (max 5000 chars)" },
              parsed: {
                type: "object",
                properties: {
                  experience: { type: "array", items: { type: "string" } },
                  education: { type: "array", items: { type: "string" } },
                  skills: { type: "array", items: { type: "string" } },
                },
                required: ["experience", "education", "skills"],
              },
              match_score: { type: "integer", description: "0-100" },
              match_breakdown: {
                type: "object",
                properties: {
                  experience: { type: "integer" },
                  education: { type: "integer" },
                  skills: { type: "integer" },
                  competencies: { type: "integer" },
                },
                required: ["experience", "education", "skills", "competencies"],
              },
              ai_summary: { type: "string" },
              strengths: { type: "array", items: { type: "string" } },
              gaps: { type: "array", items: { type: "string" } },
              red_flags: { type: "array", items: { type: "string" } },
            },
            required: ["parsed", "match_score", "match_breakdown", "ai_summary", "strengths", "gaps", "red_flags"],
          },
        },
      });

      const update = {
        cv_text: result.cv_text?.slice(0, 8000),
        parsed_data: result.parsed,
        match_score: result.match_score,
        match_breakdown: result.match_breakdown,
        ai_summary: result.ai_summary,
        strengths: result.strengths,
        gaps: result.gaps,
        red_flags: result.red_flags,
        ai_status: "done",
      };
      await supabase.from("applications").update(update).eq("id", app.id);
      await supabase.from("application_events").insert({
        application_id: app.id,
        type: "ai_analysis",
        payload: { match_score: result.match_score },
      });

      // Auto-reject if below threshold
      const min = app.vacancy?.min_match ?? 60;
      if (result.match_score < min && app.stage === "received") {
        await supabase.from("applications").update({ stage: "rejected" }).eq("id", app.id);
        await supabase.from("application_events").insert({
          application_id: app.id,
          type: "auto_reject",
          payload: { reason: `match ${result.match_score}% < ${min}%` },
        });
      }
      return { ok: true, match_score: result.match_score };
    } catch (e: any) {
      await supabase.from("applications").update({ ai_status: "error" }).eq("id", app.id);
      throw e;
    }
  });

function buildAnalysisPrompt(app: any, vacancy: any) {
  return `Evaluá este candidato contra la vacante.

VACANTE
- Título: ${vacancy.title}
- Seniority: ${vacancy.seniority ?? "-"}
- Modalidad: ${vacancy.modality ?? "-"}
- Descripción: ${vacancy.description ?? "-"}
- Responsabilidades: ${vacancy.responsibilities ?? "-"}
- Requisitos excluyentes: ${vacancy.requirements ?? "-"}
- Deseables: ${vacancy.nice_to_have ?? "-"}
- Competencias: ${(vacancy.competencies ?? []).join(", ")}

CANDIDATO
- Nombre: ${app.first_name} ${app.last_name}
- Email: ${app.email}
- LinkedIn: ${app.linkedin ?? "-"}
- Respuestas filtro: ${JSON.stringify(app.screening_answers ?? {})}

Instrucciones:
1. Extraé experiencia, formación y skills del CV adjunto.
2. Calculá match (0-100) general y por categoría (experiencia, formación, skills, competencias). Sé estricto con los requisitos excluyentes.
3. Resumí el perfil en 2-3 oraciones.
4. Listá 3-5 fortalezas, 2-4 gaps y 0-3 red flags.`;
}

// ============ AI: generar preguntas para entrevista ============
export const aiInterviewQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ applicationId: z.string().uuid(), stage: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { aiJSON } = await import("@/lib/ai-gateway.server");
    const { data: app } = await context.supabase
      .from("applications")
      .select("*, vacancy:vacancies(*)")
      .eq("id", data.applicationId)
      .single();
    if (!app) throw new Error("Not found");
    return aiJSON<{ questions: Array<{ topic: string; question: string; rationale: string }> }>({
      system: "Sos un entrevistador senior. Generás preguntas inteligentes en español.",
      user: `Generá 7 preguntas para una entrevista de etapa "${data.stage}" para el puesto ${app.vacancy.title}.
Foco: validar gaps (${(app.gaps ?? []).join(", ") || "ninguno"}) y profundizar fortalezas (${(app.strengths ?? []).join(", ") || "perfil general"}).
Cada pregunta con topic, question y rationale.`,
      schema: {
        name: "interview_questions",
        description: "Preguntas de entrevista",
        parameters: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: { topic: { type: "string" }, question: { type: "string" }, rationale: { type: "string" } },
                required: ["topic", "question", "rationale"],
              },
            },
          },
          required: ["questions"],
        },
      },
    });
  });

// ============ AI: redactar email ============
export const aiDraftEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      applicationId: z.string().uuid(),
      kind: z.enum(["rejection", "interview_invite", "offer", "followup", "custom"]),
      instructions: z.string().max(1000).optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { aiText } = await import("@/lib/ai-gateway.server");
    const { data: app } = await context.supabase
      .from("applications")
      .select("*, vacancy:vacancies(*)")
      .eq("id", data.applicationId)
      .single();
    if (!app) throw new Error("Not found");
    const text = await aiText({
      system: "Sos un reclutador empático. Escribís emails cortos, claros y humanos en español.",
      user: `Redactá un email tipo "${data.kind}" para ${app.first_name} ${app.last_name} para la vacante ${app.vacancy.title}.
Instrucciones: ${data.instructions ?? "ninguna"}.
Devolvé sólo el cuerpo del email, sin asunto, sin saludo "Estimado" formal, en tono cálido y profesional.`,
    });
    return { body: text };
  });

// ============ AI: imagen de fondo para publicación de vacante ============
export const aiVacancyImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      vacancyId: z.string().uuid(),
      aspect: z.enum(["square", "wide", "story"]).default("square"),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: v } = await context.supabase
      .from("vacancies")
      .select("title, area, seniority, modality, description, requirements, responsibilities, location, work_schedule")
      .eq("id", data.vacancyId)
      .single();
    if (!v) throw new Error("Vacante no encontrada");
    const { aiGenerateImage, aiJSON } = await import("@/lib/ai-gateway.server");
    const size = data.aspect === "wide" ? "1536x1024" : data.aspect === "story" ? "1024x1536" : "1024x1024";
    const prompt = `Modern, premium corporate recruitment background image for a job posting.
Role: ${v.title}. Area: ${v.area ?? "professional"}. Seniority: ${v.seniority ?? "mid"}. Modality: ${v.modality ?? "remote"}.
Style: clean abstract gradient background with soft geometric shapes, generous empty space on the right half for overlay text and a logo, photorealistic but minimal, professional palette, NO TEXT, NO LOGOS, NO PEOPLE FACES, no watermarks. Suitable as the canvas for a LinkedIn job post.`;

    // Resumen de requisitos y responsabilidades en bullets cortos
    let requirements_bullets: string[] = [];
    let responsibilities_bullets: string[] = [];
    try {
      const j = await aiJSON<{ requirements: string[]; responsibilities: string[] }>({
        system: "Resumís textos de vacantes en bullets ultra-cortos en español (máx 8 palabras cada uno). Devolvé JSON.",
        user: `Vacante: ${v.title}.
Requisitos (texto):
${v.requirements ?? ""}

Responsabilidades (texto):
${v.responsibilities ?? ""}

Devolvé JSON con esta forma exacta: {"requirements": ["...", "...", "..."], "responsibilities": ["...", "...", "..."]}. Máximo 4 bullets por lista, mínimo 2 (si hay info). Sin emojis, sin viñetas, sin punto final.`,
      });
      requirements_bullets = (j.requirements ?? []).slice(0, 4).map(s => String(s).trim()).filter(Boolean);
      responsibilities_bullets = (j.responsibilities ?? []).slice(0, 4).map(s => String(s).trim()).filter(Boolean);
    } catch {}

    const b64 = await aiGenerateImage({ prompt, size });
    return {
      b64,
      size,
      meta: {
        title: v.title,
        location: v.location,
        modality: v.modality,
        work_schedule: v.work_schedule,
        requirements: requirements_bullets,
        responsibilities: responsibilities_bullets,
      },
    };
  });

