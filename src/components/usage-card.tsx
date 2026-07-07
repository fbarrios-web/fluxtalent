import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUsageSummary } from "@/lib/subscription.functions";
import { AlertTriangle, Briefcase, FileText, Sparkles, CalendarClock } from "lucide-react";

function fmt(n: number) { return n === -1 ? "∞" : n.toLocaleString("es-AR"); }
function pct(used: number, max: number) { return max <= 0 ? 0 : Math.min(100, Math.round((used / max) * 100)); }

function Bar({ used, max, label, icon: Icon, tone }: { used: number; max: number; label: string; icon: any; tone?: string }) {
  const unlimited = max === -1;
  const p = unlimited ? 0 : pct(used, max);
  const barColor = p >= 100 ? "bg-destructive" : p >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4" />{label}</span>
        <span className="font-medium tabular-nums">{fmt(used)} / {fmt(max)}</span>
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${barColor} transition-all`} style={{ width: `${p}%` }} />
        </div>
      )}
      {tone && <p className="text-xs text-warning-foreground/80 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {tone}</p>}
    </div>
  );
}

export function UsageCard() {
  const fn = useServerFn(getUsageSummary);
  const { data } = useQuery({ queryKey: ["usage-summary"], queryFn: () => fn(), refetchOnWindowFocus: false });
  if (!data) return null;

  const activePct = pct(data.activeVacancies, data.maxActiveVacancies);
  const newPct = pct(data.newVacanciesThisCycle, data.maxNewVacanciesPerCycle);
  const cvsPct = pct(data.cvsThisCycle, data.maxCvsPerCycle);

  const alerts: string[] = [];
  if (data.maxActiveVacancies !== -1 && activePct >= 80) alerts.push(`Vacantes activas al ${activePct}% del límite del plan.`);
  if (data.maxNewVacanciesPerCycle !== -1 && newPct >= 80) alerts.push(`Vacantes nuevas del ciclo al ${newPct}% del límite.`);
  if (data.maxCvsPerCycle !== -1 && cvsPct >= 80) alerts.push(`CVs procesados al ${cvsPct}% del cupo del ciclo.`);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">Uso del plan {data.planName}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> Renovación: {new Date(data.cycleEnd).toLocaleDateString("es-AR")}
          </p>
        </div>
        {alerts.length > 0 && (
          <div className="rounded-full bg-warning/20 text-foreground px-3 py-1 text-xs font-medium flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Cerca del límite
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Bar used={data.activeVacancies} max={data.maxActiveVacancies} label="Vacantes activas" icon={Briefcase} />
        <Bar used={data.newVacanciesThisCycle} max={data.maxNewVacanciesPerCycle} label="Nuevas del ciclo" icon={Sparkles} />
        <Bar used={data.cvsThisCycle} max={data.maxCvsPerCycle} label="CVs del ciclo" icon={FileText} />
      </div>
      {alerts.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5 border-t border-border pt-2">
          {alerts.map((a, i) => <li key={i}>• {a}</li>)}
        </ul>
      )}
    </div>
  );
}
