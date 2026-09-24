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

function reportClientError(e: any, vacancyId: string | undefined, file: File | null) {
  try {
    const body = JSON.stringify({
      vacancy_id: vacancyId, error: String(e?.name ?? "") + ": " + String(e?.message ?? e),
      file_size: file?.size, file_type: file?.type, ua: navigator.userAgent.slice(0, 300),
      online: navigator.onLine,
    });
    navigator.sendBeacon?.("/api/public/apply", new Blob([body], { type: "application/json" }));
  } catch { /* noop */ }
}

function ApplyPage() {
  const t = useT();
  const { slug } = Route.useParams();
  const { data: logoUrl } = useQuery({
    queryKey: ["public-vacancy-logo", slug],
    queryFn: async () => {
      const r = await fetch(`/api/public/schedule/logo?slug=${encodeURIComponent(slug)}`);
      const j = await r.json().catch(() => ({}));
      return (j?.url as string | null) ?? null;
    },
  });
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
    const reqMissing = (vacancy.screening_questions ?? []).some((q: any) => {
      if (!q.required) return false;
      const v = answers[q.question];
      return v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");
    });
    if (reqMissing) { toast.error(t("Respondé todas las preguntas obligatorias")); return; }
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
        const timer = setTimeout(() => ctrl.abort(), 120_000);
        try {
          const res = await fetch("/api/public/apply", { method: "POST", body: fd, signal: ctrl.signal });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            // 4xx = dato a corregir (no reintentar). 5xx = reintentar.
            const err = Object.assign(new Error(json.error ?? "Error"), { server: res.status < 500, status: res.status });
            throw err;
          }
          setDone(true);
          return;
        } catch (e: any) {
          lastErr = e;
          if (e?.server) break;
          await new Promise(r => setTimeout(r, 1500 * attempt));
        } finally { clearTimeout(timer); }
      }
      if (lastErr?.server) { toast.error(t(lastErr.message)); return; }
      reportClientError(lastErr, vacancy.id, cv);
      const ua = navigator.userAgent;
      const inApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|LinkedInApp|TikTok/i.test(ua);
      let msg: string;
      if (!navigator.onLine) {
        msg = "Tu celular o computadora se quedó sin conexión a internet. Conectate a una red Wi‑Fi o a tus datos móviles y tocá \"Enviar\" de nuevo. Tus datos siguen cargados.";
      } else if (lastErr?.name === "AbortError") {
        msg = "Tu conexión a internet está muy lenta y el envío tardó demasiado. Probá con otra red (Wi‑Fi o datos) o con un CV más liviano, y volvé a enviar.";
      } else if (lastErr?.status >= 500) {
        msg = "Tuvimos un inconveniente momentáneo al recibir tu postulación. Esperá un minuto y volvé a tocar \"Enviar\". Tus datos siguen cargados.";
      } else if (inApp) {
        msg = "El navegador interno de Instagram/Facebook bloqueó el envío del archivo. Tocá los tres puntos (⋯) arriba a la derecha y elegí \"Abrir en Chrome\" o \"Abrir en Safari\", y postulate desde ahí.";
      } else {
        msg = "Tu navegador no pudo enviar la postulación (suele pasar por una conexión inestable, una VPN o un bloqueador de anuncios). Revisá tu internet, desactivá el bloqueador si tenés uno y volvé a intentar, o probá desde Chrome o Safari.";
      }
      toast.error(t(msg), { duration: 15000 });
    } finally { setSubmitting(false); }
  }

  async function pickCv(file: File | null) {
    if (!file) { setCv(null); return; }
    if (file.size === 0) { toast.error(t("El archivo está vacío. Si está en Google Drive o iCloud, descargalo primero al teléfono y volvé a adjuntarlo.")); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error(t("Tu CV pesa más de 20MB. Guardalo de nuevo como PDF (por ejemplo desde Word: Archivo → Guardar como → PDF) para que pese menos y volvé a adjuntarlo."), { duration: 12000 }); return; }
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
          {logoUrl && <img src={logoUrl} alt={vacancy.org_name ?? ""} className="mb-6 h-14 w-auto max-w-[200px] object-contain" />}
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
                    <Input type="number" inputMode="numeric" min={0} className="mt-2"
                      value={(val as string) ?? ""} placeholder={t("Indicanos tu rango salarial pretendido")}
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
                          <input type="radio" name={`q-${q.id}`} value={o.value}
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
                  <Textarea rows={3} value={(val as string) ?? ""} onChange={e => setAnswers(a => ({ ...a, [q.question]: e.target.value }))} />
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
