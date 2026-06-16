import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getVacancyScheduling, saveVacancyScheduling, regenerateSlots,
  setSlotStatus, addManualSlot,
} from "@/lib/scheduling.functions";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

type Rule = {
  weekdays: number[];
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveUntil: string;
};

export function VacancyScheduling({ vacancyId }: { vacancyId: string }) {
  const qc = useQueryClient();
  const get = useServerFn(getVacancyScheduling);
  const save = useServerFn(saveVacancyScheduling);
  const regen = useServerFn(regenerateSlots);
  const setStatus = useServerFn(setSlotStatus);
  const addManual = useServerFn(addManualSlot);

  const { data, isLoading } = useQuery({
    queryKey: ["vac-sched", vacancyId],
    queryFn: () => get({ data: { vacancyId } }),
  });

  const [duration, setDuration] = useState(30);
  const [instructions, setInstructions] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");

  useEffect(() => {
    if (data) {
      setDuration(data.config?.duration_minutes ?? 30);
      setInstructions(data.config?.instructions ?? "");
      setEnabled(data.config?.enabled ?? true);
      // Group rows that share start/end/from/until into a single rule with multiple weekdays
      const groups = new Map<string, Rule>();
      for (const r of (data.rules ?? []) as any[]) {
        const startTime = r.start_time?.slice(0, 5) ?? "09:00";
        const endTime = r.end_time?.slice(0, 5) ?? "12:00";
        const effectiveFrom = r.effective_from ?? "";
        const effectiveUntil = r.effective_until ?? "";
        const key = `${startTime}|${endTime}|${effectiveFrom}|${effectiveUntil}`;
        const cur = groups.get(key);
        if (cur) cur.weekdays.push(r.weekday);
        else groups.set(key, { weekdays: [r.weekday], startTime, endTime, effectiveFrom, effectiveUntil });
      }
      setRules(Array.from(groups.values()).map(g => ({ ...g, weekdays: g.weekdays.sort() })));
    }
  }, [data]);

  function toggleDay(i: number, day: number) {
    setRules(rules.map((r, j) => {
      if (j !== i) return r;
      const has = r.weekdays.includes(day);
      return { ...r, weekdays: has ? r.weekdays.filter(d => d !== day) : [...r.weekdays, day].sort() };
    }));
  }

  async function onSave() {
    try {
      const payload = rules
        .filter(r => r.weekdays.length > 0)
        .map(r => ({
          weekdays: r.weekdays,
          startTime: r.startTime,
          endTime: r.endTime,
          effectiveFrom: r.effectiveFrom || null,
          effectiveUntil: r.effectiveUntil || null,
        }));
      await save({ data: { vacancyId, durationMinutes: duration, instructions, enabled, rules: payload } });
      toast.success("Configuración guardada");
      qc.invalidateQueries({ queryKey: ["vac-sched", vacancyId] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function onRegenerate() {
    try {
      const res = await regen({ data: { vacancyId, days: 30 } });
      toast.success(`${res.created} slots creados para los próximos 30 días`);
      qc.invalidateQueries({ queryKey: ["vac-sched", vacancyId] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function onAddManual() {
    if (!manualDate || !manualTime) return;
    try {
      const iso = new Date(`${manualDate}T${manualTime}:00`).toISOString();
      await addManual({ data: { vacancyId, startISO: iso, durationMinutes: duration } });
      setManualTime("");
      toast.success("Slot agregado");
      qc.invalidateQueries({ queryKey: ["vac-sched", vacancyId] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function toggle(slotId: string, current: string) {
    try {
      await setStatus({ data: { slotId, status: current === "open" ? "blocked" : "open" } });
      qc.invalidateQueries({ queryKey: ["vac-sched", vacancyId] });
    } catch (e: any) { toast.error(e.message); }
  }

  if (isLoading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 p-1">
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-semibold">Configuración general</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Duración del slot (minutos)</Label>
            <Input type="number" min={15} max={240} value={duration} onChange={e => setDuration(Number(e.target.value))} />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
              Habilitar agenda para esta vacante
            </label>
          </div>
        </div>
        <div>
          <Label>Instrucciones para el postulante (opcional)</Label>
          <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={2} />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Disponibilidad semanal recurrente</h3>
          <Button size="sm" variant="outline" onClick={() => setRules([...rules, { weekdays: [1], startTime: "09:00", endTime: "12:00", effectiveFrom: "", effectiveUntil: "" }])}>
            <Plus className="h-4 w-4 mr-1" /> Agregar franja
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Elegí uno o varios días de la semana, el horario, y opcionalmente desde / hasta cuándo se aplica esta franja.</p>
        {rules.length === 0 && <p className="text-sm text-muted-foreground">No hay franjas. Agregá una arriba.</p>}
        <div className="space-y-4">
          {rules.map((r, i) => (
            <div key={i} className="rounded-lg border bg-background/40 p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Días de la semana</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {WEEKDAYS.map((d, idx) => {
                      const active = r.weekdays.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleDay(i, idx)}
                          className={`rounded-md border px-2 py-1 text-xs transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"}`}
                        >{d}</button>
                      );
                    })}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setRules(rules.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">Hora inicio</Label>
                  <Input type="time" value={r.startTime}
                    onChange={e => setRules(rules.map((x, j) => j === i ? { ...x, startTime: e.target.value } : x))} />
                </div>
                <div>
                  <Label className="text-xs">Hora fin</Label>
                  <Input type="time" value={r.endTime}
                    onChange={e => setRules(rules.map((x, j) => j === i ? { ...x, endTime: e.target.value } : x))} />
                </div>
                <div>
                  <Label className="text-xs">Desde (opcional)</Label>
                  <Input type="date" value={r.effectiveFrom}
                    onChange={e => setRules(rules.map((x, j) => j === i ? { ...x, effectiveFrom: e.target.value } : x))} />
                </div>
                <div>
                  <Label className="text-xs">Hasta (opcional)</Label>
                  <Input type="date" value={r.effectiveUntil}
                    onChange={e => setRules(rules.map((x, j) => j === i ? { ...x, effectiveUntil: e.target.value } : x))} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Button onClick={onSave}>Guardar</Button>
          <Button variant="outline" onClick={onRegenerate}><RefreshCw className="h-4 w-4 mr-1" />Regenerar 30 días</Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-semibold">Agregar horario puntual</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} />
          </div>
          <div>
            <Label>Hora</Label>
            <Input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} />
          </div>
          <Button onClick={onAddManual} disabled={!manualDate || !manualTime}>Agregar</Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-3">Próximos slots ({data?.slots?.length ?? 0})</h3>
        {(!data?.slots || data.slots.length === 0) ? (
          <p className="text-sm text-muted-foreground">Sin slots cargados. Configurá la disponibilidad y tocá "Regenerar".</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
            {data.slots.map((s: any) => {
              const dt = new Date(s.start_at);
              const label = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(dt);
              const isBooked = s.status === "booked";
              const isBlocked = s.status === "blocked";
              return (
                <button key={s.id} disabled={isBooked} onClick={() => toggle(s.id, s.status)}
                  className={`rounded border px-3 py-2 text-xs text-left transition-colors ${
                    isBooked ? "bg-muted text-muted-foreground cursor-not-allowed" :
                    isBlocked ? "bg-destructive/10 line-through text-muted-foreground" :
                    "bg-background hover:bg-accent"
                  }`}>
                  <div className="font-medium">{label}</div>
                  <div className="opacity-60">{isBooked ? "Reservado" : isBlocked ? "Bloqueado" : "Libre"}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
