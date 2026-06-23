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
        try {
          const { sendStageEmail } = await import("@/lib/scheduling.functions");
          await sendStageEmail(supabase as any, context.userId, app.id, "rejection");
        } catch { /* noop */ }
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

// ============ AI: analizar transcripción de entrevista vs perfil ============
export const aiAnalyzeInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      applicationId: z.string().uuid(),
      transcript: z.string().min(20).max(60000),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { aiJSON } = await import("@/lib/ai-gateway.server");
    const { data: app } = await context.supabase
      .from("applications")
      .select("*, vacancy:vacancies(title, requirements, responsibilities, nice_to_have, description)")
      .eq("id", data.applicationId)
      .single();
    if (!app) throw new Error("Application no encontrada");
    const v: any = app.vacancy ?? {};
    const profileBlob = [
      `Candidato: ${app.first_name ?? ""} ${app.last_name ?? ""}`,
      `Resumen IA previo: ${app.ai_summary ?? "—"}`,
      `Fortalezas previas: ${(app.strengths ?? []).join("; ") || "—"}`,
      `Gaps previos: ${(app.gaps ?? []).join("; ") || "—"}`,
      `Red flags previas: ${(app.red_flags ?? []).join("; ") || "—"}`,
      `Match score previo: ${app.match_score ?? "—"}`,
      `Skills parseadas: ${((app.parsed_data as any)?.skills ?? []).join(", ") || "—"}`,
      `Experiencia parseada: ${((app.parsed_data as any)?.experience ?? []).join(" | ") || "—"}`,
    ].join("\n");
    const vacancyBlob = [
      `Vacante: ${v.title ?? "—"}`,
      `Descripción: ${v.description ?? "—"}`,
      `Requisitos: ${v.requirements ?? "—"}`,
      `Responsabilidades: ${v.responsibilities ?? "—"}`,
      `Deseables: ${v.nice_to_have ?? "—"}`,
    ].join("\n");
    return aiJSON<{
      summary: string;
      alignment_score: number;
      strengths: string[];
      concerns: string[];
      evidence: Array<{ topic: string; quote: string; insight: string }>;
      recommendation: "avanzar" | "stand_by" | "descartar";
      next_steps: string[];
    }>({
      system:
        "Sos un Talent Lead senior. Analizás transcripciones de entrevista cruzándolas con el perfil del candidato y los requisitos de la vacante. Sos objetivo, citás evidencia textual y evitás clichés. Respondés en español neutro.",
      user: `Analizá la transcripción de la entrevista cruzando con el perfil y la vacante. NO devuelvas la transcripción tal cual: extraé insights.

=== PERFIL DEL CANDIDATO ===
${profileBlob}

=== VACANTE ===
${vacancyBlob}

=== TRANSCRIPCIÓN ===
${data.transcript}

Devolvé JSON con:
- summary (4-6 oraciones, narrativa ejecutiva del fit)
- alignment_score (0-100, qué tanto encaja con la vacante según la entrevista)
- strengths (3-6 bullets concretos, observados en la entrevista)
- concerns (2-5 bullets de riesgos / gaps observados)
- evidence (3-6 ítems: topic corto, quote corta del candidato (parafraseada si hace falta, máx 200 chars), insight 1 oración)
- recommendation ("avanzar" | "stand_by" | "descartar")
- next_steps (2-4 bullets accionables para próxima etapa)`,
      schema: {
        name: "interview_analysis",
        description: "Análisis estructurado de entrevista",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string" },
            alignment_score: { type: "number" },
            strengths: { type: "array", items: { type: "string" } },
            concerns: { type: "array", items: { type: "string" } },
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topic: { type: "string" },
                  quote: { type: "string" },
                  insight: { type: "string" },
                },
                required: ["topic", "quote", "insight"],
              },
            },
            recommendation: { type: "string", enum: ["avanzar", "stand_by", "descartar"] },
            next_steps: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "alignment_score", "strengths", "concerns", "evidence", "recommendation", "next_steps"],
        },
      },
    });
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
    const prompt = `Minimal, premium, LIGHT-BACKGROUND corporate recruitment background image for a job posting.
Role: ${v.title}. Area: ${v.area ?? "professional"}. Seniority: ${v.seniority ?? "mid"}. Modality: ${v.modality ?? "remote"}.
Style: very light off-white / cream / pale neutral background, subtle soft pastel geometric shapes and gentle gradients, lots of negative space, airy and modern. The composition MUST keep generous empty area (right half for square/wide, bottom half for vertical) where text and a logo will be overlaid. Photorealistic but minimal, professional, NO TEXT, NO LOGOS, NO PEOPLE FACES, no watermarks, no dark areas, no heavy shadows.`;

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

