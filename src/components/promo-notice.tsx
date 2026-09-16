import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySubscription, dismissPromoNotice } from "@/lib/subscription.functions";
import { PLANS } from "@/lib/plans";
import { isPromoActive, promoDaysLeft, PROMO_PLAN_ID } from "@/lib/promo";
import { Gift, X, Briefcase, FileText, CalendarClock, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";

/** Cartel de bienvenida de la promo: mes gratis del plan Starter. */
export function PromoNotice() {
  const t = useT();
  const qc = useQueryClient();
  const fn = useServerFn(getMySubscription);
  const dismiss = useServerFn(dismissPromoNotice);
  const { data } = useQuery({ queryKey: ["my-subscription"], queryFn: () => fn(), refetchOnWindowFocus: false });

  if (!data || !isPromoActive(data as any)) return null;

  const plan = PLANS.find(p => p.id === PROMO_PLAN_ID)!;
  const days = promoDaysLeft(data as any);
  const endsAt = new Date((data as any).promo_ends_at).toLocaleDateString("es-AR");
  const acknowledged = !!(data as any).promo_ack_at;

  async function close() {
    await dismiss();
    await qc.invalidateQueries({ queryKey: ["my-subscription"] });
  }

  if (acknowledged) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-primary/5 p-5">
      <button
        type="button"
        onClick={close}
        aria-label={t("Cerrar")}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Gift className="h-5 w-5" />
        </span>
        <div className="space-y-2">
          <h3 className="font-display text-xl">
            {t("¡Gracias por sumarte! Activamos un mes free del plan Starter para vos")}
          </h3>
          <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <CalendarClock className="h-4 w-4 text-primary" />
              {t("Te quedan {n} {dayLabel}", { n: days, dayLabel: days === 1 ? t("día") : t("días") })} · {t("hasta el {date}", { date: endsAt })}
            </span>
          </p>
          <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            <li className="flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-primary" /> {t("Hasta {n} vacantes activas", { n: plan.maxVacancies })}</li>
            <li className="flex items-center gap-1.5"><FileText className="h-4 w-4 text-primary" /> {t("{n} CVs analizados con IA", { n: plan.maxCvsPerMonth })}</li>
          </ul>
          <p className="text-sm">
            {t("Creá tu primera vacante y mirá cómo la IA ordena, puntúa y resume los CVs por vos.")}
          </p>
          <Link
            to="/app/vacancies/new"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {t("Crear mi primera vacante")}
          </Link>
          <p className="text-xs text-muted-foreground">
            {t("Cuando termine el mes, la licencia free finaliza y podés suscribirte para seguir.")}
          </p>
        </div>

      </div>
    </div>
  );
}
