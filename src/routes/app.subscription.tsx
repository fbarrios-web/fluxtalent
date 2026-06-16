import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySubscription, createPreapproval, cancelSubscription } from "@/lib/subscription.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/subscription")({
  component: SubscriptionPage,
  head: () => ({ meta: [{ title: "Suscripción — FLUX Talent" }] }),
});

function SubscriptionPage() {
  const qc = useQueryClient();
  const getSub = useServerFn(getMySubscription);
  const createPre = useServerFn(createPreapproval);
  const cancel = useServerFn(cancelSubscription);

  const { data: sub } = useQuery({ queryKey: ["my-subscription"], queryFn: () => getSub() });

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

  if (!sub) return <div className="grid h-96 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const statusBadge = {
    trialing: { label: "En prueba", cls: "bg-accent text-accent-foreground" },
    active: { label: "Activa", cls: "bg-primary/10 text-primary" },
    past_due: { label: "Pago pendiente", cls: "bg-destructive/10 text-destructive" },
    canceled: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
  }[sub.subscription_status];

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="font-display text-4xl">Suscripción</h1>
      <p className="mt-1 text-muted-foreground">Gestioná tu plan y tus pagos.</p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Plan actual</p>
            <p className="font-display text-3xl">FLUX Talent — ARS {Number(sub.plan_price_ars).toLocaleString("es-AR")}/mes</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.cls}`}>{statusBadge.label}</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Info label={sub.subscription_status === "trialing" ? "Días de prueba restantes" : "Próximo cobro en"} value={`${sub.daysLeft} días`} />
          <Info label="Último pago" value={sub.last_payment_at ? new Date(sub.last_payment_at).toLocaleDateString("es-AR") : "—"} />
          <Info label="Acceso" value={sub.canWrite ? "Completo" : "Solo lectura"} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {sub.subscription_status !== "active" && (
            <Button onClick={() => subscribeMut.mutate()} disabled={subscribeMut.isPending} size="lg">
              {subscribeMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Suscribirme con Mercado Pago
            </Button>
          )}
          {sub.subscription_status === "active" && (
            <Button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending} variant="outline">
              <X className="mr-2 h-4 w-4" /> Cancelar suscripción
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Lo que incluye</h2>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {["Vacantes ilimitadas", "Parsing + matching con IA", "Pipeline Kanban", "Emails automáticos con tu marca", "Coordinación de entrevistas", "Soporte por email"].map(b => (
            <li key={b} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" /> {b}</li>
          ))}
        </ul>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
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
                  <td>ARS {Number(p.amount_ars).toLocaleString("es-AR")}</td>
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
