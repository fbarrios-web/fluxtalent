import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock, Copy, ExternalLink, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getDemoScheduling, saveDemoScheduling } from "@/lib/demo-scheduling.functions";

export const Route = createFileRoute("/app/admin/demos")({
  component: DemoSchedulingAdmin,
  head: () => ({ meta: [
    { title: "Agenda de demos — FLUX Talent" },
    { name: "description", content: "Configuración de disponibilidad y reservas de demos de FLUX Talent." },
    { property: "og:title", content: "Agenda de demos — FLUX Talent" },
    { property: "og:description", content: "Configuración de disponibilidad y reservas de demos de FLUX Talent." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type Rule = { weekdays: number[]; startTime: string; endTime: string; effectiveFrom: string; effectiveUntil: string };
const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function DemoSchedulingAdmin() {
  const get = useServerFn(getDemoScheduling);
  const save = useServerFn(saveDemoScheduling);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["demo-scheduling"], queryFn: () => get() });
  const [duration, setDuration] = useState(30);
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);
  const [saving, setSaving] = useState(false);
  const publicUrl = typeof window === "undefined" ? "/reservar-demo" : `${window.location.origin}/reservar-demo`;

  useEffect(() => {
    if (!data) return;
    setDuration(data.config?.duration_minutes ?? 30);
    setEnabled(data.config?.enabled ?? true);
    const grouped = new Map<string, Rule>();
    for (const row of data.rules) {
      const startTime = String(row.start_time).slice(0, 5);
      const endTime = String(row.end_time).slice(0, 5);
      const effectiveFrom = row.effective_from ?? "";
      const effectiveUntil = row.effective_until ?? "";
      const key = `${startTime}|${endTime}|${effectiveFrom}|${effectiveUntil}`;
      const existing = grouped.get(key);
      if (existing) existing.weekdays.push(row.weekday);
      else grouped.set(key, { weekdays: [row.weekday], startTime, endTime, effectiveFrom, effectiveUntil });
    }
    setRules(Array.from(grouped.values()));
  }, [data]);

  const futureSlots = useMemo(() => data?.slots.filter(slot => slot.status === "open") ?? [], [data]);

  async function onSave() {
    setSaving(true);
    try {
      const result = await save({ data: { durationMinutes: duration, enabled, rules: rules.filter(rule => rule.weekdays.length > 0) } });
      toast.success(`Agenda guardada. Se generaron ${result.generated} horarios.`);
      await qc.invalidateQueries({ queryKey: ["demo-scheduling"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la agenda.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado");
  }

  if (isLoading || !data) return <div className="grid h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return <div className="space-y-8">
    <section className="grid gap-5 border-b border-border pb-8 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <p className="text-sm font-medium text-primary">Demos comerciales</p>
        <h2 className="mt-1 font-display text-3xl">Reservas de FLUX Talent</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Definí los días, horarios y duración disponibles. Florencia será la organizadora de todos los Google Meet.</p>
      </div>
      <div className="border-l-4 border-primary bg-muted/40 p-4">
        <Label>Link público</Label>
        <p className="mt-1 break-all text-sm text-muted-foreground">{publicUrl}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={copyLink}><Copy className="h-4 w-4" /> Copiar link</Button>
          <Button size="sm" variant="outline" asChild><a href="/reservar-demo" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Ver página</a></Button>
        </div>
      </div>
    </section>

    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label>Duración de cada demo</Label><Input type="number" min={15} max={240} value={duration} onChange={event => setDuration(Number(event.target.value))} /></div>
        <div className="flex items-end"><label className="flex items-center gap-3 text-sm"><Switch checked={enabled} onCheckedChange={setEnabled} /> Agenda pública habilitada</label></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <div><h3 className="font-semibold">Disponibilidad semanal</h3><p className="text-sm text-muted-foreground">Zona horaria: Buenos Aires.</p></div>
        <Button variant="outline" size="sm" onClick={() => setRules([...rules, { weekdays: [1], startTime: "09:00", endTime: "12:00", effectiveFrom: "", effectiveUntil: "" }])}><Plus className="h-4 w-4" /> Agregar franja</Button>
      </div>
      {!rules.length && <p className="border border-dashed border-border p-5 text-sm text-muted-foreground">Todavía no hay franjas configuradas.</p>}
      {rules.map((rule, index) => <div key={index} className="border-b border-border pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">{DAYS.map((day, weekday) => {
            const active = rule.weekdays.includes(weekday);
            return <Button key={day} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => setRules(rules.map((item, i) => i === index ? { ...item, weekdays: active ? item.weekdays.filter(value => value !== weekday) : [...item.weekdays, weekday].sort() } : item))}>{day}</Button>;
          })}</div>
          <Button variant="ghost" size="icon" aria-label="Eliminar franja" onClick={() => setRules(rules.filter((_, i) => i !== index))}><X className="h-4 w-4" /></Button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label>Desde</Label><Input type="time" value={rule.startTime} onChange={event => setRules(rules.map((item, i) => i === index ? { ...item, startTime: event.target.value } : item))} /></div>
          <div><Label>Hasta</Label><Input type="time" value={rule.endTime} onChange={event => setRules(rules.map((item, i) => i === index ? { ...item, endTime: event.target.value } : item))} /></div>
          <div><Label>Fecha inicial (opcional)</Label><Input type="date" value={rule.effectiveFrom} onChange={event => setRules(rules.map((item, i) => i === index ? { ...item, effectiveFrom: event.target.value } : item))} /></div>
          <div><Label>Fecha final (opcional)</Label><Input type="date" value={rule.effectiveUntil} onChange={event => setRules(rules.map((item, i) => i === index ? { ...item, effectiveUntil: event.target.value } : item))} /></div>
        </div>
      </div>)}
      <Button onClick={onSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar y generar horarios</Button>
    </section>

    <section className="grid gap-6 border-t border-border pt-8 lg:grid-cols-2">
      <div><h3 className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" /> Próximos horarios disponibles</h3><div className="mt-3 space-y-2">{futureSlots.slice(0, 12).map(slot => <div key={slot.id} className="flex items-center justify-between border-b border-border py-2 text-sm"><span>{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(slot.start_at))}</span><span className="text-muted-foreground">Disponible</span></div>)}{!futureSlots.length && <p className="text-sm text-muted-foreground">No hay horarios disponibles.</p>}</div></div>
      <div><h3 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4" /> Últimas reservas</h3><div className="mt-3 space-y-3">{data.bookings.map((booking: any) => <div key={booking.id} className="border-b border-border pb-3 text-sm"><div className="font-medium">{booking.first_name} {booking.last_name}</div><div className="text-muted-foreground">{booking.email} · {booking.phone}</div><div className="mt-1 text-xs text-muted-foreground">{booking.demo_slots?.start_at ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(booking.demo_slots.start_at)) : "Horario no disponible"}</div></div>)}{!data.bookings.length && <p className="text-sm text-muted-foreground">Todavía no hay reservas.</p>}</div></div>
    </section>
  </div>;
}