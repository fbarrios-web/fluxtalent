import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  component: Settings,
  head: () => ({ meta: [{ title: "Configuración — FLUX Talent" }] }),
});

function Settings() {
  const qc = useQueryClient();
  const { data: org, isLoading } = useQuery({
    queryKey: ["my-org"],
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!p?.org_id) return null;
      const { data } = await supabase.from("organizations").select("*").eq("id", p.org_id).single();
      return data;
    },
  });
  const [name, setName] = useState("");
  const [consultancyName, setConsultancyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [brandColor, setBrandColor] = useState("#0F766E");
  const [logoUrl, setLogoUrl] = useState("");
  const [signature, setSignature] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [timezone, setTimezone] = useState("America/Argentina/Buenos_Aires");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setConsultancyName((org as any).consultancy_name ?? "");
      setContactEmail((org as any).contact_email ?? "");
      setBrandColor(org.brand_color ?? "#0F766E");
      setLogoUrl(org.logo_url ?? "");
      setSignature(org.signature_html ?? "");
      setSenderEmail(org.sender_email ?? "");
      setTimezone((org as any).timezone ?? "America/Argentina/Buenos_Aires");
    }
  }, [org]);

  const { data: templates } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => (await supabase.from("email_templates").select("*").order("key")).data ?? [],
  });

  async function save() {
    if (!org) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("organizations").update({
        name,
        consultancy_name: consultancyName || null,
        contact_email: contactEmail || null,
        brand_color: brandColor,
        logo_url: logoUrl || null,
        signature_html: signature,
        sender_email: senderEmail,
        timezone,
      } as any).eq("id", org.id);
      if (error) throw error;
      toast.success("Guardado");
      qc.invalidateQueries({ queryKey: ["my-org"] });
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function saveTemplate(id: string, patch: any) {
    await supabase.from("email_templates").update(patch).eq("id", id);
    toast.success("Template actualizado");
  }

  if (isLoading) return <div className="p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="font-display text-4xl">Configuración</h1>
      <p className="mt-1 text-muted-foreground">Personalizá tu workspace y la comunicación con candidatos.</p>

      <section className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6">
        <h3 className="font-semibold">Empresa & marca</h3>
        <p className="text-sm text-muted-foreground">Estos datos aparecen en los mails que recibe el postulante.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Nombre legal</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Nombre comercial / consultora</Label><Input value={consultancyName} onChange={e => setConsultancyName(e.target.value)} placeholder="Aparece en el remitente del mail" /></div>
          <div><Label>Mail de contacto (para postulantes)</Label><Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="hola@empresa.com" /></div>
          <div><Label>Email remitente</Label><Input value={senderEmail} onChange={e => setSenderEmail(e.target.value)} placeholder="reclutamiento@empresa.com" /></div>
          <div><Label>Color de marca</Label><div className="flex items-center gap-2"><input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="h-10 w-14 rounded border border-input" /><Input value={brandColor} onChange={e => setBrandColor(e.target.value)} /></div></div>
          <div><Label>URL del logo</Label><Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." /></div>
          <div><Label>Zona horaria</Label><Input value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="America/Argentina/Buenos_Aires" /></div>
        </div>
        <div><Label>Firma (HTML simple)</Label><Textarea rows={4} value={signature} onChange={e => setSignature(e.target.value)} placeholder="<b>María Pérez</b> — Talent Lead @ Empresa" /></div>
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
      </section>

      <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
        <h3 className="font-semibold">Templates de email</h3>
        <p className="text-sm text-muted-foreground">Variables: <code>{`{{first_name}}`}</code>, <code>{`{{vacancy_title}}`}</code>, <code>{`{{signature}}`}</code></p>
        {(templates ?? []).map(t => (
          <details key={t.id} className="rounded-xl border border-border p-4">
            <summary className="cursor-pointer font-medium">{t.key}</summary>
            <div className="mt-3 space-y-2">
              <Input defaultValue={t.subject} onBlur={e => saveTemplate(t.id, { subject: e.target.value })} />
              <Textarea rows={8} defaultValue={t.body} onBlur={e => saveTemplate(t.id, { body: e.target.value })} />
            </div>
          </details>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-dashed border-border bg-muted/30 p-6">
        <h3 className="font-semibold">Próximamente</h3>
        <ul className="mt-2 text-sm text-muted-foreground">
          <li>· Integración con Google Calendar / Outlook + Google Meet / Zoom</li>
          <li>· Envío automático de emails con tu dominio</li>
          <li>· Equipos y roles (hiring managers, entrevistadores)</li>
        </ul>
      </section>
    </div>
  );
}
