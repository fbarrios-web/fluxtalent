import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySubscription } from "@/lib/subscription.functions";
import { AlertCircle, Clock, Lock } from "lucide-react";
import { useT } from "@/lib/i18n";

export function SubscriptionBanner() {
  const t = useT();
  const fn = useServerFn(getMySubscription);
  const { data } = useQuery({ queryKey: ["my-subscription"], queryFn: () => fn(), refetchOnWindowFocus: false });
  if (!data) return null;

  if (data.subscription_status === "trialing" && data.canWrite) {
    if (data.daysLeft > 5) return null;
    return (
      <Bar tone="warning" icon={Clock}>
        {t("Te quedan {n} días de prueba gratis.", { n: data.daysLeft })}
        <Link to="/app/subscription" className="ml-2 underline font-medium">{t("Suscribirme ahora →")}</Link>
      </Bar>
    );
  }
  if (data.subscription_status === "past_due") {
    const graceMs = (data as any).grace_until ? new Date((data as any).grace_until).getTime() - Date.now() : 0;
    const graceDays = Math.max(0, Math.ceil(graceMs / 86_400_000));
    return (
      <Bar tone="danger" icon={AlertCircle}>
        {graceMs > 0 ? (
          <>
            {t("No pudimos confirmar tu pago. Te damos {n} {dayLabel} de gracia para regularizarlo sin perder el acceso.", { n: graceDays, dayLabel: graceDays === 1 ? t("día") : t("días") })}
          </>
        ) : (
          <>{t("Tu suscripción está pendiente de pago y la cuenta quedó en modo solo-lectura.")}</>
        )}
        <Link to="/app/subscription" className="ml-2 underline font-medium">{t("Completar pago →")}</Link>
      </Bar>
    );
  }
  if (!data.canWrite) {
    const st = (data as any).effective_status;
    const msg =
      st === "trial_expired"
        ? t("Tu período de prueba terminó.")
        : st === "subscription_expired" || st === "canceled_expired"
          ? t("Tu suscripción venció.")
          : t("Tu cuenta no tiene una suscripción activa.");
    return (
      <Bar tone="danger" icon={Lock}>
        {msg} {t("Estás en {mode}.", { mode: t("modo solo-lectura") })}
        <Link to="/app/subscription" className="ml-2 underline font-medium">{t("Activar suscripción →")}</Link>
      </Bar>
    );
  }

  return null;
}

function Bar({ tone, icon: Icon, children }: any) {
  const cls = tone === "danger"
    ? "bg-destructive text-destructive-foreground"
    : "bg-warning/95 text-foreground";
  return (
    <div className={`flex items-center justify-center gap-2 px-4 py-2 text-sm ${cls}`}>
      <Icon className="h-4 w-4" />
      <span>{children}</span>
    </div>
  );
}
