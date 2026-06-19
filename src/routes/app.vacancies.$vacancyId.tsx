import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { moveApplicationStage, updateVacancy, manualCreateApplication } from "@/lib/recruiting.functions";
import { ArrowLeft, ExternalLink, Copy, Loader2, Download, ChevronLeft, ChevronRight, Pencil, UserPlus, ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aiVacancyImage } from "@/lib/ai.functions";
import { MatchPill } from "./app.dashboard";
import { VacancyScheduling } from "@/components/vacancy-scheduling";
import { downloadCSV } from "@/lib/export-csv";
import { ScreeningEditor } from "./app.vacancies.new";

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
    else if (stage === "rejected") toast.success("Email de descarte enviado");
    else if (stage === "offer") toast.success("Email de oferta enviado");
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
          <EditVacancyDialog vacancy={v} onSaved={() => qc.invalidateQueries({ queryKey: ["vacancy", vacancyId] })} />
          <VacancyImageDialog vacancy={v} applyUrl={applyUrl} />
          <AddCandidateDialog vacancyId={v.id} onAdded={() => qc.invalidateQueries({ queryKey: ["vacancy-apps", vacancyId] })} />
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

function EditVacancyDialog({ vacancy, onSaved }: { vacancy: any; onSaved: () => void }) {
  const update = useServerFn(updateVacancy);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patch, setPatch] = useState({
    title: vacancy.title ?? "",
    area: vacancy.area ?? "",
    seniority: vacancy.seniority ?? "mid",
    modality: vacancy.modality ?? "remote",
    location: vacancy.location ?? "",
    work_schedule: vacancy.work_schedule ?? "",
    description: vacancy.description ?? "",
    responsibilities: vacancy.responsibilities ?? "",
    requirements: vacancy.requirements ?? "",
    nice_to_have: vacancy.nice_to_have ?? "",
    min_match: vacancy.min_match ?? 60,
  });
  const [screening, setScreening] = useState<any[]>([]);
  const [loadedQs, setLoadedQs] = useState(false);

  useEffect(() => {
    if (!open || loadedQs) return;
    (async () => {
      const { data } = await supabase
        .from("screening_questions")
        .select("question, required, qtype, options, position")
        .eq("vacancy_id", vacancy.id)
        .order("position");
      setScreening((data ?? []).map((q: any) => ({
        question: q.question, required: q.required,
        qtype: q.qtype ?? "text", options: q.options ?? [],
      })));
      setLoadedQs(true);
    })();
  }, [open, loadedQs, vacancy.id]);

  async function save() {
    setSaving(true);
    try {
      await update({ data: { id: vacancy.id, patch, screening } as any });
      toast.success("Vacante actualizada");
      onSaved();
      setOpen(false);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Pencil className="mr-2 h-3.5 w-3.5" /> Editar</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Editar vacante</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Título</Label><Input value={patch.title} onChange={e => setPatch(p => ({ ...p, title: e.target.value }))} /></div>
              <div><Label>Área</Label><Input value={patch.area} onChange={e => setPatch(p => ({ ...p, area: e.target.value }))} /></div>
            </div>
            <div><Label>Descripción</Label><Textarea rows={3} value={patch.description} onChange={e => setPatch(p => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Responsabilidades</Label><Textarea rows={4} value={patch.responsibilities} onChange={e => setPatch(p => ({ ...p, responsibilities: e.target.value }))} /></div>
            <div><Label>Requisitos excluyentes</Label><Textarea rows={3} value={patch.requirements} onChange={e => setPatch(p => ({ ...p, requirements: e.target.value }))} /></div>
            <div><Label>Deseables</Label><Textarea rows={2} value={patch.nice_to_have} onChange={e => setPatch(p => ({ ...p, nice_to_have: e.target.value }))} /></div>
            <div>
              <Label>% mínimo de match: {patch.min_match}%</Label>
              <input type="range" min={0} max={100} step={5} value={patch.min_match}
                onChange={e => setPatch(p => ({ ...p, min_match: Number(e.target.value) }))}
                className="w-full accent-primary" />
            </div>
            <div>
              <Label className="mb-2 block">Preguntas de filtro</Label>
              {loadedQs ? <ScreeningEditor screening={screening} setScreening={setScreening} /> : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddCandidateDialog({ vacancyId, onAdded }: { vacancyId: string; onAdded: () => void }) {
  const create = useServerFn(manualCreateApplication);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", linkedin: "" });
  const [cv, setCv] = useState<File | null>(null);

  async function save() {
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error("Nombre, apellido y email son obligatorios");
      return;
    }
    setSaving(true);
    try {
      let cv_base64: string | null = null;
      let cv_filename: string | null = null;
      let cv_mime: string | null = null;
      if (cv) {
        if (cv.size > 10 * 1024 * 1024) throw new Error("CV mayor a 10MB");
        const buf = new Uint8Array(await cv.arrayBuffer());
        let binary = "";
        for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
        cv_base64 = btoa(binary);
        cv_filename = cv.name;
        cv_mime = cv.type || "application/pdf";
      }
      await create({ data: { vacancy_id: vacancyId, ...form, cv_base64, cv_filename, cv_mime } });
      toast.success("Candidato agregado" + (cv ? " — analizando CV…" : ""));
      onAdded();
      setOpen(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "", linkedin: "" });
      setCv(null);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><UserPlus className="mr-2 h-3.5 w-3.5" /> Agregar candidato</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Agregar candidato manualmente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Nombre *</Label><Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
              <div><Label>Apellido *</Label><Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            </div>
            <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>LinkedIn</Label><Input value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} /></div>
            </div>
            <div>
              <Label>CV (PDF, máx 10MB)</Label>
              <Input type="file" accept=".pdf,.doc,.docx" onChange={e => setCv(e.target.files?.[0] ?? null)} />
              {cv && <div className="mt-1 text-xs text-muted-foreground">{cv.name} · {(cv.size / 1024).toFixed(0)}KB</div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
