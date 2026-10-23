import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { trackingStatus, buenosAiresToday, clientSchema } from './crm';

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
});