import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getUsageSummary } from "@/lib/subscription.functions";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PlaceholderEditor } from "@/components/placeholder-editor";
import { Loader2, Lock, Mail, RotateCcw, Eye } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

const PRO_PLANS = ["pro", "enterprise", "custom"];

export const DEFAULT_REJECTION_SUBJECT = "Novedades de tu postulación a {{vacancy_title}}";
export const DEFAULT_REJECTION_BODY = `Hola {{first_name}},

Gracias por postularte a {{vacancy_title}} y por el tiempo que dedicaste al proceso.

En esta oportunidad decidimos avanzar con otros perfiles que se ajustan más a lo que estamos buscando. Guardamos tu CV para futuras búsquedas.

¡Te deseamos mucho éxito!

{{signature}}`;

const VARS: { key: string; label: string }[] = [
  { key: "first_name", label: "Nombre del postulante" },
  { key: "last_name", label: "Apellido" },
  { key: "vacancy_title", label: "Título de la vacante" },
  { key: "signature", label: "Tu firma" },
];

const SAMPLE = {
  first_name: "Ana",
  last_name: "Pérez",
  vacancy_title: "Analista de Marketing",
  signature: "Equipo de Selección",
};

function render(text: string) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (SAMPLE as any)[k] ?? "");
}

export function RejectionEmailEditor() {
  const t = useT();
  const qc = useQueryClient();
  const usageFn = useServerFn(getUsageSummary);
  const { data: usage } = useQuery({ queryKey: ["usage-summary"], queryFn: () => usageFn(), refetchOnWindowFocus: false });

  const { data: tpl, isLoading } = useQuery({
    queryKey: ["email-template", "rejection"],
    queryFn: async () => {
      const { data } = await supabase.from("email_templates").select("id, org_id, subject, body").eq("key", "rejection").maybeSingle();
      return data ?? null;
    },
  });

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (tpl) {
      setSubject(tpl.subject || DEFAULT_REJECTION_SUBJECT);
      setBody(tpl.body || DEFAULT_REJECTION_BODY);
    }
  }, [tpl]);

  const planId = (usage?.planId ?? "").toLowerCase();
  const allowed = PRO_PLANS.includes(planId);

  if (!allowed) {
    return (
      <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">{t("Personalizar el mail de \"No avanza\"")}</h3>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t("Plan Pro")}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("Escribí con tus palabras el mail que reciben los postulantes que no avanzan. Disponible desde el plan Pro.")}
        </p>
        <Button asChild size="sm"><Link to="/app/subscription">{t("Ver planes")}</Link></Button>
      </section>
    );
  }

  function insertVar(key: string) {
    const token = `{{${key}}}`;
    const el = bodyRef.current;
    if (!el) { setBody(b => b + token); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  }

  async function save() {
    if (!subject.trim() || !body.trim()) { toast.error(t("Completá el asunto y el mensaje.")); return; }
    setSaving(true);
    try {
      if (tpl?.id) {
        const { error } = await supabase.from("email_templates")
          .update({ subject: subject.trim(), body: body.trim(), updated_at: new Date().toISOString() })
          .eq("id", tpl.id);
        if (error) throw error;
      } else {
        const { data: p } = await supabase.from("profiles").select("org_id").maybeSingle();
        if (!p?.org_id) throw new Error(t("No encontramos tu empresa."));
        const { error } = await supabase.from("email_templates")
          .insert({ org_id: p.org_id, key: "rejection", subject: subject.trim(), body: body.trim() });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["email-template", "rejection"] });
      toast.success(t("Guardamos tu mail de \"No avanza\"."));
    } catch (e: any) {
      toast.error(e?.message ?? t("No pudimos guardar el mail."));
    } finally { setSaving(false); }
  }

  if (isLoading) return <div className="rounded-2xl border border-border bg-card p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Mail className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">{t("Mail automático de \"No avanza\"")}</h3>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t("Plan Pro")}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("Este es el mail que recibe el postulante cuando queda fuera del proceso. Escribilo con tus palabras: se envía con tu logo, color y firma.")}
      </p>

      <div className="space-y-1">
        <Label>{t("Asunto")}</Label>
        <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder={DEFAULT_REJECTION_SUBJECT} />
      </div>

      <div className="space-y-2">
        <Label>{t("Mensaje")}</Label>
        <Textarea ref={bodyRef} rows={12} value={body} onChange={e => setBody(e.target.value)} className="font-normal leading-relaxed" />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t("Insertar dato:")}</span>
          {VARS.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVar(v.key)}
              className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs hover:bg-muted"
            >
              {t(v.label)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("Los datos entre llaves se reemplazan automáticamente por los del postulante.")}</p>
      </div>

      {preview && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Vista previa")}</p>
          <p className="mt-2 text-sm font-medium">{render(subject)}</p>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{render(body)}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("Guardar")}</Button>
        <Button variant="outline" onClick={() => setPreview(p => !p)}>
          <Eye className="mr-2 h-4 w-4" />{preview ? t("Ocultar vista previa") : t("Ver vista previa")}
        </Button>
        <Button variant="ghost" onClick={() => { setSubject(DEFAULT_REJECTION_SUBJECT); setBody(DEFAULT_REJECTION_BODY); }}>
          <RotateCcw className="mr-2 h-4 w-4" />{t("Volver al texto sugerido")}
        </Button>
      </div>
    </section>
  );
}
