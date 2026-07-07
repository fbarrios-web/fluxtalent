import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Users, Sparkles, TrendingUp, Plus, Clock, FileText, Loader2, AlertTriangle } from "lucide-react";
import { getMySubscription } from "@/lib/subscription.functions";
import { planByPrice, formatLimit } from "@/lib/plans";
import { UsageCard } from "@/components/usage-card";


export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — FLUX Talent" }] }),
});

function Dashboard() {
  const { data: me } = useQuery({
    queryKey: ["me-greeting"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return null;
      const { data: p } = await supabase.from("profiles").select("display_name").eq("id", u.user.id).maybeSingle();
      return { name: p?.display_name || (u.user.email ?? "").split("@")[0] || "" };
    },
    staleTime: 5 * 60_000,
  });
  const { data: vacancies } = useQuery({
    queryKey: ["dashboard-vacancies"],
    queryFn: async () => {
      const { data } = await supabase.from("vacancies").select("id, title, status").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [{ count: total }, { count: hired }, { count: rejected }, { data: matches }] = await Promise.all([
        supabase.from("applications").select("*", { count: "exact", head: true }),
        supabase.from("applications").select("*", { count: "exact", head: true }).eq("stage", "hired"),
        supabase.from("applications").select("*", { count: "exact", head: true }).eq("stage", "rejected"),
        supabase.from("applications").select("match_score").not("match_score", "is", null),
      ]);
      const scores = (matches ?? []).map((m: any) => m.match_score);
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return { total: total ?? 0, hired: hired ?? 0, rejected: rejected ?? 0, avg };
    },
  });
  const { data: recent } = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, first_name, last_name, match_score, stage, vacancy:vacancies(title)")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: liveCounts } = useQuery({
    queryKey: ["dashboard-live-counts"],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setUTCDate(1); startOfMonth.setUTCHours(0, 0, 0, 0);
      const [{ count: vacCount }, { count: cvCount }] = await Promise.all([
        supabase.from("vacancies").select("*", { count: "exact", head: true }).in("status", ["draft", "active", "paused"]),
        supabase.from("applications").select("*", { count: "exact", head: true }).not("cv_url", "is", null).gte("created_at", startOfMonth.toISOString()),
      ]);
      return { vacancies: vacCount ?? 0, cvsThisMonth: cvCount ?? 0 };
    },
    refetchOnWindowFocus: false,
  });

  const getSub = useServerFn(getMySubscription);
  const { data: sub } = useQuery({ queryKey: ["my-subscription"], queryFn: () => getSub(), refetchOnWindowFocus: false });
  const plan = sub ? planByPrice(sub.plan_price_ars) : null;
  const usedVacancies = liveCounts?.vacancies ?? 0;
  const usedCvs = liveCounts?.cvsThisMonth ?? 0;

  const vacAtCap = plan && plan.maxVacancies !== -1 && usedVacancies >= plan.maxVacancies;
  const cvAtCap = plan && plan.maxCvsPerMonth !== -1 && usedCvs >= plan.maxCvsPerMonth;
  const cvNearCap = plan && plan.maxCvsPerMonth !== -1 && !cvAtCap && usedCvs >= Math.floor(plan.maxCvsPerMonth * 0.8);

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl">Bienvenid@! 👋</h1>
          <p className="text-muted-foreground">Esto es lo que pasa en tu pipeline.</p>
        </div>
        <Link to="/app/vacancies/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nueva vacante
        </Link>
      </header>

      <div className="mb-8"><UsageCard /></div>

      {sub && plan && (
        <div className="mb-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan {sub.subscription_status === "trialing" ? "en prueba" : "activo"}</p>
              <p className="font-display text-xl">FLUX Talent — {plan.name}</p>
            </div>
            <Link to="/app/subscription" className="text-sm text-primary hover:underline">Ver suscripción →</Link>
          </div>
          <div className="mt-3">
            <MiniStat
              icon={Clock}
              label={sub.subscription_status === "trialing" ? "Días de prueba restantes" : "Próximo cobro en"}
              value={`${sub.daysLeft} días`}
            />
          </div>
        </div>
      )}



      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={Users} label="Candidatos totales" value={stats?.total ?? 0} />
        <Stat icon={Sparkles} label="Match promedio" value={`${stats?.avg ?? 0}%`} />
        <Stat icon={TrendingUp} label="Contratados" value={stats?.hired ?? 0} accent />
        <Stat icon={Briefcase} label="Descartados" value={stats?.rejected ?? 0} muted />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card title="Vacantes recientes" action={<Link to="/app/vacancies" className="text-sm text-primary hover:underline">Ver todas →</Link>}>
          {!vacancies?.length && <Empty label="No tenés vacantes todavía." cta={<Link to="/app/vacancies/new" className="text-primary hover:underline">Crear la primera</Link>} />}
          <ul className="divide-y divide-border">
            {vacancies?.map(v => (
              <li key={v.id}>
                <Link to="/app/vacancies/$vacancyId" params={{ vacancyId: v.id }} className="flex items-center justify-between py-3 hover:opacity-80">
                  <span className="font-medium">{v.title}</span>
                  <StatusPill status={v.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Postulaciones recientes">
          {!recent?.length && <Empty label="Cuando llegue una postulación, aparece acá." />}
          <ul className="divide-y divide-border">
            {recent?.map((a: any) => (
              <li key={a.id}>
                <Link to="/app/candidates/$id" params={{ id: a.id }} className="flex items-center justify-between py-3 hover:opacity-80">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.first_name} {a.last_name}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.vacancy?.title}</div>
                  </div>
                  <MatchPill score={a.match_score} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent, muted }: any) {
  return (
    <div className={`rounded-2xl border border-border p-5 ${accent ? "bg-primary text-primary-foreground" : muted ? "bg-muted" : "bg-card"}`}>
      <Icon className="h-4 w-4 opacity-70" />
      <div className="mt-3 font-display text-3xl">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}
function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
function Card({ title, children, action }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
function Empty({ label, cta }: any) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{label} {cta}</div>;
}
function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: "bg-primary/10 text-primary",
    draft: "bg-muted text-muted-foreground",
    paused: "bg-warning/20 text-warning",
    closed: "bg-muted text-muted-foreground",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? "bg-muted"}`}>{status}</span>;
}
export function MatchPill({ score, minMatch, aiStatus }: { score: number | null; minMatch?: number | null; aiStatus?: string | null }) {
  if (score == null) {
    if (aiStatus === "error") return <span className="text-xs text-destructive">error de análisis</span>;
    if (aiStatus === "skipped") return <span className="text-xs text-muted-foreground">sin CV</span>;
    return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> analizando…</span>;
  }
  const min = minMatch ?? 60;
  const high = Math.min(95, Math.max(min + 20, 80));
  const c =
    score >= high ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    : score >= min ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
    : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{score}%</span>;
}
