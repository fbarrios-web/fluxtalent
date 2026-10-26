import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CLIENT_STAGES, RECORD_KINDS, RESPONSIBLES, clientSchema, recordSchema } from '@/lib/crm';
import { saveTrackingClient, saveTrackingRecord } from '@/lib/crm.functions';
import type { Database } from '@/integrations/supabase/types';

type Client = Database['public']['Tables']['crm_clients']['Row'];
type RecordRow = Database['public']['Tables']['crm_records']['Row'];

export function ClientForm({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved: (id: string) => Promise<void> }) {
  const save = useServerFn(saveTrackingClient);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState({ name: client?.name ?? '', company: client?.company ?? '', email: client?.email ?? '', phone: client?.phone ?? '', country: client?.country ?? '', stage: client?.stage ?? 'prospect', owner_name: client?.owner_name ?? '', summary: client?.summary ?? '' });
  const field = (key: keyof typeof values, value: string) => setValues(v => ({ ...v, [key]: value }));
  return <Dialog open onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{client ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); const parsed = clientSchema.safeParse({ ...values, id: client?.id });
      if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
      setBusy(true); try { const result = await save({ data: parsed.data }); if (result) await onSaved(result.id); toast.success('Cliente guardado.'); onClose(); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar.'); } finally { setBusy(false); }
    }}>
      <div className="grid gap-4 sm:grid-cols-2">{([['name', 'Nombre / contacto *', 160], ['company', 'Empresa', 160], ['email', 'Email', 254], ['phone', 'Teléfono', 60], ['country', 'País', 100]] as const).map(([key, label, max]) => <div key={key} className="space-y-1.5"><Label htmlFor={`client-${key}`}>{label}</Label><Input id={`client-${key}`} type={key === 'email' ? 'email' : 'text'} maxLength={max} required={key === 'name'} value={values[key]} onChange={e => field(key, e.target.value)} /></div>)}
      <div className="space-y-1.5"><Label>Responsable comercial</Label><Select value={values.owner_name || 'unassigned'} onValueChange={v => field('owner_name', v === 'unassigned' ? '' : v)}><SelectTrigger aria-label="Responsable comercial"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Sin asignar</SelectItem>{RESPONSIBLES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}{values.owner_name && !RESPONSIBLES.some(v => v === values.owner_name) && <SelectItem value={values.owner_name}>{values.owner_name}</SelectItem>}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Etapa</Label><Select value={values.stage} onValueChange={v => field('stage', v)}><SelectTrigger aria-label="Etapa del cliente"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CLIENT_STAGES).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select></div></div>
      <div className="space-y-1.5"><Label htmlFor="client-summary">Resumen y acuerdos vigentes</Label><Textarea id="client-summary" rows={5} maxLength={20000} value={values.summary} onChange={e => field('summary', e.target.value)} /></div>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar cliente</Button></div>
    </form>
  </DialogContent></Dialog>;
}

export function RecordForm({ clientId, record, initialKind = 'note', onClose, onSaved }: { clientId: string; record?: RecordRow; initialKind?: keyof typeof RECORD_KINDS; onClose: () => void; onSaved: () => Promise<void> }) {
  const save = useServerFn(saveTrackingRecord);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState(record?.kind ?? initialKind);
  const [title, setTitle] = useState(record?.title ?? '');
  const [content, setContent] = useState(record?.content ?? '');
  const [when, setWhen] = useState(record?.occurs_at ? new Date(new Date(record.occurs_at).getTime() - new Date(record.occurs_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
  const [due, setDue] = useState(record?.due_date ?? '');
  const [responsible, setResponsible] = useState(RESPONSIBLES.some(v => v === record?.responsible) ? record?.responsible ?? '' : '');
  return <Dialog open onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{record ? 'Editar registro' : 'Nuevo registro'}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); const parsed = recordSchema.safeParse({ id: record?.id, client_id: clientId, kind, title, content, occurs_at: when ? new Date(when).toISOString() : null, due_date: due || null, responsible });
      if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
      setBusy(true); try { const result = await save({ data: parsed.data }); await onSaved(); if (result.warnings.length) result.warnings.forEach(w => toast.warning(w, { duration: 10000 })); else toast.success(kind === 'transcript' ? 'Transcripción y minuta guardadas.' : 'Registro guardado.'); onClose(); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar.'); } finally { setBusy(false); }
    }}>
      <div className="space-y-1.5"><Label>Tipo</Label><Select value={kind} onValueChange={setKind}><SelectTrigger aria-label="Tipo de registro"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(RECORD_KINDS).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label htmlFor="record-title">Título *</Label><Input id="record-title" required maxLength={240} value={title} onChange={e => setTitle(e.target.value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="record-when">Fecha y hora (hora local)</Label><Input id="record-when" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></div><div className="space-y-1.5"><Label>Responsable</Label><Select value={responsible || 'unassigned'} onValueChange={v => setResponsible(v === 'unassigned' ? '' : v)}><SelectTrigger aria-label="Responsable del registro"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Sin asignar</SelectItem>{RESPONSIBLES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div></div>
      {kind === 'task' && <div className="space-y-1.5"><Label htmlFor="record-due">Vencimiento</Label><Input id="record-due" type="date" value={due} onChange={e => setDue(e.target.value)} /></div>}
      <div className="space-y-1.5"><Label htmlFor="record-content">{kind === 'transcript' ? 'Transcripción de la reunión' : 'Detalle / acuerdos'}</Label><Textarea id="record-content" rows={kind === 'transcript' ? 12 : 6} maxLength={100000} value={content} onChange={e => setContent(e.target.value)} /></div>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar registro</Button></div>
    </form>
  </DialogContent></Dialog>;
}