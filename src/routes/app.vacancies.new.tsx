import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createVacancy } from "@/lib/recruiting.functions";
import { aiDraftVacancy } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, ArrowLeft, X, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/vacancies/new")({
  component: NewVacancy,
  head: () => ({ meta: [{ title: "Nueva vacante — FLUX Talent" }] }),
});

type SQ = {
  question: string;
  required: boolean;
  qtype: "text" | "single" | "multi";
  options: { value: string; discard: boolean }[];
};

function NewVacancy() {
  const nav = useNavigate();
  const create = useServerFn(createVacancy);
  const draft = useServerFn(aiDraftVacancy);

  const { data: gate, isLoading: gateLoading } = useQuery({
    queryKey: ["vacancy-create-gate"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: profile } = await supabase.from("profiles").select("google_refresh_token, microsoft_refresh_token, org_id").eq("id", u.user.id).maybeSingle();
      let org: any = null;
      if (profile?.org_id) {
        const { data } = await supabase.from("organizations").select("name").eq("id", profile.org_id).maybeSingle();
        org = data;
      }
      const gmailOk = !!profile?.google_refresh_token || !!profile?.microsoft_refresh_token;
      const orgOk = !!org?.name;
      return { gmailOk, orgOk };
    },
  });

  const [form, setForm] = useState({
    title: "", area: "", seniority: "mid", modality: "remote", location: "", work_schedule: "",
    description: "", responsibilities: "", requirements: "", nice_to_have: "",
    competencies: [] as string[], min_match: 60, status: "active" as "draft" | "active",
  });
  const [compInput, setCompInput] = useState("");
  const [screening, setScreening] = useState<SQ[]>([]);
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

  if (gateLoading) {
    return <div className="p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const blocked = gate && (!gate.gmailOk || !gate.orgOk);

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <Link to="/app/vacancies" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <h1 className="font-display text-4xl">Nueva vacante</h1>
      <p className="mt-1 text-muted-foreground">La IA puede armar el borrador por vos.</p>

      {blocked && (
        <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <h3 className="font-semibold">Antes de crear vacantes necesitás configurar lo siguiente:</h3>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {!gate?.gmailOk && (
                  <li>
                    Conectar tu cuenta de <b>Google</b> o <b>Microsoft</b>{" "}
                    <Link to="/app/integrations" className="text-primary underline">Ir a Integraciones</Link>
                  </li>
                )}
                {!gate?.orgOk && (
                  <li>
                    Completar <b>nombre de la empresa</b> y <b>email remitente</b>{" "}
                    <Link to="/app/settings" className="text-primary underline">Ir a Configuración</Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <fieldset disabled={!!blocked} className={blocked ? "pointer-events-none opacity-50" : ""}>
      <div className="mt-8 space-y-6">
        <Section title="Lo básico">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Título *"><Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Senior Product Designer" /></Field>
            <Field label="Área"><Input value={form.area} onChange={e => set("area", e.target.value)} placeholder="Diseño" /></Field>
            <Field label="Seniority">
              <Select value={form.seniority} onValueChange={v => set("seniority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="mid">Semi Senior</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
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
            {(form.modality === "hybrid" || form.modality === "onsite") && (
              <>
                <Field label="Ubicación"><Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="CABA, Argentina" /></Field>
                <Field label="Días y horario laboral"><Input value={form.work_schedule} onChange={e => set("work_schedule", e.target.value)} placeholder="Lun a Vie 9 a 18hs" /></Field>
              </>
            )}
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

        <Section title="Preguntas de filtro (hasta 10)">
          <p className="text-xs text-muted-foreground">
            Texto libre, opción única u opción múltiple. En las opciones podés marcar una respuesta como excluyente:
            si el postulante la elige, se <b>descarta automáticamente</b>.
          </p>
          <ScreeningEditor screening={screening} setScreening={setScreening} />
        </Section>

        <div className="flex items-center justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => set("status", "draft")}>Guardar borrador</Button>
          <Button onClick={save} disabled={saving || !form.title}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Publicar vacante
          </Button>
        </div>
      </div>
      </fieldset>
    </div>
  );
}

export function ScreeningEditor({ screening, setScreening }: { screening: SQ[]; setScreening: (fn: any) => void }) {
  function update(i: number, patch: Partial<SQ>) {
    setScreening((s: SQ[]) => s.map((x, j) => j === i ? { ...x, ...patch } : x));
  }
  function remove(i: number) { setScreening((s: SQ[]) => s.filter((_, j) => j !== i)); }
  return (
    <div className="space-y-4">
      {screening.map((q, i) => (
        <div key={i} className="rounded-xl border border-border bg-background p-3 space-y-3">
          <div className="flex gap-2">
            <Input value={q.question} placeholder="¿Tenés disponibilidad full-time?" onChange={e => update(i, { question: e.target.value })} />
            <Select value={q.qtype} onValueChange={(v: any) => update(i, { qtype: v, options: v === "text" ? [] : q.options })}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto corto</SelectItem>
                <SelectItem value="single">Opción única</SelectItem>
                <SelectItem value="multi">Opción múltiple</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => remove(i)}><X className="h-4 w-4" /></Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={q.required} onCheckedChange={(v) => update(i, { required: !!v })} />
            Obligatoria
          </label>
          {q.qtype !== "text" && (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Opciones</div>
              {q.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <Input value={o.value} placeholder={`Opción ${oi + 1}`} onChange={e => update(i, {
                    options: q.options.map((x, j) => j === oi ? { ...x, value: e.target.value } : x)
                  })} />
                  <label className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2 py-1.5 text-xs">
                    <Checkbox checked={o.discard} onCheckedChange={(v) => update(i, {
                      options: q.options.map((x, j) => j === oi ? { ...x, discard: !!v } : x)
                    })} />
                    Descartar si elige esta
                  </label>
                  <Button variant="ghost" size="icon" onClick={() => update(i, { options: q.options.filter((_, j) => j !== oi) })}><X className="h-3 w-3" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => update(i, { options: [...q.options, { value: "", discard: false }] })}>
                <Plus className="mr-2 h-3 w-3" /> Agregar opción
              </Button>
            </div>
          )}
        </div>
      ))}
      {screening.length < 10 && (
        <Button type="button" variant="outline" size="sm" onClick={() => setScreening((s: SQ[]) => [...s, { question: "", required: false, qtype: "text", options: [] }])}>
          <Plus className="mr-2 h-3 w-3" /> Agregar pregunta
        </Button>
      )}
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
