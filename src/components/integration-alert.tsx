import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { getGoogleStatus } from "@/lib/scheduling.functions";
import { getMicrosoftStatus } from "@/lib/microsoft.functions";

/** Yellow warning shown in Kanban and Agenda when no mail/calendar provider is connected. */
export function IntegrationAlert({ context }: { context: "kanban" | "agenda" }) {
  const google = useServerFn(getGoogleStatus);
  const microsoft = useServerFn(getMicrosoftStatus);

  const { data: g, isLoading: lg } = useQuery({ queryKey: ["google-status"], queryFn: () => google() });
  const { data: m, isLoading: lm } = useQuery({ queryKey: ["microsoft-status"], queryFn: () => microsoft() });

  if (lg || lm) return null;
  if (g?.connected || m?.connected) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>No tenés configurada la integración.</strong>{" "}
          {context === "agenda"
            ? "Sin conectar Google o Microsoft no se envían las invitaciones ni se crean los eventos con link de videollamada."
            : "Sin conectar Google o Microsoft no se disparan las comunicaciones automáticas a los postulantes al mover de etapa."}
        </span>
      </div>
      <Link
        to="/app/settings"
        search={{ tab: "integraciones" } as never}
        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600"
      >
        Ir a configurar <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
