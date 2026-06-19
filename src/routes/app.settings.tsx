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
      const { data: profile } = await supabase.from("profiles").select("display_name, org_id, full_name, dni, birth_date").eq("id", user.id).maybeSingle();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return {
        id: user.id,
        email: user.email ?? "",
        createdAt: user.created_at,
        displayName: profile?.display_name ?? "",
        fullName: (profile as any)?.full_name ?? "",
        dni: (profile as any)?.dni ?? "",
        birthDate: (profile as any)?.birth_date ?? "",
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
  const [logoPreview, setLogoPreview] = useState("");
  const [signature, setSignature] = useState("");
  const [signatureImageUrl, setSignatureImageUrl] = useState("");
  const [signaturePreview, setSignaturePreview] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [timezone, setTimezone] = useState("America/Argentina/Buenos_Aires");
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [dni, setDni] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);

  async function signedPreview(path: string): Promise<string> {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const { data } = await supabase.storage.from("org-assets").createSignedUrl(path, 60 * 60 * 24 * 7);
    return data?.signedUrl ?? "";
  }

  useEffect(() => {
    if (org) {
      setName(org.name);
      setConsultancyName((org as any).consultancy_name ?? "");
      setContactEmail((org as any).contact_email ?? "");
      setBrandColor(org.brand_color ?? "#0F766E");
      setLogoUrl(org.logo_url ?? "");
      setSignature(org.signature_html ?? "");
      setSignatureImageUrl((org as any).signature_image_url ?? "");
      setSenderEmail(org.sender_email ?? "");
      setTimezone((org as any).timezone ?? "America/Argentina/Buenos_Aires");
      signedPreview(org.logo_url ?? "").then(setLogoPreview);
      signedPreview((org as any).signature_image_url ?? "").then(setSignaturePreview);
    }
  }, [org]);

  useEffect(() => {
    if (account) setDisplayName(account.displayName);
  }, [account]);

  async function uploadAsset(file: File, kind: "logo" | "signature") {
    if (!org) return;
    const ext = file.name.split(".").pop() || "png";
    const path = `${org.id}/${kind}-${Date.now()}.${ext}`;
    const setUp = kind === "logo" ? setUploadingLogo : setUploadingSig;
    setUp(true);
    try {
      const { error } = await supabase.storage.from("org-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const preview = await signedPreview(path);
      if (kind === "logo") { setLogoUrl(path); setLogoPreview(preview); }
      else { setSignatureImageUrl(path); setSignaturePreview(preview); }
      // Auto-persist the new asset path so users don't lose it if they forget to press Save.
      const patch: Record<string, unknown> = kind === "logo" ? { logo_url: path } : { signature_image_url: path };
      const { error: upErr } = await supabase.from("organizations").update(patch as any).eq("id", org.id);
      if (upErr) throw upErr;
      qc.invalidateQueries({ queryKey: ["my-org"] });
      toast.success(kind === "logo" ? "Logo actualizado" : "Firma actualizada");
    } catch (e: any) { toast.error(e.message ?? "Error al subir"); } finally { setUp(false); }
  }


  async function save() {
    if (!org) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        name: name || org.name,
        consultancy_name: consultancyName || null,
        contact_email: contactEmail || null,
        brand_color: brandColor || "#0F766E",
        logo_url: logoUrl || null,
        signature_html: signature || null,
        sender_email: senderEmail || null,
        timezone: timezone || "America/Argentina/Buenos_Aires",
      };
      const { error } = await supabase.from("organizations").update(patch as any).eq("id", org.id);
      if (error) throw error;
      toast.success("Cambios guardados");
      qc.invalidateQueries({ queryKey: ["my-org"] });
    } catch (e: any) {
      console.error("[settings.save]", e);
      toast.error(e?.message || e?.error_description || "Error al guardar");
    } finally { setSaving(false); }
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
          <div>
            <Label>Logo de la empresa</Label>
            <div className="flex items-center gap-3">
              {logoPreview && <img src={logoPreview} alt="logo" className="h-12 w-12 rounded border border-border object-contain bg-white" />}
              <Input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAsset(f, "logo"); }} disabled={uploadingLogo} />
              {logoUrl && <Button variant="ghost" size="sm" onClick={() => { setLogoUrl(""); setLogoPreview(""); }}>Quitar</Button>}
            </div>
          </div>
          <div><Label>Zona horaria</Label><Input value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="America/Argentina/Buenos_Aires" /></div>
        </div>
        <div>
          <Label>Firma — texto (HTML simple)</Label>
          <Textarea rows={4} value={signature} onChange={e => setSignature(e.target.value)} placeholder="<b>María Pérez</b> — Talent Lead @ Empresa" />
          <p className="mt-1 text-xs text-muted-foreground">Solo texto. Aparece debajo del cuerpo en cada email.</p>
        </div>
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
      </section>

      <section className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-6">
        <h3 className="font-semibold">Soporte</h3>
        <p className="text-sm text-muted-foreground">
          ¿Necesitás ayuda, una integración personalizada o reportar un problema? Escribinos a{" "}
          <a href="mailto:hola@fluxautomatizaciones.com" className="text-primary underline">hola@fluxautomatizaciones.com</a>.
        </p>
        <p className="text-xs text-muted-foreground">Respondemos en menos de 24h hábiles.</p>
      </section>


    </div>
  );
}

