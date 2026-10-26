import { STAFF_EMAILS, taskCalendarDates, taskEventId } from './crm';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { refreshAccessToken, cancelCalendarEvent } from './google.server';

export async function syncTrackingCalendar(id: string) {
  const { data: row, error } = await supabaseAdmin.from('crm_records').select('*, crm_clients(name, company, country)').eq('id', id).single();
  if (error || !row) throw new Error('No se pudo leer el pendiente.');
  const email = row.kind === 'task' && !row.completed_at ? STAFF_EMAILS[row.responsible] : undefined;
  const { data: target } = email ? await supabaseAdmin.from('profiles').select('id, google_refresh_token').eq('google_email', email).not('google_refresh_token', 'is', null).order('google_connected_at', { ascending: false }).limit(1).maybeSingle() : { data: null };
  // Remove the previous owner's event before a reassignment or task completion.
  if (row.calendar_event_id && row.calendar_profile_id && row.calendar_profile_id !== target?.id) {
    const { data: previous } = await supabaseAdmin.from('profiles').select('google_refresh_token').eq('id', row.calendar_profile_id).single();
    if (!previous?.google_refresh_token) throw new Error('Reconectá el calendario del responsable anterior para quitar el evento.');
    const token = await refreshAccessToken(previous.google_refresh_token);
    await cancelCalendarEvent({ accessToken: token.access_token, eventId: row.calendar_event_id });
    const cleared = await supabaseAdmin.from('crm_records').update({ calendar_event_id: null, calendar_profile_id: null }).eq('id', id);
    if (cleared.error) throw new Error('No se pudo registrar la cancelación del evento.');
  }
  if (!email) {
    await supabaseAdmin.from('crm_records').update({ calendar_status: 'none', calendar_error: null }).eq('id', id);
    return;
  }
  if (!target?.google_refresh_token) throw new Error(`${row.responsible} debe conectar su cuenta ${email} en Integraciones para recibir este pendiente en Google Calendar.`);
  const eventId = taskEventId(id, target.id);
  const prepared = await supabaseAdmin.from('crm_records').update({ calendar_event_id: eventId, calendar_profile_id: target.id, calendar_status: 'pending', calendar_error: null }).eq('id', id);
  if (prepared.error) throw new Error('No se pudo preparar el evento.');
  const token = await refreshAccessToken(target.google_refresh_token);
  const client = row.crm_clients;
  const body = { summary: `Pendiente · ${client?.company || client?.name || 'Cliente'} · ${row.title}`, description: [row.content, `Responsable: ${row.responsible}`, client?.country && `País: ${client.country}`].filter(Boolean).join('\n\n'), ...taskCalendarDates(row), reminders: { useDefault: true } };
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
  const init = { headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' } };
  let res = await fetch(`${url}/${eventId}`, { ...init, method: 'PATCH', body: JSON.stringify(body) });
  if (res.status === 404 || res.status === 410) {
    res = await fetch(url, { ...init, method: 'POST', body: JSON.stringify({ ...body, id: eventId }) });
    // Concurrent saves share a deterministic ID: update, never duplicate.
    if (res.status === 409) res = await fetch(`${url}/${eventId}`, { ...init, method: 'PATCH', body: JSON.stringify(body) });
  }
  if (!res.ok) throw new Error(`Google Calendar (${res.status}): no se pudo guardar el evento; revisá la conexión del responsable.`);
  const saved = await supabaseAdmin.from('crm_records').update({ calendar_status: 'synced', calendar_error: null }).eq('id', id);
  if (saved.error) throw new Error('El evento se creó pero no se pudo confirmar su estado; sincronizá nuevamente.');
}