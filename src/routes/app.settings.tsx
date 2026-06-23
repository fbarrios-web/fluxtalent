import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { IntegrationsPanel } from "@/routes/app.integrations";

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
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (account) {
      setDisplayName(account.displayName);
      setFullName(account.fullName);
      setDni(account.dni);
      setBirthDate(account.birthDate);
    }
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
      const patch: Record<string, unknown> = kind === "logo" ? { logo_url: path } : { signature_image_url: path };
      const { error: upErr } = await supabase.from("organizations").update(patch as any).eq("id", org.id);
      if (upErr) throw upErr;
      qc.invalidateQueries({ queryKey: ["my-org"] });
      toast.success(kind === "logo" ? "Logo actualizado" : "Firma actualizada");
    } catch (e: any) { toast.error(e.message ?? "Error al subir"); } finally { setUp(false); }
  }

  function validateOrg() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "El nombre legal es obligatorio";
    if (!consultancyName.trim()) errs.consultancyName = "El nombre comercial es obligatorio";
    if (!contactEmail.trim()) errs.contactEmail = "El mail de contacto es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) errs.contactEmail = "Ingresá un email válido";
    if (!senderEmail.trim()) errs.senderEmail = "El email remitente es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) errs.senderEmail = "Ingresá un email válido";
    if (!brandColor.trim()) errs.brandColor = "El color de marca es obligatorio";
    if (!timezone.trim()) errs.timezone = "La zona horaria es obligatoria";
    return errs;
  }

  async function save() {
    if (!org) return;
    const errs = validateOrg();
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Completá los campos obligatorios antes de guardar");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        name: name || org.name,
        consultancy_name: consultancyName || null,
        contact_email: contactEmail || null,
        brand_color: brandColor || "#0F766E",
        logo_url: logoUrl || null,
        signature_html: signature || null,
        signature_image_url: signatureImageUrl || null,
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
      const patch: Record<string, unknown> = {
        display_name: displayName,
        full_name: fullName.trim() || null,
        dni: dni.trim() || null,
        birth_date: birthDate || null,
      };
      const { error } = await supabase.from("profiles").update(patch as any).eq("id", account.id);
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

      <Tabs defaultValue="cuenta" className="mt-8">
        <TabsList>
          <TabsTrigger value="cuenta">Cuenta y empresa</TabsTrigger>
          <TabsTrigger value="integraciones">Integraciones</TabsTrigger>
        </TabsList>

        <TabsContent value="cuenta" className="mt-6 space-y-8">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold">Mi cuenta</h3>
            <p className="text-sm text-muted-foreground">Datos personales asociados a tu usuario.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Email</Label><Input value={account?.email ?? ""} disabled /></div>
              <div><Label>Nombre completo</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nombre y apellido" /></div>
              <div><Label>DNI</Label><Input value={dni} onChange={e => setDni(e.target.value)} placeholder="12345678" /></div>
              <div><Label>Fecha de nacimiento</Label><Input type="date" value={birthDate ?? ""} onChange={e => setBirthDate(e.target.value)} /></div>
              <div><Label>Miembro desde</Label><Input value={account?.createdAt ? new Date(account.createdAt).toLocaleDateString("es-AR") : "—"} disabled /></div>
            </div>
            <Button onClick={saveProfile} disabled={savingProfile || !account}>{savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar perfil</Button>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold">Empresa & marca</h3>
            <p className="text-sm text-muted-foreground">Estos datos aparecen en los mails que recibe el postulante.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Nombre legal <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }} placeholder="Acme S.A." className={errors.name ? "border-destructive ring-1 ring-destructive" : ""} />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1">
                <Label>Nombre comercial / consultora <span className="text-destructive">*</span></Label>
                <Input value={consultancyName} onChange={e => { setConsultancyName(e.target.value); setErrors(p => ({ ...p, consultancyName: "" })); }} placeholder="Aparece en el remitente del mail" className={errors.consultancyName ? "border-destructive ring-1 ring-destructive" : ""} />
                {errors.consultancyName && <p className="text-xs text-destructive">{errors.consultancyName}</p>}
              </div>
              <div className="space-y-1">
                <Label>Mail de contacto (para postulantes) <span className="text-destructive">*</span></Label>
                <Input type="email" value={contactEmail} onChange={e => { setContactEmail(e.target.value); setErrors(p => ({ ...p, contactEmail: "" })); }} placeholder="hola@empresa.com" className={errors.contactEmail ? "border-destructive ring-1 ring-destructive" : ""} />
                {errors.contactEmail && <p className="text-xs text-destructive">{errors.contactEmail}</p>}
              </div>
              <div className="space-y-1">
                <Label>Email remitente <span className="text-destructive">*</span></Label>
                <Input value={senderEmail} onChange={e => { setSenderEmail(e.target.value); setErrors(p => ({ ...p, senderEmail: "" })); }} placeholder="reclutamiento@empresa.com" className={errors.senderEmail ? "border-destructive ring-1 ring-destructive" : ""} />
                {errors.senderEmail && <p className="text-xs text-destructive">{errors.senderEmail}</p>}
              </div>
              <div className="space-y-1">
                <Label>Color de marca <span className="text-destructive">*</span></Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={brandColor} onChange={e => { setBrandColor(e.target.value); setErrors(p => ({ ...p, brandColor: "" })); }} className="h-10 w-14 rounded border border-input" />
                  <Input value={brandColor} onChange={e => { setBrandColor(e.target.value); setErrors(p => ({ ...p, brandColor: "" })); }} className={errors.brandColor ? "border-destructive ring-1 ring-destructive" : ""} />
                </div>
                {errors.brandColor && <p className="text-xs text-destructive">{errors.brandColor}</p>}
              </div>
              <div>
                <Label>Logo de la empresa <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
                <div className="flex items-center gap-3 mt-1">
                  {logoPreview && <img src={logoPreview} alt="logo" className="h-12 w-12 rounded border border-border object-contain bg-white" />}
                  <Input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAsset(f, "logo"); }} disabled={uploadingLogo} />
                  {logoUrl && <Button variant="ghost" size="sm" onClick={() => { setLogoUrl(""); setLogoPreview(""); }}>Quitar</Button>}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Zona horaria <span className="text-destructive">*</span></Label>
                <Input value={timezone} onChange={e => { setTimezone(e.target.value); setErrors(p => ({ ...p, timezone: "" })); }} placeholder="America/Argentina/Buenos_Aires" className={errors.timezone ? "border-destructive ring-1 ring-destructive" : ""} />
                {errors.timezone && <p className="text-xs text-destructive">{errors.timezone}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Firma — texto (HTML simple) <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
              <Textarea rows={4} value={signature} onChange={e => setSignature(e.target.value)} placeholder="<b>María Pérez</b> — Talent Lead @ Empresa" />
              <p className="text-xs text-muted-foreground">Solo texto. Aparece debajo del cuerpo en cada email.</p>
            </div>
            <div>
              <Label>Firma — imagen <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
              <div className="flex items-center gap-3 mt-1">
                {signaturePreview && <img src={signaturePreview} alt="firma" className="h-16 rounded border border-border object-contain bg-white" />}
                <Input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAsset(f, "signature"); }} disabled={uploadingSig} />
                {signatureImageUrl && <Button variant="ghost" size="sm" onClick={() => { setSignatureImageUrl(""); setSignaturePreview(""); }}>Quitar</Button>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Se mostrará debajo del texto de la firma en los emails.</p>
            </div>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold">Soporte</h3>
            <p className="text-sm text-muted-foreground">
              ¿Necesitás ayuda, una integración personalizada o reportar un problema? Escribinos a{" "}
              <a href="mailto:hola@fluxautomatizaciones.com" className="text-primary underline">hola@fluxautomatizaciones.com</a>.
            </p>
            <p className="text-xs text-muted-foreground">Respondemos en menos de 24h hábiles.</p>
          </section>
        </TabsContent>

        <TabsContent value="integraciones" className="mt-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold">Integraciones</h3>
            <p className="text-sm text-muted-foreground">Conectá Google Calendar + Gmail para automatizar entrevistas e invitaciones.</p>
            <div className="mt-4">
              <IntegrationsPanel />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
