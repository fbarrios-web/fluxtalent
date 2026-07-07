import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ExternalLink, Download, Search } from "lucide-react";
import { downloadCSV } from "@/lib/export-csv";
import { UsageCard } from "@/components/usage-card";


export const Route = createFileRoute("/app/vacancies/")({
  component: VacanciesList,
  head: () => ({ meta: [{ title: "Vacantes — FLUX Talent" }] }),
});

function VacanciesList() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["vacancies-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vacancies")
        .select("id, title, area, seniority, status, public_slug, created_at, applications:applications(count)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((v: any) =>
      [v.title, v.area, v.seniority, v.status].filter(Boolean).some((s: string) => String(s).toLowerCase().includes(term))
    );
  }, [data, q]);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-10">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Vacantes</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Gestioná tus búsquedas abiertas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!data?.length}
            onClick={() => {
              const rows = (filtered ?? []).map((v: any) => [v.title, v.status, v.applications?.[0]?.count ?? 0]);
              downloadCSV("vacantes", ["Vacante", "Estado", "Postulantes"], rows);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 sm:px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Exportar Excel</span><span className="sm:hidden">Excel</span>
          </button>
          <Link to="/app/vacancies/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-3 sm:px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nueva vacante</span><span className="sm:hidden">Nueva</span>
          </Link>
        </div>
      </header>

      <div className="mb-4"><UsageCard /></div>

      <div className="mb-4 relative max-w-md">

        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por título, área, estado…"
          className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {isLoading && <div className="p-10 text-center text-muted-foreground">Cargando…</div>}
        {!isLoading && !data?.length && (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">No tenés vacantes todavía.</p>
            <Link to="/app/vacancies/new" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <Plus className="h-4 w-4" /> Crear la primera
            </Link>
          </div>
        )}
        {!isLoading && data?.length && !filtered.length && (
          <div className="p-10 text-center text-sm text-muted-foreground">Sin resultados para "{q}".</div>
        )}
        {filtered?.map((v: any) => {
          const isActive = v.status === "active";
          const label = isActive ? "Activa" : v.status === "paused" ? "Desactivada" : v.status === "closed" ? "Cerrada" : "Borrador";
          const badgeCls = isActive
            ? "bg-emerald-100 text-emerald-700"
            : v.status === "paused"
            ? "bg-red-100 text-red-700"
            : "bg-muted text-muted-foreground";
          return (
            <Link key={v.id} to="/app/vacancies/$vacancyId" params={{ vacancyId: v.id }}
              className="flex flex-col gap-3 border-b border-border p-4 last:border-0 hover:bg-accent/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{v.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badgeCls}`}>{label}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {v.area ?? "—"} · {v.seniority ?? "—"} · <span className="font-semibold text-foreground">{v.applications?.[0]?.count ?? 0}</span> postulantes
                </div>
              </div>
              {isActive && (
                <a
                  href={`/apply/${v.public_slug}`}
                  target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center justify-center gap-1 self-start rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-background sm:self-auto"
                >
                  <ExternalLink className="h-3 w-3" /> Link público
                </a>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

