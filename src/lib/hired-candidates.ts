export const HIRED_API_USER_ID = "0bb5ba5e-e88a-4d2f-895b-96cce17d64d7";
export const HIRED_API_ORG_ID = "96b96f6d-1f33-43dc-ab25-e18a4eb7a80c";

type StageEvent = { type: string; payload: unknown; created_at: string };
export type HiredApplication = {
  id: string; org_id: string; vacancy_id: string; stage: string;
  first_name: string; last_name: string; email: string; phone: string | null;
  linkedin: string | null; ai_summary: string | null;
  application_events: StageEvent[];
};

export function serializeHiredCandidate(application: HiredApplication) {
  if (application.org_id !== HIRED_API_ORG_ID || application.stage !== "hired") return null;
  const transitions = application.application_events
    .filter((event) => event.type === "stage_change" && event.payload &&
      typeof event.payload === "object" && "stage" in event.payload)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  let hiredAt: string | null = null;
  // Repeated saves of the same stage must not move the hiring date forward.
  for (const event of transitions) {
    if ((event.payload as { stage: unknown }).stage !== "hired") break;
    hiredAt = event.created_at;
  }
  return {
    id: application.id,
    vacante_id: application.vacancy_id,
    nombre: application.first_name,
    apellido: application.last_name,
    contacto: { email: application.email, telefono: application.phone, linkedin: application.linkedin },
    contratado_desde: hiredAt,
    resumen_informe: application.ai_summary,
  };
}