import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminMetrics } from "@/lib/admin.functions";
import { Building2, Users, Briefcase, FileText, TrendingUp, DollarSign, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/admin/")({
  component: AdminMetrics,
});

function AdminMetrics() {
  const fn = useServerFn(adminMetrics);
  const { data, isLoading } = useQuery({ queryKey: ["admin-metrics"], queryFn: () => fn() });

  if (isLoading || !data) return <div className="grid h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const max = Math.max(1, ...data.signupsByDay.map(d => d.count));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPI icon={Building2} label="Organizaciones" value={data.orgs} />
        <KPI icon={Users} label="Usuarios" value={data.users} />
        <KPI icon={Briefcase} label="Vacantes" value={data.vacancies} />
        <KPI icon={FileText} label="Postulaciones" value={data.applications} />
        <KPI icon={TrendingUp} label="MRR estimado" value={`ARS ${data.mrr.toLocaleString("es-AR")}`} accent />
        <KPI icon={DollarSign} label="Cobrado 30d" value={`ARS ${data.revenue30.toLocaleString("es-AR")}`} accent />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold">Distribución por estado</h3>
          <div className="mt-4 space-y-3">
            {(["trialing", "active", "past_due", "canceled"] as const).map(k => {
              const v = data.byStatus[k] ?? 0;
              const total = Object.values(data.byStatus).reduce((a, b) => a + b, 0) || 1;
              const pct = Math.round((v / total) * 100);
              return (
                <div key={k}>
                  <div className="flex justify-between text-sm"><span className="capitalize">{k.replace("_", " ")}</span><span className="text-muted-foreground">{v} ({pct}%)</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${k === "active" ? "bg-primary" : k === "trialing" ? "bg-chart-2" : k === "past_due" ? "bg-destructive" : "bg-muted-foreground"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold">Nuevas organizaciones · últimos 14 días</h3>
          <div className="mt-4 flex h-40 items-end gap-1">
            {data.signupsByDay.map(d => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-primary/80" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }} title={`${d.date}: ${d.count}`} />
                <span className="text-[10px] text-muted-foreground">{d.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">Actividad · top eventos últimos 7 días</h3>
        {!data.topEvents.length ? (
          <p className="mt-3 text-sm text-muted-foreground">Todavía no hay eventos registrados.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.topEvents.map(e => (
              <li key={e.type} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono text-xs">{e.type}</span>
                <span className="font-semibold">{e.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, accent }: any) {
  return (
    <div className={`rounded-2xl border border-border p-5 ${accent ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <Icon className="h-4 w-4 opacity-70" />
      <div className="mt-2 font-display text-2xl leading-none">{value}</div>
      <div className="mt-1 text-xs opacity-70">{label}</div>
    </div>
  );
}
