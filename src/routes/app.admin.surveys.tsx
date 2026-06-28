import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListSurveys } from "@/lib/surveys.functions";
import { Loader2, Smile, TrendingUp, ThumbsUp, ThumbsDown, Minus } from "lucide-react";

export const Route = createFileRoute("/app/admin/surveys")({
  component: SurveysPage,
});

function SurveysPage() {
  const fn = useServerFn(adminListSurveys);
  const { data, isLoading } = useQuery({ queryKey: ["admin-surveys"], queryFn: () => fn() });

  if (isLoading) return <div className="grid h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card label="Respuestas totales" value={String(data.total)} icon={<Smile className="h-5 w-5 text-primary" />} />
        <Card label="NPS global" value={`${data.npsScore}`} icon={<TrendingUp className="h-5 w-5 text-primary" />} />
        <Card label="Promotores (9-10)" value={String(data.rows.filter(r => r.nps >= 9).length)} icon={<ThumbsUp className="h-5 w-5 text-emerald-600" />} />
        <Card label="Detractores (0-6)" value={String(data.rows.filter(r => r.nps <= 6).length)} icon={<ThumbsDown className="h-5 w-5 text-rose-600" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[10, 30, 50].map(b => {
          const s = data.byBucket[b];
          return (
            <div key={b} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Día {b}</p>
              <p className="font-display text-3xl">{s.avg.toFixed(1)} <span className="text-base text-muted-foreground">/10</span></p>
              <p className="mt-1 text-sm text-muted-foreground">{s.count} respuestas</p>
              <div className="mt-3 flex gap-2 text-xs">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">P: {s.promoters}</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">N: {s.passives}</span>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">D: {s.detractors}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-xl">Últimas respuestas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Organización</th>
                <th className="px-4 py-3">Día</th>
                <th className="px-4 py-3">NPS</th>
                <th className="px-4 py-3">Comentario</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Sin respuestas aún.</td></tr>
              )}
              {data.rows.map(r => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("es-AR")}</td>
                  <td className="px-4 py-3">{r.user_name}</td>
                  <td className="px-4 py-3">{r.org_name}</td>
                  <td className="px-4 py-3">{r.bucket}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.nps >= 9 ? "bg-emerald-50 text-emerald-700"
                      : r.nps >= 7 ? "bg-amber-50 text-amber-700"
                      : "bg-rose-50 text-rose-700"
                    }`}>
                      {r.nps >= 9 ? <ThumbsUp className="h-3 w-3" /> : r.nps >= 7 ? <Minus className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                      {r.nps}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-md whitespace-pre-wrap text-muted-foreground">{r.comments || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-2 font-display text-3xl">{value}</p>
    </div>
  );
}
