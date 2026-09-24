import { test, describe } from 'node:test';
import assert from 'node:assert';
import { StorageService } from '../server/storage.js';

describe('StorageService Session Management', () => {
  const storage = new StorageService();

  test('createSession supports customId', () => {
    const customId = `custom_sess_${Date.now()}`;
    const sess = storage.createSession('Custom Title', customId);
    assert.strictEqual(sess.id, customId);
    assert.strictEqual(sess.title, 'Custom Title');
    assert.deepStrictEqual(sess.messages, []);

    const retrieved = storage.getSession(customId);
    assert.strictEqual(retrieved.id, customId);
  });

  test('createSession generates id if customId is null/undefined', () => {
    const sess = storage.createSession('Auto Title');
    assert.ok(sess.id.startsWith('sess_'));
    assert.strictEqual(sess.title, 'Auto Title');
  });

  test('getOrCreateSession returns existing session if found', () => {
    const customId = `existing_sess_${Date.now()}`;
    const created = storage.createSession('Initial Title', customId);
    const existing = storage.getOrCreateSession(customId, 'Should Not Overwrite');
    assert.strictEqual(existing.id, customId);
    assert.strictEqual(existing.title, 'Initial Title');
  });

  test('getOrCreateSession creates new session if not found', () => {
    const newId = `brand_new_sess_${Date.now()}`;
    const sess = storage.getOrCreateSession(newId, 'Brand New Session');
    assert.strictEqual(sess.id, newId);
    assert.strictEqual(sess.title, 'Brand New Session');
    assert.deepStrictEqual(sess.messages, []);

    // Check that it's unshifted and in storage
    const retrieved = storage.getSession(newId);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.id, newId);

    // Clean up
    storage.deleteSession(newId);
  });
});
