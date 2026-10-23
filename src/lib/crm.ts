import { z } from 'zod';

export const CLIENT_STAGES = { prospect: 'Prospecto', contacted: 'En conversación', proposal: 'Propuesta enviada', client: 'Cliente', paused: 'En pausa', lost: 'No avanza' } as const;
export const RECORD_KINDS = { note: 'Nota', meeting: 'Reunión', transcript: 'Transcripción', event: 'Evento clave', task: 'Pendiente' } as const;
export const clientSchema = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(1, 'Completá el nombre.').max(160),
  company: z.string().trim().max(160), email: z.union([z.string().trim().email('Revisá el email.').max(254), z.literal('')]).transform(v => v.toLowerCase()),
  phone: z.string().trim().max(60), stage: z.enum(['prospect', 'contacted', 'proposal', 'client', 'paused', 'lost']),
  owner_name: z.string().trim().max(160), summary: z.string().trim().max(20000),
});
export const recordSchema = z.object({
  id: z.string().uuid().optional(), client_id: z.string().uuid(), kind: z.enum(['note', 'meeting', 'transcript', 'event', 'task']),
  title: z.string().trim().min(1, 'Completá el título.').max(240), content: z.string().trim().max(100000),
  occurs_at: z.string().datetime().nullable(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  responsible: z.string().trim().max(160),
});
export function trackingStatus(tasks: { kind: string; completed_at: string | null; due_date: string | null }[], today: string) {
  const pending = tasks.filter(t => t.kind === 'task' && !t.completed_at);
  const overdue = pending.filter(t => t.due_date && t.due_date < today).length;
  return { pending: pending.length, overdue, label: overdue ? 'Atrasado' : pending.length ? 'Pendientes' : 'Al día' };
}
export function buenosAiresToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}