import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { moveApplicationStage, updateVacancy } from "@/lib/recruiting.functions";
import { ArrowLeft, ExternalLink, Copy, Loader2, Settings as SettingsIcon, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MatchPill } from "./app.dashboard";
import { VacancyScheduling } from "@/components/vacancy-scheduling";
import { downloadCSV } from "@/lib/export-csv";

const STAGES = [
  { id: "received", label: "Recibidos" },
  { id: "shortlisted", label: "Preseleccionados" },
  { id: "interview_1", label: "Entrevista 1" },
  { id: "interview_2", label: "Entrevista 2" },
  { id: "interview_3", label: "Entrevista 3" },
  { id: "offer", label: "Oferta" },
  { id: "hired", label: "Contratado" },
  { id: "rejected", label: "Descartado" },
] as const;

export const Route = createFileRoute("/app/vacancies/$vacancyId")({
  component: VacancyDetail,
});

function VacancyDetail() {
  const { vacancyId } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const move = useServerFn(moveApplicationStage);
  const update = useServerFn(updateVacancy);

  const storageKey = `kanban-collapsed:${vacancyId}`;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(storageKey) ?? "{}"); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(collapsed)); } catch {}
  }, [collapsed, storageKey]);
  const toggleCollapsed = (id: string) => setCollapsed(c => ({ ...c, [id]: !c[id] }));


  const { data: v } = useQuery<any>({
    queryKey: ["vacancy", vacancyId],
    queryFn: async () => {
      const { data } = await supabase.from("vacancies").select("*").eq("id", vacancyId).single();
      return data;
    },
  });
  const { data: apps } = useQuery({
    queryKey: ["vacancy-apps", vacancyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, first_name, last_name, email, phone, cv_url, stage, match_score, ai_status, created_at")
        .eq("vacancy_id", vacancyId)
        .order("match_score", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  if (!v) return <div className="p-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const applyUrl = `${window.location.origin}/apply/${v.public_slug}`;
  function copyLink() {
    navigator.clipboard.writeText(applyUrl);
    toast.success("Link copiado");
  }

  async function setStatus(status: "active" | "paused" | "closed" | "draft") {
    await update({ data: { id: v.id, patch: { status } } });
    qc.invalidateQueries({ queryKey: ["vacancy", vacancyId] });
    toast.success(`Vacante ${status}`);
  }

  async function onDrop(appId: string, stage: string) {
    const res = await move({ data: { id: appId, stage: stage as any } });
    qc.invalidateQueries({ queryKey: ["vacancy-apps", vacancyId] });
    if ((res as any)?.inviteWarning) toast.warning((res as any).inviteWarning);
    else if (stage.startsWith("interview_")) toast.success("Invitación enviada al postulante");
  }

  return (
    <div className="p-6 md:p-10">
      <Link to="/app/vacancies" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">{v.title}</h1>
          <p className="text-muted-foreground">{v.area ?? "—"} · {v.seniority ?? "—"} · {v.modality ?? "—"} · match mínimo {v.min_match}%</p>
        </div>
        <div className="flex items-center gap-2">
          {v.status === "active" ? (
            <Button variant="outline" onClick={() => setStatus("paused")}>Pausar</Button>
          ) : (
            <Button variant="outline" onClick={() => setStatus("active")}>Activar</Button>
          )}
          <Button variant="outline" onClick={copyLink}><Copy className="mr-2 h-3.5 w-3.5" /> Copiar link</Button>
          <Button
            variant="outline"
            disabled={!apps?.length}
            onClick={() => {
              const rows = (apps ?? []).map((a: any) => [
                `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(),
                a.email ?? "",
                a.phone ?? "",
                a.cv_url ?? "",
                a.stage ?? "",
                a.match_score != null ? `${a.match_score}%` : "",
              ]);
              downloadCSV(
                `postulantes-${v.public_slug ?? v.id}`,
                ["Postulante", "Email", "Teléfono", "CV", "Estado", "Match %"],
                rows,
              );
            }}
          >
            <Download className="mr-2 h-3.5 w-3.5" /> Exportar Excel
          </Button>
          <a href={applyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            <ExternalLink className="h-3.5 w-3.5" /> Ver form
          </a>
        </div>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="table">Tabla</TabsTrigger>
          <TabsTrigger value="brief">Brief</TabsTrigger>
          <TabsTrigger value="scheduling">Entrevistas</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-6">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map(s => {
              const items = (apps ?? []).filter((a: any) => a.stage === s.id);
              return (
                <div
                  key={s.id}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) onDrop(id, s.id);
                  }}
                  className="flex w-64 shrink-0 flex-col rounded-2xl bg-muted/40 p-3"
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</span>
                    <span className="rounded-full bg-background px-2 text-xs">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((a: any) => (
                      <div
                        key={a.id}
                        draggable
                        onDragStart={e => e.dataTransfer.setData("text/plain", a.id)}
                        onClick={() => nav({ to: "/app/candidates/$id", params: { id: a.id } })}
                        className="cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm hover:border-primary active:cursor-grabbing"
                      >
                        <div className="flex items-center justify-between">
                          <div className="truncate text-sm font-medium">{a.first_name} {a.last_name}</div>
                          <MatchPill score={a.match_score} />
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{a.email}</div>
                      </div>
                    ))}
                    {!items.length && <div className="rounded-lg border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="table" className="mt-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Candidato</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Etapa</th>
                  <th className="px-4 py-2">Match</th>
                </tr>
              </thead>
              <tbody>
                {(apps ?? []).map((a: any) => (
                  <tr key={a.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/30" onClick={() => nav({ to: "/app/candidates/$id", params: { id: a.id } })}>
                    <td className="px-4 py-3 font-medium">{a.first_name} {a.last_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.stage}</td>
                    <td className="px-4 py-3"><MatchPill score={a.match_score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="brief" className="mt-6">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <BriefSection title="Descripción" body={v.description} />
            <BriefSection title="Responsabilidades" body={v.responsibilities} />
            <BriefSection title="Requisitos excluyentes" body={v.requirements} />
            <BriefSection title="Deseables" body={v.nice_to_have} />
            <div>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Competencias</h4>
              <div className="flex flex-wrap gap-2">
                {(v.competencies ?? []).map((c: string) => <span key={c} className="rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">{c}</span>)}
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="scheduling" className="mt-6">
          <VacancyScheduling vacancyId={vacancyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BriefSection({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <p className="whitespace-pre-wrap text-sm">{body}</p>
    </div>
  );
}
