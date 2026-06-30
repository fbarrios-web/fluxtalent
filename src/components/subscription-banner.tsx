import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySubscription } from "@/lib/subscription.functions";
import { AlertCircle, Clock, Lock } from "lucide-react";

export function SubscriptionBanner() {
  const fn = useServerFn(getMySubscription);
  const { data } = useQuery({ queryKey: ["my-subscription"], queryFn: () => fn(), refetchOnWindowFocus: false });
  if (!data) return null;

  if (data.subscription_status === "trialing" && data.canWrite) {
    if (data.daysLeft > 5) return null;
    return (
      <Bar tone="warning" icon={Clock}>
        Te quedan <b>{data.daysLeft} días</b> de prueba gratis.
        <Link to="/app/subscription" className="ml-2 underline font-medium">Suscribirme ahora →</Link>
      </Bar>
    );
  }
  if (data.subscription_status === "past_due") {
    return (
      <Bar tone="danger" icon={AlertCircle}>
        Tu suscripción está <b>pendiente de pago</b>. No vas a poder usar el sistema hasta que Mercado Pago confirme el cobro.
        <Link to="/app/subscription" className="ml-2 underline font-medium">Completar pago →</Link>
      </Bar>
    );
  }
  if (!data.canWrite) {
    return (
      <Bar tone="danger" icon={Lock}>
        Tu período de prueba terminó. Estás en <b>modo solo-lectura</b>.
        <Link to="/app/subscription" className="ml-2 underline font-medium">Activar suscripción →</Link>
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
