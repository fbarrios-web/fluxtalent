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

  const { data: account } = useQuery({
    queryKey: ["my-account"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u?.user;
      if (!user) return null;
      const { data: profile } = await supabase.from("profiles").select("display_name, org_id").eq("id", user.id).maybeSingle();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return {
        id: user.id,
        email: user.email ?? "",
        createdAt: user.created_at,
        displayName: profile?.display_name ?? "",
        roles: (roles ?? []).map((r: any) => r.role),
      };
    },
  });

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
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

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

  useEffect(() => {
    if (account) setDisplayName(account.displayName);
  }, [account]);

  const { data: templates } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => (await supabase.from("email_templates").select("*").order("key")).data ?? [],
  });

  async function save() {
    if (!org) return;
    setSaving(true);
    try {
      const { data: updated, error } = await supabase.from("organizations").update({
        name,
        consultancy_name: consultancyName || null,
        contact_email: contactEmail || null,
        brand_color: brandColor,
        logo_url: logoUrl || null,
        signature_html: signature,
        sender_email: senderEmail,
        timezone,
      } as any).eq("id", org.id).select("id");
      if (error) throw error;
      if (!updated?.length) throw new Error("No se pudieron guardar los cambios. Verificá tus permisos.");
      toast.success("Cambios guardados");
      qc.invalidateQueries({ queryKey: ["my-org"] });
    } catch (e: any) { toast.error(e.message ?? "Error al guardar"); } finally { setSaving(false); }
  }

  async function saveProfile() {
    if (!account) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", account.id);
      if (error) throw error;
      toast.success("Perfil actualizado");
      qc.invalidateQueries({ queryKey: ["my-account"] });
    } catch (e: any) { toast.error(e.message ?? "Error"); } finally { setSavingProfile(false); }
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
        <h3 className="font-semibold">Mi cuenta</h3>
        <p className="text-sm text-muted-foreground">Datos personales asociados a tu usuario.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Email</Label><Input value={account?.email ?? ""} disabled /></div>
          <div><Label>Nombre para mostrar</Label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Tu nombre" /></div>
          <div><Label>Roles</Label><Input value={(account?.roles ?? []).join(", ") || "—"} disabled /></div>
          <div><Label>Miembro desde</Label><Input value={account?.createdAt ? new Date(account.createdAt).toLocaleDateString("es-AR") : "—"} disabled /></div>
        </div>
        <Button onClick={saveProfile} disabled={savingProfile || !account}>{savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar perfil</Button>
      </section>

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
