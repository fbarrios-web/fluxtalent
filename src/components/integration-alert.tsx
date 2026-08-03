import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { getGoogleStatus, getVacancyScheduling } from "@/lib/scheduling.functions";
import { getMicrosoftStatus } from "@/lib/microsoft.functions";
import { useT } from "@/lib/i18n";

/** Yellow warning shown in Kanban and Agenda when no mail/calendar provider is connected. */
export function IntegrationAlert({ context, vacancyId, onGoToAgenda }: {
  context: "kanban" | "agenda";
  vacancyId?: string;
  onGoToAgenda?: () => void;
}) {
  const t = useT();
  const google = useServerFn(getGoogleStatus);
  const microsoft = useServerFn(getMicrosoftStatus);
  const sched = useServerFn(getVacancyScheduling);

  const { data: g, isLoading: lg } = useQuery({ queryKey: ["google-status"], queryFn: () => google() });
  const { data: m, isLoading: lm } = useQuery({ queryKey: ["microsoft-status"], queryFn: () => microsoft() });
  const connected = !!(g?.connected || m?.connected);

  const { data: sc } = useQuery({
    queryKey: ["vac-sched-check", vacancyId],
    queryFn: () => sched({ data: { vacancyId: vacancyId!, stage: "interview_1" } }),
    enabled: connected && !!vacancyId,
  });

  if (lg || lm) return null;

  // Integración conectada pero agenda sin configurar
  if (connected) {
    if (!vacancyId || !sc) return null;
    const configured = (sc.slots?.length ?? 0) > 0 || (sc.rules?.length ?? 0) > 0;
    if (configured) return null;
    return (
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{t("Todavía no configuraste la agenda de esta búsqueda.")}</strong>{" "}
            {t("Ya tenés el calendario conectado, pero hasta que cargues horarios disponibles los postulantes no van a poder reservar entrevista.")}
          </span>
        </div>
        {context === "kanban" && onGoToAgenda && (
          <button
            onClick={onGoToAgenda}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600"
          >
            {t("Configurar agenda")} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>{t("No tenés configurada la integración.")}</strong>{" "}
          {context === "agenda"
            ? t("Sin conectar Google o Microsoft no se envían las invitaciones ni se crean los eventos con link de videollamada.")
            : t("Sin conectar Google o Microsoft no se disparan las comunicaciones automáticas a los postulantes al mover de etapa.")}
        </span>
      </div>
      <Link
        to="/app/settings"
        search={{ tab: "integraciones" } as never}
        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600"
      >
        {t("Ir a configurar")} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
