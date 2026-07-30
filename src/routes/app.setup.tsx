import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, CheckCircle2, Building2, Check } from "lucide-react";
import { toast } from "sonner";
import { chooseFreePlan, startPlanCheckout } from "@/lib/subscription.functions";
import { PLANS, formatArs, formatUsd, type PlanId } from "@/lib/plans";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";

export const Route = createFileRoute("/app/setup")({
  component: SetupPage,
  head: () => ({ meta: [{ title: "Configurá tu cuenta — FLUX Talent" }] }),
});

function SetupPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const chooseFree = useServerFn(chooseFreePlan);
  const startCheckout = useServerFn(startPlanCheckout);
  const { data: me, isLoading } = useQuery({
    queryKey: ["setup-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return null;
      const { data: p } = await supabase.from("profiles").select("id, full_name, dni, birth_date, org_id, country, province, setup_completed_at").eq("id", u.user.id).maybeSingle();
      return { user: u.user, profile: p };
    },
  });

  const [fullName, setFullName] = useState("");
  const [dni, setDni] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [country, setCountry] = useState("Argentina");
  const [province, setProvince] = useState("");
  const [saving, setSaving] = useState(false);
  const [personalDone, setPersonalDone] = useState(false);
  const [planDone, setPlanDone] = useState(false);
  const [activating, setActivating] = useState<PlanId | null>(null);
  const [currency, setCurrency] = useState<"ars" | "usd">("ars");
  const { openCheckout, loading: paddleLoading } = usePaddleCheckout();

  useEffect(() => {
    if (me?.profile) {
      const p = me.profile as any;
      setFullName(p.full_name ?? "");
      setDni(p.dni ?? "");
      setBirthDate(p.birth_date ?? "");
      if (p.country) setCountry(p.country);
      if (p.province) setProvince(p.province);
      if (p.full_name && p.dni && p.birth_date && p.country && p.province) {
        setPersonalDone(true);
      }
      if (p.setup_completed_at) setPlanDone(true);
    }
  }, [me]);

  const missing: string[] = [];
  if (me?.profile) {
    const p = me.profile as any;
    if (!p.full_name) missing.push("Nombre y apellido");
    if (!p.dni) missing.push("DNI");
    if (!p.birth_date) missing.push("Fecha de nacimiento");
    if (!p.country) missing.push("País");
    if (!p.province) missing.push("Provincia / Estado");
    if (!p.setup_completed_at) missing.push("Elección de plan");
  }


  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!me?.user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: fullName.trim(),
        dni: dni.trim(),
        birth_date: birthDate,
        country: country.trim(),
        province: province.trim(),
      } as any).eq("id", me.user.id);
      if (error) throw error;
      toast.success("Datos guardados");
      await qc.invalidateQueries({ queryKey: ["profile-setup-check"] });
      setPersonalDone(true);
    } catch (e: any) { toast.error(e.message ?? "Error al guardar"); }
    finally { setSaving(false); }
  }

  async function pickPlan(planId: PlanId) {
    setActivating(planId);
    try {
      if (planId === "free") {
        await chooseFree();
        toast.success("Plan Free activado · 15 días de prueba");
        await qc.invalidateQueries({ queryKey: ["my-subscription"] });
        setPlanDone(true);
      } else if (currency === "usd") {
        const plan = PLANS.find(x => x.id === planId);
        const { data: u } = await supabase.auth.getUser();
        if (!plan?.paddlePriceId || !u?.user) throw new Error("No pudimos abrir el checkout en USD");
        await openCheckout({
          priceId: plan.paddlePriceId,
          customerEmail: u.user.email ?? undefined,
          customData: { userId: u.user.id, orgId: String((me?.profile as any)?.org_id ?? "") },
        });
        // Igual que el flujo en ARS: dejamos el setup marcado al iniciar el pago.
        await supabase.from("profiles").update({ setup_completed_at: new Date().toISOString() } as any).eq("id", u.user.id);
        await qc.invalidateQueries({ queryKey: ["profile-setup-check"] });
        setPlanDone(true);
        setActivating(null);
      } else {
        const r = await startCheckout({ data: { planId: planId as "starter" | "pro" | "enterprise" } });
        window.location.href = r.url;
      }
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("FREE_NOT_AVAILABLE")) {
        toast.error("La prueba Free solo está disponible para cuentas nuevas. Elegí un plan pago para continuar.", { duration: 6000 });
      } else {
        toast.error(msg || "No pudimos activar el plan");
      }
      setActivating(null);
    }
  }

  if (isLoading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const plansToShow = PLANS.filter(p => ["free", "starter", "pro", "enterprise"].includes(p.id));

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-primary">Bienvenid@</p>
        <h1 className="font-display text-4xl">Configurá tu cuenta</h1>
        <p className="mt-2 text-muted-foreground">Necesitamos un par de datos para personalizar tu workspace. Toma menos de 1 minuto.</p>
      </div>

      {missing.length > 0 && (
        <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-semibold text-foreground">Te falta completar el setup ({missing.length} {missing.length === 1 ? "punto" : "puntos"}):</p>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            {missing.map(m => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}



      <ol className="mb-8 space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${personalDone ? "bg-success text-white" : "bg-primary text-primary-foreground"}`}>{personalDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : "1"}</span>
          Tus datos personales
        </li>
        <li className="flex items-center gap-2">
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${planDone ? "bg-success text-white" : personalDone ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{planDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : "2"}</span>
          Elegí tu plan
        </li>
        <li className="flex items-center gap-2">
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${planDone ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>3</span>
          Datos de tu empresa
        </li>
      </ol>

      {!personalDone ? (
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="country">País</Label>
              <Input id="country" value={country} onChange={e => setCountry(e.target.value)} required placeholder="Argentina" />
            </div>
            <div>
              <Label htmlFor="province">Provincia / Estado</Label>
              <Input id="province" value={province} onChange={e => setProvince(e.target.value)} required placeholder="Buenos Aires" />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar y continuar
          </Button>
        </form>
      ) : !planDone ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold">Elegí el plan con el que querés empezar</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              El plan <b>Free</b> incluye 15 días de prueba (1 vacante y 20 CVs). Los planes pagos no incluyen período de prueba: te derivamos al pago seguro.
            </p>
            <div className="mt-4 inline-flex rounded-full border border-border p-1 text-sm">
              <button
                type="button"
                onClick={() => setCurrency("ars")}
                className={`rounded-full px-4 py-1 ${currency === "ars" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Pesos (ARS)
              </button>
              <button
                type="button"
                onClick={() => setCurrency("usd")}
                className={`flex items-center gap-2 rounded-full px-4 py-1 ${currency === "usd" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Dólares (USD)
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                  Próximamente
                </span>
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {currency === "ars"
                ? "Débito automático mensual con Mercado Pago."
                : "El pago en dólares está en etapa final de habilitación. Escribinos a soporte@fluxtalent.com.ar si necesitás pagar en USD."}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {plansToShow.map(p => {
              const isFree = p.id === "free";
              const loading = activating === p.id;
              return (
                <div key={p.id} className={`flex flex-col rounded-2xl border bg-card p-5 ${p.highlighted ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-display text-xl">{p.name}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
                    </div>
                    {p.highlighted && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">RECOMENDADO</span>}
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    {currency === "ars" ? (
                      <>
                        {p.originalPriceArs && p.originalPriceArs > p.priceArs && (
                          <span className="text-xs text-muted-foreground line-through">{formatArs(p.originalPriceArs)}</span>
                        )}
                        <span className="text-2xl font-semibold">{formatArs(p.priceArs)}</span>
                        {p.priceArs > 0 && <span className="text-xs text-muted-foreground">/ mes</span>}
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-semibold">{isFree ? formatUsd(0) : formatUsd(p.priceUsd)}</span>
                        {!isFree && <span className="text-xs text-muted-foreground">/ mes</span>}
                      </>
                    )}
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {p.features.slice(0, 4).map(f => (
                      <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success" /> <span>{f}</span></li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => pickPlan(p.id as PlanId)}
                    disabled={!!activating || paddleLoading || (currency === "usd" && !isFree && !p.paddlePriceId)}
                    variant={isFree ? "outline" : "default"}
                    className="mt-5 w-full"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isFree ? "Empezar gratis (15 días)" : `Suscribirme a ${p.name}${currency === "usd" ? " (USD)" : ""}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <h3 className="font-semibold">¡Listo! Plan Free activado por 15 días.</h3>
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
