import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, X, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getVacancyScheduling, saveVacancyScheduling, regenerateSlots,
  setSlotStatus, addManualSlot, checkSchedulingOverlaps,
} from "@/lib/scheduling.functions";


const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const STAGES = [
  { id: "interview_1", label: "Entrevista 1" },
  { id: "interview_2", label: "Entrevista 2" },
  { id: "interview_3", label: "Entrevista 3" },
] as const;

type StageId = typeof STAGES[number]["id"];

type Rule = {
  weekdays: number[];
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveUntil: string;
};

export function VacancyScheduling({ vacancyId }: { vacancyId: string }) {
  const [stage, setStage] = useState<StageId>("interview_1");
  return (
    <Tabs value={stage} onValueChange={(v) => setStage(v as StageId)}>
      <TabsList data-tour="sched-stages">
        {STAGES.map(s => <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>)}
      </TabsList>
      {STAGES.map(s => (
        <TabsContent key={s.id} value={s.id} className="mt-4">
          {stage === s.id && <StageScheduling vacancyId={vacancyId} stage={s.id} />}
        </TabsContent>
      ))}
    </Tabs>
  );
}

const STAGE_LABELS: Record<string, string> = {
  interview_1: "Entrevista 1",
  interview_2: "Entrevista 2",
  interview_3: "Entrevista 3",
};

type Overlap = { start: string; vacancyTitle: string; stage: string; sameVacancy: boolean };

