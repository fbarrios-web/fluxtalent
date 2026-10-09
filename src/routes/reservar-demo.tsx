import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, Loader2, Mail, Phone, UserRound, Video } from "lucide-react";
import { toast } from "sonner";
import { FluxLogo } from "@/components/flux-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reservar-demo")({
  component: BookDemoPage,
  head: () => ({ meta: [
    { title: "Reservá una demo — FLUX Talent" },
    { name: "description", content: "Conocé FLUX Talent en una demo personalizada. Elegí el horario que mejor te quede." },
    { property: "og:title", content: "Reservá una demo — FLUX Talent" },
    { property: "og:description", content: "Elegí un horario y descubrí cómo FLUX Talent mejora tu proceso de selección." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type Slot = { id: string; start_at: string; end_at: string };
type PublicData = { enabled: boolean; duration_minutes: number; timezone: string; slots: Slot[] };

function BookDemoPage() {
  const [data, setData] = useState<PublicData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", website: "" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ whenLabel: string; meetLink: string | null } | null>(null);

  async function load() {
    const { data: response } = await supabase.rpc("get_public_demo_slots");
    setData((response as unknown as PublicData) ?? null);
  }
  useEffect(() => { void load(); }, []);

  const dates = useMemo(() => {
    const grouped = new Map<string, Slot[]>();
    if (!data) return grouped;
    for (const slot of data.slots) {
      const label = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: data.timezone }).format(new Date(slot.start_at));
      grouped.set(label, [...(grouped.get(label) ?? []), slot]);
    }
    return grouped;
  }, [data]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return toast.error("Elegí un horario.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/public/demo/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, slotId: selected }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo reservar.");
      setConfirmed({ whenLabel: result.whenLabel, meetLink: result.meetLink });
      if (result.emailWarning) toast.warning(result.emailWarning);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo reservar.");
      setSelected(null);
      await load();
    } finally { setSubmitting(false); }
  }

  if (!data) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (confirmed) return <main className="grid min-h-screen place-items-center bg-muted/30 p-5"><section className="w-full max-w-xl border-t-4 border-primary bg-card p-8 text-center shadow-sm"><CheckCircle2 className="mx-auto h-12 w-12 text-success" /><h1 className="mt-4 font-display text-4xl">Tu demo está confirmada</h1><p className="mt-3 text-muted-foreground">Te esperamos el <strong className="text-foreground">{confirmed.whenLabel}</strong>. Te enviamos la invitación y la confirmación por email.</p>{confirmed.meetLink && <Button className="mt-6" asChild><a href={confirmed.meetLink} target="_blank" rel="noreferrer"><Video className="h-4 w-4" /> Abrir Google Meet</a></Button>}<p className="mt-8 text-sm text-muted-foreground">¿Tenés alguna duda? Escribinos a <a className="font-medium text-primary" href="mailto:fbarrios@fluxtalent.com.ar">fbarrios@fluxtalent.com.ar</a> o por WhatsApp al <a className="font-medium text-primary" href="https://wa.me/543519090777">3519090777</a>.</p></section></main>;

  return <main className="min-h-screen bg-background">
    <header className="border-b border-border bg-primary text-primary-foreground"><div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-5"><span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-foreground"><FluxLogo size={34} /></span><div className="text-xl font-semibold">FLUX <span className="font-normal opacity-80">Talent</span></div></div></header>
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:py-16">
      <section><p className="text-sm font-semibold text-primary">DEMO PERSONALIZADA</p><h1 className="mt-3 font-display text-4xl leading-tight md:text-5xl">Descubrí una forma más simple de contratar talento.</h1><p className="mt-5 text-lg text-muted-foreground">Elegí un horario y te mostramos cómo FLUX Talent ordena postulaciones, analiza perfiles con IA y acompaña todo el proceso de selección.</p><div className="mt-8 space-y-3 text-sm"><p className="flex items-center gap-3"><Video className="h-5 w-5 text-primary" /> Reunión online por Google Meet</p><p className="flex items-center gap-3"><Clock className="h-5 w-5 text-primary" /> {data.duration_minutes} minutos</p><p className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-primary" /> Horarios de Buenos Aires</p></div></section>
      <section className="border border-border bg-card p-5 shadow-sm md:p-7">
        {!data.enabled ? <p className="py-12 text-center text-muted-foreground">La agenda no está disponible por el momento.</p> : <form onSubmit={submit} className="space-y-7">
          <div><h2 className="text-xl font-semibold">1. Elegí un horario</h2><div className="mt-4 max-h-72 space-y-5 overflow-y-auto pr-1">{Array.from(dates.entries()).map(([date, slots]) => <div key={date}><h3 className="mb-2 text-sm font-semibold capitalize">{date}</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{slots.map(slot => <Button key={slot.id} type="button" variant={selected === slot.id ? "default" : "outline"} onClick={() => setSelected(slot.id)}>{new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: data.timezone }).format(new Date(slot.start_at))}</Button>)}</div></div>)}{!dates.size && <p className="border border-dashed border-border p-5 text-sm text-muted-foreground">No hay horarios disponibles. Volvé a consultar pronto.</p>}</div></div>
          <div className="border-t border-border pt-6"><h2 className="text-xl font-semibold">2. Completá tus datos</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><Label htmlFor="firstName">Nombre</Label><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="firstName" required minLength={2} className="pl-9" value={form.firstName} onChange={event => setForm({ ...form, firstName: event.target.value })} /></div></div><div><Label htmlFor="lastName">Apellido</Label><Input id="lastName" required minLength={2} value={form.lastName} onChange={event => setForm({ ...form, lastName: event.target.value })} /></div><div><Label htmlFor="email">Email</Label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="email" type="email" required className="pl-9" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></div></div><div><Label htmlFor="phone">Teléfono</Label><div className="relative"><Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="phone" type="tel" required className="pl-9" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></div></div><input tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" value={form.website} onChange={event => setForm({ ...form, website: event.target.value })} /></div></div>
          <Button type="submit" size="lg" className="w-full" disabled={!selected || submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />} Confirmar demo</Button>
        </form>}
      </section>
    </div>
  </main>;
}