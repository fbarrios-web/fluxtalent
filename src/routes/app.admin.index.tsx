import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { adminMetrics } from "@/lib/admin.functions";
import { Building2, Users, Briefcase, FileText, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const signupChartConfig = {
  count: { label: "Nuevos usuarios", color: "var(--chart-1)" },
} satisfies ChartConfig;

export const Route = createFileRoute("/app/admin/")({
  component: AdminMetrics,
});

function AdminMetrics() {
  const t = useT();
  const fn = useServerFn(adminMetrics);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const { data, isLoading } = useQuery({ queryKey: ["admin-metrics"], queryFn: () => fn() });

  if (isLoading || !data) return <div className="grid h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const ddmm = (d: string) => { const m = d.match(/(\d{2})-(\d{2})$/); return m ? `${m[2]}/${m[1]}` : d; };
  const chartData = data.signupsByDay.map(d => ({ ...d, label: ddmm(d.date) }));
  const toggleDay = (d: string) => setSelectedDays(s => s.includes(d) ? s.filter(x => x !== d) : [...s, d]);
  const selectedTotal = data.signupsByDay.filter(d => selectedDays.includes(d.date)).reduce((a, d) => a + d.count, 0);
  const total14 = data.signupsByDay.reduce((sum, d) => sum + d.count, 0);
  const peak = data.signupsByDay.reduce((best, d) => (d.count > best.count ? d : best), { date: "—", count: 0 });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPI icon={Building2} label={t("Organizaciones")} value={data.orgs} />
        <KPI icon={Users} label={t("Usuarios")} value={data.users} />
        <KPI icon={Briefcase} label={t("Vacantes")} value={data.vacancies} />
        <KPI icon={FileText} label={t("Postulaciones")} value={data.applications} />
        <KPI icon={TrendingUp} label={t("MRR estimado")} value={`ARS ${data.mrr.toLocaleString("es-AR")}`} accent />
        <KPI icon={DollarSign} label={t("Cobrado 30d")} value={`ARS ${data.revenue30.toLocaleString("es-AR")}`} accent />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold">{t("Distribución por estado")}</h3>
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
          <h3 className="font-semibold">{t("Nuevos usuarios · últimos 14 días")}</h3>
          <ChartContainer config={signupChartConfig} className="mt-4 h-44 w-full">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={8} tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} width={30} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
            </LineChart>
          </ChartContainer>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("Total 14 días")}: <span className="font-semibold text-foreground">{total14}</span> · {t("Día más alto")}: <span className="font-semibold text-foreground">{peak.count}</span> ({ddmm(peak.date)})
          </p>
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs font-medium">{t("Filtrar días")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.signupsByDay.map(d => {
                const on = selectedDays.includes(d.date);
                return (
                  <button key={d.date} type="button" onClick={() => toggleDay(d.date)} aria-pressed={on}
                    className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
                    {ddmm(d.date)}
                  </button>
                );
              })}
            </div>
            {selectedDays.length > 0 && (
              <p className="mt-2 text-sm">
                {t("Total días seleccionados")} ({selectedDays.length}): <span className="font-semibold">{selectedTotal}</span>
                <button type="button" onClick={() => setSelectedDays([])} className="ml-2 text-xs text-muted-foreground underline">{t("Limpiar")}</button>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">{t("Actividad · top eventos últimos 7 días")}</h3>
        {!data.topEvents.length ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("Todavía no hay eventos registrados.")}</p>
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
