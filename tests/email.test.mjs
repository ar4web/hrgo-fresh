// Email helpers — pure parts of the mailbox page (unread count, outbox parse).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('email helpers', () => {
  it('counts unread seed messages', async () => {
    const m = await import('../src/components/email-helpers.js');
    assert.equal(m.unreadCount([{ read: false }, { read: true }, {}]), 2);
  });

  it('falls back to empty outbox on corrupt JSON', async () => {
    const m = await import('../src/components/email-helpers.js');
    assert.deepEqual(m.parseOutbox('not-json{{{'), []);
    assert.deepEqual(m.parseOutbox(JSON.stringify([{ id: 'a' }])), [{ id: 'a' }]);
  });
});
