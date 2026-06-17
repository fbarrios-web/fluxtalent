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
  { id: "received",    label: "Recibidos",     color: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200" },
  { id: "interview_1", label: "Entrevista 1",  color: "bg-sky-200 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200" },
  { id: "interview_2", label: "Entrevista 2",  color: "bg-indigo-200 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200" },
  { id: "interview_3", label: "Entrevista 3",  color: "bg-violet-200 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200" },
  { id: "offer",       label: "Oferta",        color: "bg-amber-200 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" },
  { id: "hired",       label: "Contratado",    color: "bg-emerald-200 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200" },
  { id: "rejected",    label: "Descartado",    color: "bg-red-200 text-red-800 dark:bg-red-500/20 dark:text-red-200" },
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
          <TabsTrigger value="pipeline">Etapas</TabsTrigger>
          <TabsTrigger value="table">Tabla</TabsTrigger>
          <TabsTrigger value="brief">Detalle de vacante</TabsTrigger>
          <TabsTrigger value="scheduling">Agenda</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-6">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map(s => {
              const items = (apps ?? []).filter((a: any) => a.stage === s.id);
              const isCollapsed = !!collapsed[s.id];
              if (isCollapsed) {
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleCollapsed(s.id)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) onDrop(id, s.id);
                    }}
                    title={`Expandir ${s.label}`}
                    className="flex w-10 shrink-0 flex-col items-center gap-2 rounded-2xl bg-muted/40 p-2 hover:bg-muted/70"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <span className="rounded-full bg-background px-2 text-xs">{items.length}</span>
                    <span
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              }
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
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(s.id)}
                        title="Minimizar"
                        className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.color}`}>{s.label}</span>
                    </div>
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
                          <MatchPill score={a.match_score} minMatch={v.min_match} />
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
                    <td className="px-4 py-3"><MatchPill score={a.match_score} minMatch={v.min_match} /></td>
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
