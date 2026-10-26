import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { trackingStatus, buenosAiresToday, clientSchema, recordSchema, STAFF_EMAILS, taskCalendarDates, taskEventId } from './crm';

describe('client tracking', () => {
  it('completed tasks do not count as pending', () => {
    assert.deepEqual(trackingStatus([{ kind: 'task', completed_at: '2026-10-23T12:00:00Z', due_date: '2026-10-22' }], '2026-10-23'), { pending: 0, overdue: 0, label: 'Al día' });
  });
  it('only unfinished tasks before today are overdue', () => {
    const rows = ['2026-10-22', '2026-10-23', null].map(due_date => ({ kind: 'task', completed_at: null, due_date }));
    assert.deepEqual(trackingStatus(rows, '2026-10-23'), { pending: 3, overdue: 1, label: 'Atrasado' });
    assert.equal(trackingStatus([{ kind: 'meeting', completed_at: null, due_date: '2026-10-22' }], '2026-10-23').pending, 0);
  });
  it('day boundaries use Buenos Aires', () => {
    assert.equal(buenosAiresToday(new Date('2026-10-24T01:00:00Z')), '2026-10-23');
  });
  it('normalizes contact emails to match demo prospects', () => {
    assert.equal(clientSchema.parse({ name: 'Contacto', company: '', email: ' CONTACTO@EXAMPLE.COM ', phone: '', stage: 'prospect', owner_name: '', summary: '' }).email, 'contacto@example.com');
  });
  it('stores country independently of client summary', () => {
    assert.equal(clientSchema.parse({ name: 'Contacto', company: '', email: '', phone: '', stage: 'prospect', owner_name: '', summary: '', country: ' Argentina ' }).country, 'Argentina');
  });
  it('maps only the two staff responsibles to their own calendars', () => {
    assert.equal(STAFF_EMAILS['Florencia Barrios'], 'fbarrios@fluxtalent.com.ar');
    assert.equal(STAFF_EMAILS['Carla Cominicini'], 'ccomincini@fluxtalent.com.ar');
    assert.equal(STAFF_EMAILS.Cliente, undefined);
  });
  it('requires a date for staff pending tasks and rejects other responsibles', () => {
    const row = { client_id: '11111111-1111-4111-8111-111111111111', kind: 'task', title: 'Llamar', content: '', occurs_at: null, due_date: null, responsible: 'Florencia Barrios' };
    assert.equal(recordSchema.safeParse(row).success, false);
    assert.equal(recordSchema.safeParse({ ...row, due_date: '2026-10-27' }).success, true);
    assert.equal(recordSchema.safeParse({ ...row, responsible: 'Otro' }).success, false);
  });
  it('date-only task events use an exclusive end date and stable IDs', () => {
    assert.deepEqual(taskCalendarDates({ occurs_at: null, due_date: '2026-10-31' }), { start: { date: '2026-10-31' }, end: { date: '2026-11-01' } });
    assert.equal(taskEventId('a-b', 'c-d'), 'crmabcd');
  });
  it('requires transcript text before generating minutes', () => {
    assert.equal(recordSchema.safeParse({ client_id: '11111111-1111-4111-8111-111111111111', kind: 'transcript', title: 'Demo', content: '', occurs_at: null, due_date: null, responsible: 'Cliente' }).success, false);
  });
});