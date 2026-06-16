import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/apply/$slug")({
  component: ApplyPage,
  head: () => ({ meta: [{ title: "Postularme — FLUX Talent" }] }),
});

function ApplyPage() {
  const { slug } = Route.useParams();
  const { data: vacancy, isLoading } = useQuery({
    queryKey: ["public-vacancy", slug],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_vacancy_by_slug", { _slug: slug });
      return (data as any)?.[0] ?? null;
    },
  });


  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", linkedin: "" });
  const [cv, setCv] = useState<File | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!vacancy) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.set("vacancy_id", vacancy.id);
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    fd.set("answers", JSON.stringify(answers));
    if (cv) fd.set("cv", cv);
    try {
      const res = await fetch("/api/public/apply", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setDone(true);
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  }

  if (isLoading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!vacancy || vacancy.status !== "active") return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div><h1 className="font-display text-3xl">Vacante no disponible</h1><p className="mt-2 text-muted-foreground">Esta búsqueda ya cerró o no existe.</p></div>
    </div>
  );

  if (done) return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-md text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-display text-3xl">¡Gracias por postularte!</h1>
        <p className="mt-2 text-muted-foreground">Recibimos tu postulación a <b>{vacancy.title}</b>. Te vamos a contactar si avanzás en el proceso.</p>
      </div>
    </div>
  );

  const questions = (vacancy.screening_questions ?? []).sort((a: any, b: any) => a.position - b.position);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{vacancy.area ?? "Postulación"} · {vacancy.modality ?? ""}</p>
          <h1 className="mt-2 font-display text-4xl">{vacancy.title}</h1>
          {vacancy.description && <p className="mt-3 text-muted-foreground">{vacancy.description}</p>}
        </div>
      </header>

      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6 px-6 py-10">
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold">Tus datos</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Nombre *</Label><Input required value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
            <div><Label>Apellido *</Label><Input required value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            <div><Label>Email *</Label><Input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Teléfono</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>LinkedIn</Label><Input placeholder="https://linkedin.com/in/…" value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} /></div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold">CV (PDF)</h3>
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
            <Upload className="h-4 w-4" />
            {cv ? cv.name : "Adjuntar CV (PDF, máx 10MB)"}
            <input type="file" accept="application/pdf" className="hidden" onChange={e => setCv(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {!!questions.length && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold">Preguntas rápidas</h3>
            {questions.map((q: any) => (
              <div key={q.id}>
                <Label>{q.question}{q.required && " *"}</Label>
                <Textarea required={q.required} rows={3} value={answers[q.question] ?? ""} onChange={e => setAnswers(a => ({ ...a, [q.question]: e.target.value }))} />
              </div>
            ))}
          </div>
        )}

        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enviar postulación
        </Button>
        <p className="text-center text-xs text-muted-foreground">Powered by FLUX Talent · Tus datos sólo se usan para esta búsqueda.</p>
      </form>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © 2026 FLUX Automatizaciones. Todos los derechos reservados.
      </footer>
    </div>

  );
}
