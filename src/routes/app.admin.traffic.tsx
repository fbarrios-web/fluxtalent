import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminTraffic } from "@/lib/traffic.functions";
import { Loader2, Users, Eye, UserPlus, Timer, TrendingDown, Percent } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/app/admin/traffic")({
  component: AdminTraffic,
});

const RANGES = [7, 30, 90];

function AdminTraffic() {
  const t = useT();
  const [days, setDays] = useState(30);
  const fn = useServerFn(adminTraffic);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-traffic", days],
    queryFn: () => fn({ data: { days } }),
    refetchInterval: 60000,
  });

  if (isLoading || !data)
    return <div className="grid h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const maxDay = Math.max(1, ...data.daily.map((d) => d.sessions));
  const mins = Math.floor(data.totals.avgSeconds / 60);
  const secs = data.totals.avgSeconds % 60;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("Visitas a la plataforma (no incluye los links públicos de vacantes ni de agenda).")}
        </p>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`rounded-md px-3 py-1 text-sm ${days === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {r} {t("días")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPI icon={Users} label={t("Visitantes")} value={data.totals.sessions} />
        <KPI icon={Eye} label={t("Páginas vistas")} value={data.totals.pageviews} />
        <KPI icon={UserPlus} label={t("Cuentas creadas")} value={data.totals.signups} accent />
        <KPI icon={Percent} label={t("Conversión")} value={`${data.totals.conversion}%`} accent />
        <KPI icon={Timer} label={t("Tiempo promedio")} value={`${mins}m ${secs}s`} />
        <KPI icon={TrendingDown} label={t("Rebote")} value={`${data.totals.bounceRate}%`} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">{t("Visitas por día")}</h3>
        <div className="mt-4 flex h-40 items-end gap-1">
          {data.daily.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.sessions} visitas · ${d.signups} cuentas`}>
              <div className="flex w-full flex-col justify-end" style={{ height: "100%" }}>
                <div className="w-full rounded-t bg-primary/80" style={{ height: `${(d.sessions / maxDay) * 100}%`, minHeight: d.sessions > 0 ? 3 : 0 }} />
                {d.signups > 0 && <div className="w-full bg-chart-2" style={{ height: `${(d.signups / maxDay) * 100}%`, minHeight: 3 }} />}
              </div>
              <span className="text-[9px] text-muted-foreground">{d.date}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">{t("Embudo: de la visita a la vacante")}</h3>
        <div className="mt-4 space-y-3">
          {data.funnel.map((f, i) => {
            const base = data.funnel[0].count || 1;
            const pct = Math.round((f.count / base) * 100);
            const prev = i > 0 ? data.funnel[i - 1].count : null;
            const drop = prev && prev > 0 ? Math.round(((prev - f.count) / prev) * 100) : 0;
            return (
              <div key={f.step}>
                <div className="flex justify-between text-sm">
                  <span>{t(f.step)}</span>
                  <span className="text-muted-foreground">
                    {f.count} ({pct}%){i > 0 && drop > 0 ? ` · -${drop}%` : ""}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${drop >= 50 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Table title={t("De dónde vienen")} rows={data.bySource} total={data.totals.sessions} />
        <Table title={t("Campañas (utm_campaign)")} rows={data.byCampaign} total={data.totals.sessions} empty={t("Sin campañas etiquetadas todavía.")} />
        <Table title={t("Dispositivo")} rows={data.byDevice} total={data.totals.sessions} />
        <Table title={t("País")} rows={data.byCountry} total={data.totals.sessions} />
        <Table title={t("Navegador / app")} rows={data.byBrowser} total={data.totals.sessions} />
        <Table title={t("Página de entrada")} rows={data.byLanding} total={data.totals.sessions} />
        <Table title={t("Páginas más vistas")} rows={data.byPage} total={data.totals.pageviews} />
        <Table title={t("Acciones más usadas")} rows={data.byAction} total={data.totals.pageviews} empty={t("Todavía no hay acciones registradas.")} />
      </div>
    </div>
  );
}

function Table({ title, rows, total, empty }: { title: string; rows: { label: string; count: number }[]; total: number; empty?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold">{title}</h3>
      {!rows.length ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty ?? "—"}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex justify-between text-sm">
                <span className="truncate pr-2">{r.label}</span>
                <span className="shrink-0 text-muted-foreground">{r.count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary/70" style={{ width: `${total ? Math.round((r.count / total) * 100) : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
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
