import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { BriefcaseBusiness, Search, Plus, Pencil, CalendarDays, CheckCircle2, Circle, Clock, FileText, Flag, Trash2, ExternalLink, RefreshCw, Loader2, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientForm, RecordForm } from '@/components/client-tracking-forms';
import { getClientTracking, completeTrackingTask, deleteTrackingRecord, retryTrackingRecord } from '@/lib/crm.functions';
import { CLIENT_STAGES, RECORD_KINDS, trackingStatus, buenosAiresToday } from '@/lib/crm';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

export const Route = createFileRoute('/app/admin/clients')({
  component: ClientTracking,
  head: () => ({ meta: [
    { title: 'Seguimiento de clientes — FLUX Talent' },
    { name: 'description', content: 'Gestión comercial de clientes, reuniones, acuerdos y pendientes de FLUX Talent.' },
    { property: 'og:title', content: 'Seguimiento de clientes — FLUX Talent' },
    { property: 'og:description', content: 'Seguimiento comercial y estado de los próximos pasos por cliente.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
});
type RecordRow = Database['public']['Tables']['crm_records']['Row'];
const icons = { note: FileText, meeting: CalendarDays, transcript: FileText, event: Flag, task: Clock };
const formatWhen = (v: string) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
const dateLabel = (v: string) => v.split('-').reverse().join('/');
const stageLabel = (v: string) => CLIENT_STAGES[v as keyof typeof CLIENT_STAGES] ?? v;

function ClientTracking() {
  const get = useServerFn(getClientTracking);
  const complete = useServerFn(completeTrackingTask);
  const remove = useServerFn(deleteTrackingRecord);
  const retry = useServerFn(retryTrackingRecord);
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['client-tracking'], queryFn: () => get(), refetchInterval: 60000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [status, setStatus] = useState('all');
  const [clientForm, setClientForm] = useState<'new' | 'edit' | null>(null);
  const [recordForm, setRecordForm] = useState<{ kind: keyof typeof RECORD_KINDS; record?: RecordRow } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ['client-tracking'] }); };
  const today = buenosAiresToday();
  const clients = (data?.clients ?? []).map(client => {
    const records = data?.records.filter(r => r.client_id === client.id) ?? [];
    const meetings = data?.meetings.filter(m => m.crm_client_id === client.id) ?? [];
    const nextMeeting = meetings.filter(m => ['confirmed', 'reserved'].includes(m.status) && m.demo_slots?.start_at && new Date(m.demo_slots.start_at) > new Date()).sort((a, b) => (a.demo_slots?.start_at ?? '').localeCompare(b.demo_slots?.start_at ?? ''))[0];
    return { ...client, records, meetings, nextMeeting, health: trackingStatus(records, today) };
  });
  const filtered = clients.filter(c => `${c.name} ${c.company} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase()) && (stage === 'all' || c.stage === stage) && (status === 'all' || (status === 'overdue' ? c.health.overdue > 0 : status === 'pending' ? c.health.pending > 0 : c.health.pending === 0)));
  const client = clients.find(c => c.id === selectedId) ?? filtered[0];
  const totals = { pending: clients.reduce((sum, c) => sum + c.health.pending, 0), overdue: clients.reduce((sum, c) => sum + c.health.overdue, 0), active: clients.filter(c => c.stage === 'client').length };
  async function toggleTask(record: RecordRow) {
    setBusyId(record.id); try { const result = await complete({ data: { id: record.id, completed: !record.completed_at } }); result.warnings.forEach(w => toast.warning(w)); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo actualizar.'); } finally { setBusyId(null); }
  }
  async function retryRecord(record: RecordRow, action: 'minutes' | 'calendar') {
    setBusyId(record.id);
    try { const result = await retry({ data: { id: record.id, action } }); if (result.warnings.length) result.warnings.forEach(w => toast.warning(w)); else toast.success(action === 'minutes' ? 'Minuta guardada.' : 'Calendario actualizado.'); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo actualizar.'); }
    finally { setBusyId(null); }
  }
  async function deleteRecord(record: RecordRow) {
    if (!window.confirm(`¿Eliminar “${record.title}”?`)) return;
    setBusyId(record.id); try { await remove({ data: { id: record.id } }); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo eliminar.'); } finally { setBusyId(null); }
  }
  function recordItem(record: RecordRow) {
    const Icon = icons[record.kind as keyof typeof icons] ?? FileText;
    return <article key={record.id} className="border-b border-border py-4 last:border-0">
      <div className="flex items-start gap-3"><Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h4 className={cn('break-words font-medium', record.completed_at && 'text-muted-foreground line-through')}>{record.title}</h4><Badge variant="outline">{RECORD_KINDS[record.kind as keyof typeof RECORD_KINDS]}</Badge></div>
        <p className="mt-1 text-xs text-muted-foreground">{formatWhen(record.occurs_at ?? record.created_at)}{record.responsible && ` · ${record.responsible}`}{record.due_date && ` · Vence ${dateLabel(record.due_date)}`}</p>
        {record.content && <details className="mt-2"><summary className="cursor-pointer text-sm text-primary">{record.kind === 'transcript' ? 'Ver transcripción' : 'Ver detalle'}</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{record.content}</p></details>}
        {record.kind === 'transcript' && <div className="mt-3 border-l-2 border-primary pl-3"><h5 className="text-sm font-semibold">Minuta</h5>{record.minutes && <div className="mt-2 space-y-2 break-words text-sm leading-relaxed">{record.minutes.split('\n').map((line, i) => <p key={i} className={/^#{1,6}\s/.test(line) ? 'pt-2 font-semibold' : ''}>{line.replace(/^#{1,6}\s/, '').replace(/\*\*(.*?)\*\*/g, '$1')}</p>)}</div>}{record.minutes_error && <p className="mt-2 break-words text-sm text-destructive">{record.minutes_error}</p>}<Button className="mt-2" size="sm" variant="outline" disabled={busyId === record.id} onClick={() => retryRecord(record, 'minutes')}>{busyId === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{record.minutes ? 'Regenerar minuta' : 'Generar minuta'}</Button></div>}
        {record.calendar_status === 'synced' && <p className="mt-2 flex items-center gap-1 text-xs text-success"><CalendarDays className="h-3 w-3" />En Calendar de {record.responsible}</p>}
        {record.calendar_status === 'error' && <div className="mt-2"><p className="break-words text-sm text-destructive">{record.calendar_error}</p><Button className="mt-2" size="sm" variant="outline" disabled={busyId === record.id} onClick={() => retryRecord(record, 'calendar')}><RefreshCw className="h-4 w-4" />Sincronizar Calendar</Button></div>}
      </div><div className="flex shrink-0 gap-1">{record.kind === 'task' && <Button size="icon" variant="ghost" disabled={busyId === record.id} title={record.completed_at ? 'Reabrir pendiente' : 'Marcar como resuelto'} aria-label={record.completed_at ? 'Reabrir pendiente' : 'Marcar como resuelto'} onClick={() => toggleTask(record)}>{record.completed_at ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4" />}</Button>}<Button size="icon" variant="ghost" title="Editar registro" aria-label="Editar registro" onClick={() => setRecordForm({ kind: record.kind as keyof typeof RECORD_KINDS, record })}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title="Eliminar registro" aria-label="Eliminar registro" disabled={busyId === record.id} onClick={() => deleteRecord(record)}><Trash2 className="h-4 w-4" /></Button></div></div>
    </article>;
  }
  return <section>
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-3xl">Seguimiento de clientes</h2><div className="flex gap-2"><Button size="icon" variant="outline" title="Actualizar seguimiento" aria-label="Actualizar seguimiento" onClick={() => refetch()}><RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} /></Button><Button onClick={() => setClientForm('new')}><Plus className="h-4 w-4" />Nuevo cliente</Button></div></header>
    <div className="my-6 grid grid-cols-2 divide-x divide-border border-y border-border py-4 sm:grid-cols-4">{[[clients.length, 'Clientes y prospectos'], [totals.active, 'Clientes activos'], [totals.pending, 'Pendientes'], [totals.overdue, 'Atrasados']].map(([value, label]) => <div key={label} className="px-4 first:pl-0"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>
    <div className="mb-5 flex flex-wrap gap-2"><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Buscar clientes" placeholder="Buscar contacto, empresa o email…" value={search} onChange={e => setSearch(e.target.value)} /></div><Select value={stage} onValueChange={setStage}><SelectTrigger className="w-48" aria-label="Filtrar por etapa"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las etapas</SelectItem>{Object.entries(CLIENT_STAGES).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-44" aria-label="Filtrar seguimiento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todo seguimiento</SelectItem><SelectItem value="pending">Con pendientes</SelectItem><SelectItem value="overdue">Atrasados</SelectItem><SelectItem value="current">Al día</SelectItem></SelectContent></Select></div>
    {isLoading ? <div className="grid h-48 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : error ? <div className="py-8 text-destructive">No se pudo cargar el seguimiento. <Button variant="outline" onClick={() => refetch()}>Reintentar</Button></div> : <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-2">{filtered.length === 0 && <p className="py-8 text-sm text-muted-foreground">No hay clientes que coincidan.</p>}{filtered.map(c => <Button key={c.id} variant="outline" onClick={() => setSelectedId(c.id)} className={cn('h-auto w-full flex-col items-start gap-2 whitespace-normal rounded-lg p-4 text-left', client?.id === c.id && 'border-primary bg-accent/40')}><div className="flex w-full items-start justify-between gap-2"><span className="min-w-0 break-words font-semibold">{c.company || c.name}</span><BriefcaseBusiness className="h-4 w-4 shrink-0 text-muted-foreground" /></div>{c.company && <span className="text-xs text-muted-foreground">{c.name}</span>}<div className="flex flex-wrap gap-2"><Badge variant="secondary">{stageLabel(c.stage)}</Badge><span className={cn('text-xs', c.health.overdue ? 'text-destructive' : c.health.pending ? 'text-muted-foreground' : 'text-success')}>{c.health.label}{c.health.pending > 0 && ` · ${c.health.pending}`}</span></div><span className="line-clamp-2 text-xs font-normal text-muted-foreground">{c.summary || (c.nextMeeting?.demo_slots?.start_at ? `Demo: ${formatWhen(c.nextMeeting.demo_slots.start_at)}` : c.email || 'Sin acuerdos registrados')}</span></Button>)}</aside>
      {client ? <div className="min-w-0 xl:border-l xl:border-border xl:pl-6"><header className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-2xl font-semibold">{client.company || client.name}</h3><p className="mt-1 text-sm text-muted-foreground">{client.company ? `${client.name} · ` : ''}{stageLabel(client.stage)}{client.owner_name && ` · ${client.owner_name}`}</p></div><Button size="icon" variant="outline" title="Editar cliente" aria-label="Editar cliente" onClick={() => setClientForm('edit')}><Pencil className="h-4 w-4" /></Button></header>
        <div className="my-4 flex flex-wrap gap-4 text-sm">{client.email && <a className="flex min-w-0 items-center gap-2 text-primary" href={`mailto:${client.email}`}><Mail className="h-4 w-4 shrink-0" /><span className="break-all">{client.email}</span></a>}{client.phone && <span className="flex items-center gap-2"><Phone className="h-4 w-4" />{client.phone}</span>}<span>País: {client.country || 'Sin informar'}</span><Badge variant="outline">{client.source === 'demo' ? 'Agenda de demos' : 'Carga manual'}</Badge></div>
        <div className="border-y border-border py-4"><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">Resumen y acuerdos vigentes</h4><span className={cn('text-xs font-medium', client.health.overdue ? 'text-destructive' : client.health.pending ? 'text-muted-foreground' : 'text-success')}>{client.health.label}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{client.summary || 'Sin acuerdos registrados.'}</p></div>
        <div className="my-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => setRecordForm({ kind: 'note' })}><Plus className="h-4 w-4" />Agregar registro</Button><Button size="sm" variant="outline" onClick={() => setRecordForm({ kind: 'task' })}><Clock className="h-4 w-4" />Nuevo pendiente</Button></div>
        <Tabs key={client.id} defaultValue="history"><TabsList className="max-w-full"><TabsTrigger value="history">Historial</TabsTrigger><TabsTrigger value="tasks">Pendientes ({client.health.pending})</TabsTrigger><TabsTrigger value="meetings">Reuniones</TabsTrigger></TabsList>
          <TabsContent value="history">{client.records.length ? client.records.map(recordItem) : <p className="py-6 text-sm text-muted-foreground">Sin registros todavía.</p>}</TabsContent>
          <TabsContent value="tasks">{client.records.filter(r => r.kind === 'task').sort((a, b) => Number(Boolean(a.completed_at)) - Number(Boolean(b.completed_at)) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')).map(recordItem)}{!client.records.some(r => r.kind === 'task') && <p className="py-6 text-sm text-muted-foreground">No hay pendientes registrados.</p>}</TabsContent>
          <TabsContent value="meetings"><div className="mb-3 flex items-center justify-between"><p className="text-xs text-muted-foreground">Horarios de Buenos Aires</p><Link to="/app/admin/demos" className="flex items-center gap-1 text-sm text-primary">Agenda de demos<ExternalLink className="h-3 w-3" /></Link></div>{client.meetings.map(m => <article key={m.id} className="border-b border-border py-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-2 font-medium"><CalendarDays className="h-4 w-4" />Demo Flux Talent</h4><Badge variant="outline">{m.status === 'confirmed' ? 'Confirmada' : m.status === 'reserved' ? 'Reservada' : m.status === 'canceled' ? 'Cancelada' : m.status}</Badge></div><p className="mt-2 text-sm">{m.demo_slots?.start_at ? formatWhen(m.demo_slots.start_at) : 'Sin horario'}</p>{m.meet_link && ['confirmed', 'reserved'].includes(m.status) && <a className="mt-2 inline-flex items-center gap-1 text-sm text-primary" href={m.meet_link} target="_blank" rel="noreferrer">Abrir Meet<ExternalLink className="h-3 w-3" /></a>}<div className="mt-2"><Button size="sm" variant="outline" onClick={() => setRecordForm({ kind: 'transcript' })}><FileText className="h-4 w-4" />Cargar transcripción</Button></div></article>)}{client.records.filter(r => r.kind === 'meeting').map(recordItem)}{!client.meetings.length && !client.records.some(r => r.kind === 'meeting') && <p className="py-6 text-sm text-muted-foreground">Sin reuniones registradas.</p>}</TabsContent>
        </Tabs>
      </div> : <div className="py-12 text-center text-muted-foreground">Sin clientes registrados.</div>}
    </div>}
    {clientForm && <ClientForm client={clientForm === 'edit' ? client : undefined} onClose={() => setClientForm(null)} onSaved={async id => { setSelectedId(id); await refresh(); }} />}
    {recordForm && client && <RecordForm clientId={client.id} initialKind={recordForm.kind} record={recordForm.record} onClose={() => setRecordForm(null)} onSaved={refresh} />}
  </section>;
}