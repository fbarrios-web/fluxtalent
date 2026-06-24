// Server-only AI analysis runner using admin client (used by public webhook).
import { aiJSON } from "./ai-gateway.server";

async function fetchCvAsBase64(supabase: any, path: string) {
  const { data, error } = await supabase.storage.from("cvs").download(path);
  if (error || !data) return null;
  const buf = new Uint8Array(await data.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return { b64: btoa(s), mime: data.type || "application/pdf" };
}

export async function runAnalysisAdmin(supabaseAdmin: any, applicationId: string) {
  const { data: app, error } = await supabaseAdmin
    .from("applications")
    .select("*, vacancy:vacancies(*)")
    .eq("id", applicationId)
    .single();
  if (error || !app) throw new Error("not found");

  await supabaseAdmin.from("applications").update({ ai_status: "running" }).eq("id", app.id);

  try {
    let userContent: any;
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Fecha actual: ${today}. Usá esta fecha como referencia: una fecha es "futura" solo si es POSTERIOR a ${today}. No marques como red flag fechas anteriores o iguales a la fecha actual.

Evaluá este candidato contra la vacante.

VACANTE
- Título: ${app.vacancy.title}
- Seniority: ${app.vacancy.seniority ?? "-"}
- Descripción: ${app.vacancy.description ?? "-"}
- Requisitos excluyentes: ${app.vacancy.requirements ?? "-"}
- Deseables: ${app.vacancy.nice_to_have ?? "-"}
- Competencias: ${(app.vacancy.competencies ?? []).join(", ")}

CANDIDATO
- Nombre: ${app.first_name} ${app.last_name}
- Email: ${app.email}
- LinkedIn: ${app.linkedin ?? "-"}
- Respuestas filtro: ${JSON.stringify(app.screening_answers ?? {})}

Extraé experiencia, formación y skills del CV. Calculá match (0-100) general y por categoría. Resumí en 2-3 oraciones. Listá fortalezas, gaps y red flags.`;

    if (app.cv_url) {
      const cv = await fetchCvAsBase64(supabaseAdmin, app.cv_url);
      if (cv) {
        userContent = [
          { type: "text", text: prompt },
          { type: "file", file: { filename: "cv.pdf", file_data: `data:${cv.mime};base64,${cv.b64}` } },
        ];
      }
    }
    if (!userContent) userContent = prompt + "\n(Sin CV adjunto.)";

    const result = await aiJSON<any>({
      system: "Sos un evaluador técnico objetivo. Devolvés sólo el JSON pedido.",
      user: userContent,
      schema: {
        name: "candidate_evaluation",
        description: "Evaluación del candidato",
        parameters: {
          type: "object",
          properties: {
            cv_text: { type: "string" },
            parsed: {
              type: "object",
              properties: {
                experience: { type: "array", items: { type: "string" } },
                education: { type: "array", items: { type: "string" } },
                skills: { type: "array", items: { type: "string" } },
              },
              required: ["experience", "education", "skills"],
            },
            match_score: { type: "integer" },
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

    await supabaseAdmin.from("applications").update({
      cv_text: result.cv_text?.slice(0, 8000),
      parsed_data: result.parsed,
      match_score: result.match_score,
      match_breakdown: result.match_breakdown,
      ai_summary: result.ai_summary,
      strengths: result.strengths,
      gaps: result.gaps,
      red_flags: result.red_flags,
      ai_status: "done",
    }).eq("id", app.id);

    await supabaseAdmin.from("application_events").insert({
      application_id: app.id, type: "ai_analysis", payload: { match_score: result.match_score },
    });

    const min = app.vacancy?.min_match ?? 60;
    if (result.match_score < min && app.stage === "received") {
      await supabaseAdmin.from("applications").update({ stage: "rejected" }).eq("id", app.id);
      await supabaseAdmin.from("application_events").insert({
        application_id: app.id, type: "auto_reject",
        payload: { reason: `match ${result.match_score}% < ${min}%` },
      });
    }
  } catch (e) {
    await supabaseAdmin.from("applications").update({ ai_status: "error" }).eq("id", app.id);
    throw e;
  }
}
