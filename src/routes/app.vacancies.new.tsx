import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createVacancy } from "@/lib/recruiting.functions";
import { aiDraftVacancy } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, ArrowLeft, X, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/vacancies/new")({
  component: NewVacancy,
  head: () => ({ meta: [{ title: "Nueva vacante — FLUX Talent" }] }),
});

function NewVacancy() {
  const nav = useNavigate();
  const create = useServerFn(createVacancy);
  const draft = useServerFn(aiDraftVacancy);

  const [form, setForm] = useState({
    title: "", area: "", seniority: "mid", modality: "remote", location: "",
    description: "", responsibilities: "", requirements: "", nice_to_have: "",
    competencies: [] as string[], min_match: 60, status: "active" as "draft" | "active",
  });
  const [compInput, setCompInput] = useState("");
  const [screening, setScreening] = useState<{ question: string; required: boolean }[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: any) { setForm(f => ({ ...f, [k]: v })); }

  async function aiDraft() {
    if (!form.title) return toast.error("Poné un título primero");
    setDrafting(true);
    try {
      const r = await draft({ data: { title: form.title, seniority: form.seniority, area: form.area, modality: form.modality } });
      setForm(f => ({ ...f, ...r }));
      toast.success("Borrador generado");
    } catch (e: any) { toast.error(e.message); } finally { setDrafting(false); }
  }

  async function save() {
    setSaving(true);
    try {
      const v = await create({ data: { ...form, screening } as any });
      toast.success("Vacante creada");
      nav({ to: "/app/vacancies/$vacancyId", params: { vacancyId: v.id } });
    } catch (e: any) { toast.error(e.message); setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <Link to="/app/vacancies" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <h1 className="font-display text-4xl">Nueva vacante</h1>
      <p className="mt-1 text-muted-foreground">La IA puede armar el borrador por vos.</p>

      <div className="mt-8 space-y-6">
        <Section title="Lo básico">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Título *"><Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Senior Product Designer" /></Field>
            <Field label="Área"><Input value={form.area} onChange={e => set("area", e.target.value)} placeholder="Diseño" /></Field>
            <Field label="Seniority">
              <Select value={form.seniority} onValueChange={v => set("seniority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["intern", "junior", "mid", "senior", "lead", "manager", "director"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Modalidad">
              <Select value={form.modality} onValueChange={v => set("modality", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">Remoto</SelectItem>
                  <SelectItem value="hybrid">Híbrido</SelectItem>
                  <SelectItem value="onsite">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Button variant="outline" onClick={aiDraft} disabled={drafting} className="mt-2">
            {drafting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-primary" />}
            Generar descripción con IA
          </Button>
        </Section>

        <Section title="Descripción del puesto">
          <Field label="Descripción"><Textarea rows={4} value={form.description} onChange={e => set("description", e.target.value)} /></Field>
          <Field label="Responsabilidades"><Textarea rows={5} value={form.responsibilities} onChange={e => set("responsibilities", e.target.value)} /></Field>
          <Field label="Requisitos excluyentes"><Textarea rows={4} value={form.requirements} onChange={e => set("requirements", e.target.value)} /></Field>
          <Field label="Deseables"><Textarea rows={3} value={form.nice_to_have} onChange={e => set("nice_to_have", e.target.value)} /></Field>
          <Field label="Competencias">
            <div className="flex flex-wrap gap-2">
              {form.competencies.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
                  {c} <button onClick={() => set("competencies", form.competencies.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                </span>
              ))}
              <input
                value={compInput}
                onChange={e => setCompInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === "Enter" || e.key === ",") && compInput.trim()) {
                    e.preventDefault();
                    set("competencies", [...form.competencies, compInput.trim()]);
                    setCompInput("");
                  }
                }}
                placeholder="Agregar y Enter"
                className="rounded-full border border-input bg-background px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </Field>
        </Section>

        <Section title="Matching">
          <Field label={`% mínimo de match: ${form.min_match}%`}>
            <input type="range" min={0} max={100} step={5} value={form.min_match} onChange={e => set("min_match", Number(e.target.value))} className="w-full accent-primary" />
            <p className="text-xs text-muted-foreground">Postulaciones por debajo se descartan automáticamente.</p>
          </Field>
        </Section>

        <Section title="Preguntas de filtro (hasta 5)">
          {screening.map((q, i) => (
            <div key={i} className="flex gap-2">
              <Input value={q.question} onChange={e => setScreening(s => s.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} />
              <Button variant="ghost" size="icon" onClick={() => setScreening(s => s.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          {screening.length < 5 && (
            <Button variant="outline" size="sm" onClick={() => setScreening(s => [...s, { question: "", required: false }])}>
              <Plus className="mr-2 h-3 w-3" /> Agregar pregunta
            </Button>
          )}
        </Section>

        <div className="flex items-center justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => set("status", "draft")}>Guardar borrador</Button>
          <Button onClick={save} disabled={saving || !form.title}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Publicar vacante
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 font-semibold">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
function Field({ label, children }: any) {
  return <div><Label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
