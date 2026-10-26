import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { clientSchema, recordSchema } from './crm';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

async function assertAdmin(sb: SupabaseClient<Database>, userId: string) {
  const { data, error } = await sb.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (error || !data) throw new Error('Solo los superadministradores pueden gestionar clientes.');
}

async function processRecord(sb: SupabaseClient<Database>, id: string, minutes: boolean) {
  const warnings: string[] = [];
  if (minutes) {
    try { const { generateTrackingMinutes } = await import('./crm-minutes.server'); await generateTrackingMinutes(id); }
    catch (e) {
      const message = e instanceof Error ? e.message.slice(0, 500) : 'No se pudo generar la minuta.';
      await sb.from('crm_records').update({ minutes_status: 'error', minutes_error: message }).eq('id', id);
      warnings.push(`Transcripción guardada, pero la minuta no pudo generarse: ${message}`);
    }
  }
  try { const { syncTrackingCalendar } = await import('./crm-calendar.server'); await syncTrackingCalendar(id); }
  catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo sincronizar Calendar.';
    await sb.from('crm_records').update({ calendar_status: 'error', calendar_error: message }).eq('id', id);
    warnings.push(`Registro guardado. ${message}`);
  }
  return { ok: true, warnings };
}

export const getClientTracking = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.supabase, context.userId);
  // Demos belong to platform operations, not the caller's recruiting organization.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const [clients, records, meetings] = await Promise.all([
    context.supabase.from('crm_clients').select('*').order('updated_at', { ascending: false }),
    context.supabase.from('crm_records').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('demo_bookings').select('id, crm_client_id, first_name, last_name, email, status, meet_link, demo_slots(start_at, end_at)').not('crm_client_id', 'is', null).order('created_at', { ascending: false }),
  ]);
  if (clients.error || records.error || meetings.error) throw new Error('No se pudo cargar el seguimiento. Intentá nuevamente.');
  return { clients: clients.data ?? [], records: records.data ?? [], meetings: meetings.data ?? [] };
});

export const saveTrackingClient = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => clientSchema.parse(v)).handler(async ({ context, data }) => {
  await assertAdmin(context.supabase, context.userId);
  const { id, ...values } = data;
  const row = { ...values, updated_at: new Date().toISOString() };
  const result = id ? await context.supabase.from('crm_clients').update(row).eq('id', id).select('id').single()
    : await context.supabase.from('crm_clients').insert(row).select('id').single();
  if (result.error?.code === '23505') throw new Error('Ya existe un contacto con ese email. Buscalo en la lista.');
  if (result.error) throw new Error('No se pudo guardar el cliente.');
  return result.data;
});

export const saveTrackingRecord = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => recordSchema.parse(v)).handler(async ({ context, data }) => {
  await assertAdmin(context.supabase, context.userId);
  const { id, ...values } = data;
  const row = { ...values, updated_at: new Date().toISOString() };
  const { data: previous } = id ? await context.supabase.from('crm_records').select('content, kind').eq('id', id).single() : { data: null };
  const needsMinutes = data.kind === 'transcript' && (!previous || previous.content !== data.content || previous.kind !== 'transcript');
  const changes = needsMinutes ? { ...row, minutes: '', minutes_status: 'pending', minutes_error: null } : row;
  const result = id ? await context.supabase.from('crm_records').update(changes).eq('id', id).eq('client_id', data.client_id).select('id').single()
    : await context.supabase.from('crm_records').insert({ ...changes, created_by: context.userId }).select('id').single();
  if (result.error) throw new Error('No se pudo guardar el registro.');
  return processRecord(context.supabase, result.data.id, needsMinutes);
});

export const completeTrackingTask = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ id: z.string().uuid(), completed: z.boolean() }).parse(v)).handler(async ({ context, data }) => {
  await assertAdmin(context.supabase, context.userId);
  const { error } = await context.supabase.from('crm_records').update({ completed_at: data.completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', data.id).eq('kind', 'task').select('id').single();
  if (error) throw new Error('No se pudo actualizar el pendiente.');
  return processRecord(context.supabase, data.id, false);
});

export const deleteTrackingRecord = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v)).handler(async ({ context, data }) => {
  await assertAdmin(context.supabase, context.userId);
  const { data: row } = await context.supabase.from('crm_records').select('calendar_event_id, calendar_profile_id').eq('id', data.id).single();
  if (row?.calendar_event_id && row.calendar_profile_id) {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: profile } = await supabaseAdmin.from('profiles').select('google_refresh_token').eq('id', row.calendar_profile_id).single();
    if (!profile?.google_refresh_token) throw new Error('Reconectá el calendario del responsable antes de eliminar el pendiente.');
    const { refreshAccessToken, cancelCalendarEvent } = await import('./google.server');
    const token = await refreshAccessToken(profile.google_refresh_token);
    await cancelCalendarEvent({ accessToken: token.access_token, eventId: row.calendar_event_id });
  }
  const { error } = await context.supabase.from('crm_records').delete().eq('id', data.id);
  if (error) throw new Error('No se pudo eliminar el registro.');
  return { ok: true };
});

export const retryTrackingRecord = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ id: z.string().uuid(), action: z.enum(['minutes', 'calendar']) }).parse(v)).handler(async ({ context, data }) => {
  await assertAdmin(context.supabase, context.userId);
  const { data: row, error } = await context.supabase.from('crm_records').select('id').eq('id', data.id).single();
  if (error || !row) throw new Error('Registro no encontrado.');
  return processRecord(context.supabase, data.id, data.action === 'minutes');
});