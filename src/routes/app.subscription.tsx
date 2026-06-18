import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySubscription, createPreapproval, cancelSubscription } from "@/lib/subscription.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { PLANS, planByPrice, formatLimit, formatArs, TRIAL_DAYS } from "@/lib/plans";

export const Route = createFileRoute("/app/subscription")({
  component: SubscriptionPage,
  head: () => ({ meta: [{ title: "Suscripción — FLUX Talent" }] }),
});

function SubscriptionPage() {
  const qc = useQueryClient();
  const getSub = useServerFn(getMySubscription);
  const createPre = useServerFn(createPreapproval);
  const cancel = useServerFn(cancelSubscription);

  const { data: sub, isLoading, error } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => getSub(),
    retry: 1,
  });

  const { data: history } = useQuery({
    queryKey: ["my-payments"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("id, amount_ars, status, paid_at, created_at, provider").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const subscribeMut = useMutation({
    mutationFn: () => createPre(),
    onSuccess: (r) => { window.location.href = r.init_point; },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });
  const cancelMut = useMutation({
    mutationFn: () => cancel(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-subscription"] }); toast.success("Suscripción cancelada"); },
  });

  if (isLoading) return <div className="grid h-96 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="font-display text-4xl">Suscripción</h1>
        <p className="mt-2 text-destructive">No se pudo cargar tu suscripción. Probá recargar la página.</p>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="font-display text-4xl">Suscripción</h1>
        <p className="mt-2 text-muted-foreground">No encontramos tu organización. Completá el alta para activar tu prueba gratuita.</p>
      </div>
    );
  }

  const activePlan = planByPrice(sub.plan_price_ars);
  const isTrial = sub.subscription_status === "trialing";
  const isActive = sub.subscription_status === "active";

  const statusBadges: Record<string, { label: string; cls: string }> = {
    trialing: { label: `En prueba · ${sub.daysLeft} días restantes`, cls: "bg-accent text-accent-foreground" },
    active: { label: "Activa", cls: "bg-primary/10 text-primary" },
    past_due: { label: "Pago pendiente", cls: "bg-destructive/10 text-destructive" },
    canceled: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
  };
  const statusBadge = statusBadges[sub.subscription_status] ?? { label: String(sub.subscription_status), cls: "bg-muted text-muted-foreground" };

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="font-display text-4xl">Suscripción</h1>
      <p className="mt-1 text-muted-foreground">Gestioná tu plan, tu prueba y tus pagos.</p>

      {/* Estado actual */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Plan {isTrial ? "en prueba" : "activo"}</p>
            <p className="font-display text-3xl">FLUX Talent — {activePlan.name}</p>
            <p className="text-sm text-muted-foreground">{formatArs(activePlan.priceArs)}/mes</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.cls}`}>{statusBadge.label}</span>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <Info label={isTrial ? "Días de prueba restantes" : isActive ? "Próximo cobro en" : "Estado"} value={isTrial || isActive ? `${sub.daysLeft} días` : "—"} />
          <Info label="Vacantes incluidas" value={formatLimit(activePlan.maxVacancies)} />
          <Info label="CVs / mes incluidos" value={formatLimit(activePlan.maxCvsPerMonth)} />
          <Info label="Último pago" value={sub.last_payment_at ? new Date(sub.last_payment_at).toLocaleDateString("es-AR") : "—"} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {!isActive && (
            <Button onClick={() => subscribeMut.mutate()} disabled={subscribeMut.isPending} size="lg">
              {subscribeMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              {isTrial ? "Activar suscripción ahora" : "Suscribirme con Mercado Pago"}
            </Button>
          )}
          {isActive && (
            <Button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending} variant="outline">
              <X className="mr-2 h-4 w-4" /> Cancelar suscripción
            </Button>
          )}
        </div>
      </div>

      {/* Planes */}
      <div className="mt-10">
        <h2 className="font-display text-2xl">Planes disponibles</h2>
        <p className="text-sm text-muted-foreground">Todos los planes incluyen {TRIAL_DAYS} días de prueba gratis.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PLANS.map(p => {
            const isCurrent = p.id === activePlan.id;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border bg-card p-6 ${p.highlighted ? "border-primary shadow-sm" : "border-border"}`}
              >
                {p.highlighted && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    <Sparkles className="h-3 w-3" /> Recomendado
                  </span>
                )}
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-2xl">{p.name}</h3>
                  {isCurrent && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Tu plan</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                <div className="mt-4">
                  <span className="font-display text-3xl">{formatArs(p.priceArs)}</span>
                  <span className="text-sm text-muted-foreground"> /mes</span>
                </div>
                <ul className="mt-5 space-y-2 text-sm">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}</li>
                  ))}
                </ul>
                <div className="mt-6 flex-1" />
                {isCurrent ? (
                  <Button variant="outline" disabled className="mt-4 w-full">Plan actual</Button>
                ) : p.contactOnly ? (
                  <Button asChild className="mt-4 w-full" variant="outline">
                    <a href="mailto:hola@fluxautomatizaciones.com?subject=Plan%20Custom%20FLUX%20Talent">Contactar a ventas</a>
                  </Button>
                ) : (
                  <Button className="mt-4 w-full" variant={p.highlighted ? "default" : "outline"} onClick={() => toast.info("Próximamente vas a poder cambiar de plan desde acá. Por ahora escribinos.")}>Elegir {p.name}</Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Historial */}
      <div className="mt-10 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Historial de pagos</h2>
        {!history?.length ? (
          <p className="mt-3 text-sm text-muted-foreground">Cuando hagas tu primer pago, aparece acá.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Fecha</th><th>Monto</th><th>Método</th><th>Estado</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((p: any) => (
                <tr key={p.id}>
                  <td className="py-2">{new Date(p.paid_at ?? p.created_at).toLocaleDateString("es-AR")}</td>
                  <td>{formatArs(Number(p.amount_ars))}</td>
                  <td className="capitalize">{p.provider}</td>
                  <td><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Pago seguro vía Mercado Pago. Cancelás cuando quieras.</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
