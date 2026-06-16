import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ExternalLink, Download } from "lucide-react";
import { downloadCSV } from "@/lib/export-csv";

export const Route = createFileRoute("/app/vacancies/")({
  component: VacanciesList,
  head: () => ({ meta: [{ title: "Vacantes — FLUX Talent" }] }),
});

function VacanciesList() {
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

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl">Vacantes</h1>
          <p className="text-muted-foreground">Gestioná tus búsquedas abiertas.</p>
        </div>
        <Link to="/app/vacancies/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nueva vacante
        </Link>
      </header>

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
        {data?.map((v: any) => (
          <Link key={v.id} to="/app/vacancies/$vacancyId" params={{ vacancyId: v.id }}
            className="flex items-center justify-between border-b border-border p-4 last:border-0 hover:bg-accent/30">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{v.title}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{v.status}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {v.area ?? "—"} · {v.seniority ?? "—"} · {v.applications?.[0]?.count ?? 0} postulantes
              </div>
            </div>
            {v.status === "active" && (
              <a
                href={`/apply/${v.public_slug}`}
                target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-background"
              >
                <ExternalLink className="h-3 w-3" /> Link público
              </a>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
