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

const PLACEHOLDERS = VARS.reduce((acc, v) => {
  acc[v.key] = v.label;
  return acc;
}, {} as Record<string, string>);

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
        <PlaceholderEditor
          value={subject}
          onChange={setSubject}
          placeholders={PLACEHOLDERS}
          showInsertButtons
          singleLine
          className="min-h-[2.5rem]"
          placeholder={DEFAULT_REJECTION_SUBJECT}
          aria-label={t("Asunto del mail")}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("Mensaje")}</Label>
        <PlaceholderEditor
          value={body}
          onChange={setBody}
          placeholders={PLACEHOLDERS}
          showInsertButtons
          className="min-h-[12rem] font-normal leading-relaxed"
          placeholder={DEFAULT_REJECTION_BODY}
          aria-label={t("Cuerpo del mail")}
        />
        <p className="text-xs text-muted-foreground">{t("Los datos en gris se reemplazan automáticamente por los del postulante.")}</p>
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
