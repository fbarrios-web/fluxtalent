import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Ban, CalendarDays, Check, ChevronDown, ChevronUp, RefreshCw, Clock, Copy, ExternalLink, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cancelDemoBooking, rescheduleDemoBooking, createDemoBlockedPeriod, createDemoBlockedPeriods, deleteDemoBlockedPeriod, getDemoScheduling, saveDemoScheduling } from "@/lib/demo-scheduling.functions";
import { zonedToUtc } from "@/lib/scheduling-overlap.server";

export const Route = createFileRoute("/app/admin/demos")({
  component: DemoSchedulingAdmin,
  head: () => ({ meta: [
    { title: "Agenda Flux Talent" },
    { name: "description", content: "Configuración de disponibilidad y reservas de demos de FLUX Talent." },
    { property: "og:title", content: "Agenda Flux Talent" },
    { property: "og:description", content: "Configuración de disponibilidad y reservas de demos de FLUX Talent." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "Agenda Flux Talent" },
  ] }),
});

type Rule = { weekdays: number[]; startTime: string; endTime: string; effectiveFrom: string; effectiveUntil: string };
const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function DemoSchedulingAdmin() {
  const get = useServerFn(getDemoScheduling);
  const save = useServerFn(saveDemoScheduling);
  const createBlock = useServerFn(createDemoBlockedPeriod);
  const deleteBlock = useServerFn(deleteDemoBlockedPeriod);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["demo-scheduling"], queryFn: () => get() });
  const [duration, setDuration] = useState(30);
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);
  const [saving, setSaving] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [block, setBlock] = useState({ date: "", allDay: true, startTime: "09:00", endTime: "18:00", reason: "" });
  const [recurring, setRecurring] = useState(false);
  const [weekly, setWeekly] = useState({ weekdays: [3] as number[], startTime: "10:00", endTime: "11:00", from: "", until: "", reason: "" });
  const createBlocks = useServerFn(createDemoBlockedPeriods);
  const cancelBooking = useServerFn(cancelDemoBooking);
  const rescheduleBooking = useServerFn(rescheduleDemoBooking);
  const [showBlocks, setShowBlocks] = useState(false);
  const [busyBooking, setBusyBooking] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newSlot, setNewSlot] = useState("");
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

  const futureSlots = useMemo(() => data?.slots.filter(slot => slot.status === "open" && !data.blockedPeriods.some(period => new Date(slot.start_at) < new Date(period.ends_at) && new Date(period.starts_at) < new Date(slot.end_at))) ?? [], [data]);

  async function onCreateBlock() {
    if (!block.date) return toast.error("Elegí la fecha que querés bloquear.");
    if (!block.allDay && block.endTime <= block.startTime) return toast.error("La hora final debe ser posterior a la inicial.");
    setBlocking(true);
    try {
      const startsAt = zonedToUtc(`${block.date}T${block.allDay ? "00:00" : block.startTime}`, "America/Argentina/Buenos_Aires").toISOString();
      const endsAt = zonedToUtc(`${block.date}T${block.allDay ? "23:59" : block.endTime}`, "America/Argentina/Buenos_Aires").toISOString();
      const result = await createBlock({ data: { startsAt, endsAt, reason: block.reason } });
      if (result.conflictingBookings > 0) toast.warning(`Bloqueo guardado. Hay ${result.conflictingBookings} reserva${result.conflictingBookings === 1 ? "" : "s"} confirmada${result.conflictingBookings === 1 ? "" : "s"} dentro de ese período.`);
      else toast.success("Bloqueo guardado.");
      setBlock({ date: "", allDay: true, startTime: "09:00", endTime: "18:00", reason: "" });
      await qc.invalidateQueries({ queryKey: ["demo-scheduling"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el bloqueo.");
    } finally {
      setBlocking(false);
    }
  }

  async function onCreateWeekly() {
    const w = weekly;
    if (!w.weekdays.length) return toast.error("Elegí al menos un día de la semana.");
    if (!w.from || !w.until) return toast.error("Completá las fechas desde y hasta.");
    if (w.until < w.from) return toast.error("La fecha hasta debe ser posterior a la fecha desde.");
    if (w.endTime <= w.startTime) return toast.error("La hora final debe ser posterior a la inicial.");
    const tz = "America/Argentina/Buenos_Aires";
    const periods: { startsAt: string; endsAt: string }[] = [];
    const cursor = new Date(`${w.from}T12:00:00Z`);
    const end = new Date(`${w.until}T12:00:00Z`);
    while (cursor <= end) {
      if (w.weekdays.includes(cursor.getUTCDay())) {
        const d = cursor.toISOString().slice(0, 10);
        periods.push({ startsAt: zonedToUtc(`${d}T${w.startTime}`, tz).toISOString(), endsAt: zonedToUtc(`${d}T${w.endTime}`, tz).toISOString() });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (!periods.length) return toast.error("No hay días que coincidan en ese rango.");
    if (periods.length > 400) return toast.error("El rango es demasiado largo. Elegí un período menor.");
    setBlocking(true);
    try {
      const result = await createBlocks({ data: { periods, reason: w.reason } });
      toast.success(`Se bloquearon ${result.created} franjas.`);
      setWeekly({ weekdays: [3], startTime: "10:00", endTime: "11:00", from: "", until: "", reason: "" });
      await qc.invalidateQueries({ queryKey: ["demo-scheduling"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el bloqueo.");
    } finally {
      setBlocking(false);
    }
  }

  async function onDeleteBlock(id: string) {
    try {
      await deleteBlock({ data: { id } });
      toast.success("Bloqueo eliminado.");
      await qc.invalidateQueries({ queryKey: ["demo-scheduling"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el bloqueo.");
    }
  }

  async function onCancelBooking(id: string) {
    if (!window.confirm("¿Cancelar esta reunión? Se avisará al prospecto y a los invitados.")) return;
    setBusyBooking(id);
    try {
      const r = await cancelBooking({ data: { bookingId: id } });
      toast.success(r.emailSent ? "Reunión cancelada y participantes notificados." : "Reunión cancelada. Google avisó a los invitados, pero no se pudo enviar el email adicional.");
      await qc.invalidateQueries({ queryKey: ["demo-scheduling"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cancelar.");
    } finally { setBusyBooking(null); }
  }

  async function onReschedule(id: string) {
    if (!newSlot) return toast.error("Elegí el nuevo horario.");
    setBusyBooking(id);
    try {
      const r = await rescheduleBooking({ data: { bookingId: id, slotId: newSlot } });
      toast.success(r.emailSent ? "Reunión reprogramada y participantes notificados." : "Reunión reprogramada. Google avisó a los invitados, pero no se pudo enviar el email adicional.");
      setReschedulingId(null); setNewSlot("");
      await qc.invalidateQueries({ queryKey: ["demo-scheduling"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo reprogramar.");
    } finally { setBusyBooking(null); }
  }

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

    <section className="space-y-5 border-t border-border pt-8">
      <div><h3 className="flex items-center gap-2 font-semibold"><Ban className="h-4 w-4" /> Bloqueos</h3><p className="mt-1 text-sm text-muted-foreground">Impedí nuevas reservas durante un día completo, una franja específica o de forma semanal.</p></div>
      <div className="flex gap-2">
        <Button size="sm" variant={!recurring ? "default" : "outline"} onClick={() => setRecurring(false)}>Fecha puntual</Button>
        <Button size="sm" variant={recurring ? "default" : "outline"} onClick={() => setRecurring(true)}>Semanal (por día)</Button>
      </div>
      {recurring ? <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">{DAYS.map((day, weekday) => {
          const active = weekly.weekdays.includes(weekday);
          return <Button key={day} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => setWeekly({ ...weekly, weekdays: active ? weekly.weekdays.filter(v => v !== weekday) : [...weekly.weekdays, weekday].sort() })}>{day}</Button>;
        })}</div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div><Label>Hora desde</Label><Input type="time" value={weekly.startTime} onChange={e => setWeekly({ ...weekly, startTime: e.target.value })} /></div>
          <div><Label>Hora hasta</Label><Input type="time" value={weekly.endTime} onChange={e => setWeekly({ ...weekly, endTime: e.target.value })} /></div>
          <div><Label>Fecha desde</Label><Input type="date" value={weekly.from} onChange={e => setWeekly({ ...weekly, from: e.target.value })} /></div>
          <div><Label>Fecha hasta</Label><Input type="date" value={weekly.until} onChange={e => setWeekly({ ...weekly, until: e.target.value })} /></div>
          <div><Label>Motivo (opcional)</Label><Input maxLength={300} placeholder="Ej. reunión semanal" value={weekly.reason} onChange={e => setWeekly({ ...weekly, reason: e.target.value })} /></div>
        </div>
      </div> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div><Label>Fecha</Label><Input type="date" value={block.date} onChange={event => setBlock({ ...block, date: event.target.value })} /></div>
        <div className="flex items-end"><label className="flex h-10 items-center gap-3 text-sm"><Switch checked={block.allDay} onCheckedChange={allDay => setBlock({ ...block, allDay })} /> Día completo</label></div>
        {!block.allDay && <><div><Label>Desde</Label><Input type="time" value={block.startTime} onChange={event => setBlock({ ...block, startTime: event.target.value })} /></div><div><Label>Hasta</Label><Input type="time" value={block.endTime} onChange={event => setBlock({ ...block, endTime: event.target.value })} /></div></>}
        <div className={block.allDay ? "lg:col-span-3" : ""}><Label>Motivo (opcional)</Label><Input maxLength={300} placeholder="Ej. feriado o reunión interna" value={block.reason} onChange={event => setBlock({ ...block, reason: event.target.value })} /></div>
      </div>}
      <Button variant="outline" onClick={recurring ? onCreateWeekly : onCreateBlock} disabled={blocking}>{blocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Agregar bloqueo</Button>
      <button type="button" onClick={() => setShowBlocks(v => !v)} className="flex w-full items-center justify-between border-t border-border pt-4 text-sm font-medium">
        <span>Bloqueos cargados ({data.blockedPeriods.length})</span>
        <span className="flex items-center gap-1 text-muted-foreground">{showBlocks ? <>Ocultar <ChevronUp className="h-4 w-4" /></> : <>Ver lista <ChevronDown className="h-4 w-4" /></>}</span>
      </button>
      {showBlocks && <div className="max-h-80 divide-y divide-border overflow-y-auto border-t border-border">
        {data.blockedPeriods.map(period => <div key={period.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><div className="font-medium">{new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(period.starts_at))} — {new Intl.DateTimeFormat("es-AR", { timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(period.ends_at))}</div>{period.reason && <div className="text-muted-foreground">{period.reason}</div>}</div><Button variant="ghost" size="icon" aria-label="Eliminar bloqueo" onClick={() => onDeleteBlock(period.id)}><Trash2 className="h-4 w-4" /></Button></div>)}
        {!data.blockedPeriods.length && <p className="py-4 text-sm text-muted-foreground">No hay bloqueos próximos.</p>}
      </div>}
    </section>

    <section className="grid gap-6 border-t border-border pt-8 lg:grid-cols-2">
      <div><h3 className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" /> Próximos horarios disponibles</h3><div className="mt-3 space-y-2">{futureSlots.slice(0, 12).map(slot => <div key={slot.id} className="flex items-center justify-between border-b border-border py-2 text-sm"><span>{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(slot.start_at))}</span><span className="text-muted-foreground">Disponible</span></div>)}{!futureSlots.length && <p className="text-sm text-muted-foreground">No hay horarios disponibles.</p>}</div></div>
      <div><h3 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4" /> Últimas reservas</h3><div className="mt-3 space-y-3">{data.bookings.map((booking: any) => {
        const start = booking.demo_slots?.start_at;
        const active = ["reserved", "confirmed"].includes(booking.status) && start && new Date(start) > new Date();
        const busy = busyBooking === booking.id;
        return <div key={booking.id} className="border-b border-border pb-3 text-sm">
          <div className="flex items-start justify-between gap-2"><div className="font-medium">{booking.first_name} {booking.last_name}</div>{booking.status === "canceled" && <span className="text-xs font-medium text-destructive">Cancelada</span>}</div>
          <div className="text-muted-foreground">{booking.email} · {booking.phone}</div>
          <div className="mt-1 text-xs text-muted-foreground">{start ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(start)) : "Horario no disponible"}</div>
          {active && <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setReschedulingId(reschedulingId === booking.id ? null : booking.id); setNewSlot(""); }}><RefreshCw className="h-4 w-4" /> Reprogramar</Button>
            <Button size="sm" variant="outline" disabled={busy} className="text-destructive" onClick={() => onCancelBooking(booking.id)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Cancelar</Button>
          </div>}
          {active && reschedulingId === booking.id && <div className="mt-2 flex flex-wrap items-center gap-2">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={newSlot} onChange={e => setNewSlot(e.target.value)}>
              <option value="">Elegí nuevo horario…</option>
              {futureSlots.map(slot => <option key={slot.id} value={slot.id}>{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(slot.start_at))}</option>)}
            </select>
            <Button size="sm" disabled={busy || !newSlot} onClick={() => onReschedule(booking.id)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar</Button>
          </div>}
        </div>;
      })}{!data.bookings.length && <p className="text-sm text-muted-foreground">Todavía no hay reservas.</p>}</div></div>
    </section>
  </div>;
}