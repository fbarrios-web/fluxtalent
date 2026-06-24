import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, CheckCircle2, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/setup")({
  component: SetupPage,
  head: () => ({ meta: [{ title: "Configurá tu cuenta — FLUX Talent" }] }),
});

function SetupPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: me, isLoading } = useQuery({
    queryKey: ["setup-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return null;
      const { data: p } = await supabase.from("profiles").select("id, full_name, dni, birth_date, org_id").eq("id", u.user.id).maybeSingle();
      return { user: u.user, profile: p };
    },
  });

  const [fullName, setFullName] = useState("");
  const [dni, setDni] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (me?.profile) {
      setFullName((me.profile as any).full_name ?? "");
      setDni((me.profile as any).dni ?? "");
      setBirthDate((me.profile as any).birth_date ?? "");
      if ((me.profile as any).full_name && (me.profile as any).dni && (me.profile as any).birth_date) {
        setDone(true);
      }
    }
  }, [me]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!me?.user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: fullName.trim(),
        dni: dni.trim(),
        birth_date: birthDate,
      } as any).eq("id", me.user.id);
      if (error) throw error;
      toast.success("Datos guardados");
      setDone(true);
    } catch (e: any) { toast.error(e.message ?? "Error al guardar"); }
    finally { setSaving(false); }
  }

  if (isLoading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-primary">Bienvenid@</p>
        <h1 className="font-display text-4xl">Configurá tu cuenta</h1>
        <p className="mt-2 text-muted-foreground">Necesitamos un par de datos para personalizar tu workspace. Toma menos de 1 minuto.</p>
      </div>

      <ol className="mb-8 space-y-2 text-sm">
        <li className="flex items-center gap-2"><span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${done ? "bg-success text-white" : "bg-primary text-primary-foreground"}`}>{done ? <CheckCircle2 className="h-3.5 w-3.5" /> : "1"}</span> Tus datos personales</li>
        <li className="flex items-center gap-2"><span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>2</span> Datos de tu empresa (logo, marca, firma)</li>
      </ol>

      {!done ? (
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold">Tus datos</h3>
          <div>
            <Label htmlFor="fn">Nombre y apellido completo</Label>
            <Input id="fn" value={fullName} onChange={e => setFullName(e.target.value)} required minLength={3} placeholder="María Pérez González" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dni">DNI</Label>
              <Input id="dni" value={dni} onChange={e => setDni(e.target.value)} required minLength={6} placeholder="30123456" />
            </div>
            <div>
              <Label htmlFor="bd">Fecha de nacimiento</Label>
              <Input id="bd" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} required />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar y continuar
          </Button>
        </form>
      ) : (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <h3 className="font-semibold">¡Listo! Datos personales guardados.</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Ahora cargá los datos de tu empresa: nombre, logo, color de marca y firma de emails. Aparecen en cada comunicación que reciba el postulante.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/settings" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Building2 className="h-4 w-4" /> Configurar mi empresa
            </Link>
            <button type="button" onClick={() => nav({ to: "/app/dashboard" })} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
              Ir al dashboard <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
