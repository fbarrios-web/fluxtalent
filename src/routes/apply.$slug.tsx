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
import { isValidLinkedin } from "@/lib/linkedin";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/apply/$slug")({
  component: ApplyPage,
  head: () => ({ meta: [{ title: "Postularme — FLUX Talent" }] }),
});

function ApplyPage() {
  const t = useT();
  const { slug } = Route.useParams();
  const { data: vacancy, isLoading } = useQuery({
    queryKey: ["public-vacancy", slug],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_vacancy_by_slug", { _slug: slug });
      return (data as any)?.[0] ?? null;
    },
  });


  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", linkedin: "" });
  type AnswerVal = string | string[];
  const [cv, setCv] = useState<File | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerVal>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!vacancy) return;
    if (!cv) { toast.error(t("Adjuntá tu CV para postularte.")); return; }
    if (!form.phone.trim()) { toast.error(t("El teléfono es obligatorio.")); return; }
    if (form.linkedin.trim() && !isValidLinkedin(form.linkedin)) {
      toast.error(t("El link de LinkedIn no es válido. Ej: linkedin.com/in/tu-usuario"));
      return;
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.set("vacancy_id", vacancy.id);
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    fd.set("answers", JSON.stringify(answers));
    if (cv) fd.set("cv", cv, cv.name);
    let lastErr: any = null;
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 90_000);
        try {
          const res = await fetch("/api/public/apply", { method: "POST", body: fd, signal: ctrl.signal });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw Object.assign(new Error(json.error ?? "Error"), { server: true });
          setDone(true);
          return;
        } catch (e: any) {
          lastErr = e;
          if (e?.server) break; // error de validación: no reintentar
          await new Promise(r => setTimeout(r, 1500 * attempt));
        } finally { clearTimeout(timer); }
      }
      if (lastErr?.server) { toast.error(lastErr.message); return; }
      reportClientError(lastErr, vacancy.id, cv);
      toast.error(t("No pudimos enviar tu postulación por un problema de conexión. Revisá tu internet y volvé a intentar. Si usás la app de Instagram o Facebook, abrí el link en Chrome o Safari."), { duration: 10000 });
    } finally { setSubmitting(false); }
  }

  async function pickCv(file: File | null) {
    if (!file) { setCv(null); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error(t("El CV supera los 10MB. Subí un archivo más liviano.")); return; }
    try {
      // Copiamos el archivo a memoria: evita "Failed to fetch" con archivos de Drive/iCloud
      // que el celular no tiene descargados o que cambian después de elegirlos.
      const buf = await file.arrayBuffer();
      setCv(new File([buf], file.name, { type: file.type || "application/pdf" }));
    } catch (e) {
      reportClientError(e, vacancy?.id, file);
      toast.error(t("No pudimos leer el archivo. Si está en Google Drive o iCloud, descargalo primero al teléfono y volvé a adjuntarlo."), { duration: 10000 });
      setCv(null);
    }
  }

  if (isLoading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!vacancy || vacancy.status !== "active") return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div><h1 className="font-display text-3xl">{t("Vacante no disponible")}</h1><p className="mt-2 text-muted-foreground">{t("Esta búsqueda ya cerró o no existe.")}</p></div>
    </div>
  );

  if (done) return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-md text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-display text-3xl">{t("¡Gracias por postularte!")}</h1>
        <p className="mt-2 text-muted-foreground">{t("Recibimos tu postulación a")} <b>{vacancy.title}</b>. {t("Te vamos a contactar si avanzás en el proceso.")}</p>
      </div>
    </div>
  );

  const questions = (vacancy.screening_questions ?? []).sort((a: any, b: any) => a.position - b.position);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{vacancy.area ?? t("Postulación")} · {vacancy.modality ?? ""}</p>
          <h1 className="mt-2 font-display text-4xl">{vacancy.title}</h1>
          {vacancy.description && <p className="mt-3 text-muted-foreground">{vacancy.description}</p>}
        </div>
      </header>

      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6 px-6 py-10">
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold">{t("Tus datos")}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>{t("Nombre *")}</Label><Input required value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
            <div><Label>{t("Apellido *")}</Label><Input required value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            <div><Label>{t("Email *")}</Label><Input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>{t("Teléfono *")}</Label><Input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>LinkedIn</Label><Input placeholder="https://linkedin.com/in/…" value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} /></div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold">{t("CV (PDF) *")}</h3>
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
            <Upload className="h-4 w-4" />
            {cv ? cv.name : t("Adjuntar CV (PDF, máx 10MB) — obligatorio")}
            <input type="file" accept="application/pdf" className="hidden" onChange={e => pickCv(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {!!questions.length && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold">{t("Preguntas rápidas")}</h3>
            {questions.map((q: any) => {
              const qtype = q.qtype ?? "text";
              const opts: { value: string }[] = q.options ?? [];
              const val = answers[q.question];
              if (qtype === "range") {
                return (
                  <div key={q.id}>
                    <Label>{t(q.question)}{q.required && " *"}</Label>
                    <Input type="number" inputMode="numeric" min={0} required={q.required} className="mt-2"
                      value={(val as string) ?? ""} placeholder={t("Ingresá un número")}
                      onChange={e => setAnswers(a => ({ ...a, [q.question]: e.target.value }))} />
                  </div>
                );
              }
              if (qtype === "single") {
                return (
                  <div key={q.id}>
                    <Label>{t(q.question)}{q.required && " *"}</Label>
                    <div className="mt-2 space-y-2">
                      {opts.map(o => (
                        <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name={`q-${q.id}`} value={o.value} required={q.required}
                            checked={val === o.value}
                            onChange={() => setAnswers(a => ({ ...a, [q.question]: o.value }))} />
                          {o.value}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              }
              if (qtype === "multi") {
                const arr = (Array.isArray(val) ? val : []) as string[];
                return (
                  <div key={q.id}>
                    <Label>{t(q.question)}{q.required && " *"}</Label>
                    <div className="mt-2 space-y-2">
                      {opts.map(o => (
                        <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={arr.includes(o.value)}
                            onChange={e => setAnswers(a => {
                              const cur = (Array.isArray(a[q.question]) ? a[q.question] : []) as string[];
                              const next = e.target.checked ? [...cur, o.value] : cur.filter(x => x !== o.value);
                              return { ...a, [q.question]: next };
                            })} />
                          {o.value}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <div key={q.id}>
                  <Label>{t(q.question)}{q.required && " *"}</Label>
                  <Textarea required={q.required} rows={3} value={(val as string) ?? ""} onChange={e => setAnswers(a => ({ ...a, [q.question]: e.target.value }))} />
                </div>
              );
            })}
          </div>
        )}

        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("Enviar postulación")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t("Powered by FLUX Talent · Tus datos sólo se usan para esta búsqueda.")}</p>
      </form>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        {t("© 2026 FLUX Automatizaciones. Todos los derechos reservados.")}
      </footer>
    </div>

  );
}