function StageScheduling({ vacancyId, stage }: { vacancyId: string; stage: StageId }) {
  const qc = useQueryClient();
  const get = useServerFn(getVacancyScheduling);
  const save = useServerFn(saveVacancyScheduling);
  const regen = useServerFn(regenerateSlots);
  const setStatus = useServerFn(setSlotStatus);
  const addManual = useServerFn(addManualSlot);
  const checkOverlaps = useServerFn(checkSchedulingOverlaps);

  const { data, isLoading } = useQuery({
    queryKey: ["vac-sched", vacancyId, stage],
    queryFn: () => get({ data: { vacancyId, stage } }),
  });

  const [duration, setDuration] = useState(30);
  const [instructions, setInstructions] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [interviewerEmail, setInterviewerEmail] = useState("");
  const [extraInvitees, setExtraInvitees] = useState<string[]>([]);
  const [newInvitee, setNewInvitee] = useState("");
  const [rules, setRules] = useState<Rule[]>([]);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [ruleToDelete, setRuleToDelete] = useState<{ index: number; rule: Rule } | null>(null);
  const [deletingRule, setDeletingRule] = useState(false);
  const [checkingOverlaps, setCheckingOverlaps] = useState(false);
  const [overlapWarning, setOverlapWarning] = useState<
    { count: number; overlaps: Overlap[]; onConfirm: () => void } | null
  >(null);


  useEffect(() => {
    if (data) {
      setDuration(data.config?.duration_minutes ?? 30);
      setInstructions(data.config?.instructions ?? "");
      setEnabled(data.config?.enabled ?? true);
      setInterviewerEmail((data.config as any)?.interviewer_email ?? "");
      const inv = (data.config as any)?.extra_invitees;
      setExtraInvitees(Array.isArray(inv) ? inv.filter((x: any) => typeof x === "string") : []);
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

  function addInvitee() {
    const e = newInvitee.trim().toLowerCase();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("Email inválido"); return; }
    if (extraInvitees.includes(e)) { setNewInvitee(""); return; }
    setExtraInvitees([...extraInvitees, e]);
    setNewInvitee("");
  }

  function buildRulesPayload(nextRules: Rule[]) {
    return nextRules
      .filter(r => r.weekdays.length > 0)
      .map(r => ({
        weekdays: r.weekdays,
        startTime: r.startTime,
        endTime: r.endTime,
        effectiveFrom: r.effectiveFrom || null,
        effectiveUntil: r.effectiveUntil || null,
      }));
  }

  async function persistRules(nextRules: Rule[]) {
    const payload = buildRulesPayload(nextRules);
    await save({ data: {
      vacancyId, stage,
      durationMinutes: duration, instructions, enabled,
      interviewerEmail: interviewerEmail || null,
      extraInvitees,
      rules: payload,
    } });
    return payload;
  }

  async function doSave() {
    try {
      const payload = await persistRules(rules);
      let createdMsg = "";
      if (payload.length > 0) {
        try {
          const res = await regen({ data: { vacancyId, stage, days: 30 } });
          createdMsg = ` · ${res.created} slots generados`;
        } catch { /* noop */ }
      }
      toast.success("Configuración guardada" + createdMsg);
      qc.invalidateQueries({ queryKey: ["vac-sched", vacancyId, stage] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function onSave() {
    const payload = buildRulesPayload(rules);
    if (payload.length === 0) { await doSave(); return; }
    setCheckingOverlaps(true);
    try {
      const res = await checkOverlaps({ data: {
        vacancyId, stage, durationMinutes: duration, days: 30, rules: payload,
      } });
      if (res.count > 0) {
        setOverlapWarning({ count: res.count, overlaps: res.overlaps as Overlap[], onConfirm: doSave });
        return;
      }
    } catch { /* si falla el chequeo, seguimos con el guardado */ }
    finally { setCheckingOverlaps(false); }
    await doSave();
  }


  async function confirmDeleteRule() {
    if (!ruleToDelete) return;
    const nextRules = rules.filter((_, j) => j !== ruleToDelete.index);
    setDeletingRule(true);
    try {
      const payload = await persistRules(nextRules);
      let createdMsg = "";
      if (payload.length > 0) {
        const res = await regen({ data: { vacancyId, stage, days: 30 } });
        createdMsg = ` ${res.created} slots vigentes fueron recalculados.`;
      }
      setRules(nextRules);
      setRuleToDelete(null);
      toast.success(`Franja eliminada. Los slots asociados fueron eliminados.${createdMsg}`);
      qc.invalidateQueries({ queryKey: ["vac-sched", vacancyId, stage] });
    } catch (e: any) {
      toast.error(e.message || "No se pudo eliminar la franja");
    } finally {
      setDeletingRule(false);
    }
  }

  async function onRegenerate() {
    try {
      const res = await regen({ data: { vacancyId, stage, days: 30 } });
      toast.success(`${res.created} slots creados para los próximos 30 días`);
      qc.invalidateQueries({ queryKey: ["vac-sched", vacancyId, stage] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function doAddManual(iso: string) {
    try {
      await addManual({ data: { vacancyId, stage, startISO: iso, durationMinutes: duration } });
      setManualTime("");
      toast.success("Slot agregado");
      qc.invalidateQueries({ queryKey: ["vac-sched", vacancyId, stage] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function onAddManual() {
    if (!manualDate || !manualTime) return;
    const iso = new Date(`${manualDate}T${manualTime}:00`).toISOString();
    setCheckingOverlaps(true);
    try {
      const res = await checkOverlaps({ data: {
        vacancyId, stage, durationMinutes: duration, rules: [], manualStartISO: iso,
      } });
      if (res.count > 0) {
        setOverlapWarning({
          count: res.count,
          overlaps: res.overlaps as Overlap[],
          onConfirm: () => doAddManual(iso),
        });
        return;
      }
    } catch { /* noop */ }
    finally { setCheckingOverlaps(false); }
    await doAddManual(iso);
  }


  async function toggle(slotId: string, current: string) {
    try {
      await setStatus({ data: { slotId, status: current === "open" ? "blocked" : "open" } });
      qc.invalidateQueries({ queryKey: ["vac-sched", vacancyId, stage] });
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
              Habilitar esta agenda
            </label>
          </div>
          <div className="sm:col-span-2">
            <Label>Email del entrevistador (opcional)</Label>
            <Input type="email" placeholder="entrevistador@empresa.com"
              value={interviewerEmail} onChange={e => setInterviewerEmail(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Se agrega como invitado al evento de Calendar de esta etapa.</p>
          </div>
          <div className="sm:col-span-2">
            <Label>Invitados extra</Label>
            <div className="flex gap-2">
              <Input type="email" placeholder="invitado@empresa.com"
                value={newInvitee} onChange={e => setNewInvitee(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addInvitee(); } }} />
              <Button type="button" variant="outline" onClick={addInvitee}><Plus className="h-4 w-4" /></Button>
            </div>
            {extraInvitees.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {extraInvitees.map(e => (
                  <span key={e} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs">
                    {e}
                    <button type="button" onClick={() => setExtraInvitees(extraInvitees.filter(x => x !== e))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
                <Button size="icon" variant="ghost" aria-label="Eliminar franja" onClick={() => setRuleToDelete({ index: i, rule: r })}>
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
          <Button onClick={onSave} disabled={checkingOverlaps}>
            {checkingOverlaps ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Verificando…</> : "Guardar"}
          </Button>
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
          <Button onClick={onAddManual} disabled={!manualDate || !manualTime || checkingOverlaps}>Agregar</Button>
        </div>
      </div>

      <AlertDialog open={!!overlapWarning} onOpenChange={(open) => { if (!open) setOverlapWarning(null); }}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              Se detectaron {overlapWarning?.count} horarios superpuestos
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Estos horarios se pisan con agendas de otras vacantes o de otras etapas de esta misma búsqueda.
              Si continuás, ambos horarios quedarán disponibles y podrías recibir dos entrevistas a la misma hora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-y-auto rounded-lg border divide-y text-sm">
            {overlapWarning?.overlaps.map((o, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="font-medium">
                  {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(o.start))}
                </span>
                <span className="text-right text-muted-foreground">
                  {o.sameVacancy ? "Esta vacante" : o.vacancyTitle} · {STAGE_LABELS[o.stage] ?? o.stage}
                </span>
              </div>
            ))}
            {overlapWarning && overlapWarning.count > overlapWarning.overlaps.length && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                y {overlapWarning.count - overlapWarning.overlaps.length} más…
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar y elegir otro horario</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const fn = overlapWarning?.onConfirm; setOverlapWarning(null); fn?.(); }}>
              Continuar igual
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <AlertDialog open={!!ruleToDelete} onOpenChange={(open) => { if (!open && !deletingRule) setRuleToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta franja horaria?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la franja de {ruleToDelete?.rule.startTime} a {ruleToDelete?.rule.endTime} y sus slots futuros libres o bloqueados. Las entrevistas ya reservadas y los horarios manuales no se eliminan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRule}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingRule}
              onClick={(event) => { event.preventDefault(); confirmDeleteRule(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar franja y slots"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-3">Calendario ({data?.slots?.length ?? 0})</h3>
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
