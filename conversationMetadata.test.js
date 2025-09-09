// deno-lint-ignore-file
import test from 'node:test';
import assert from 'node:assert/strict';
import { updateConversationMetadata } from './conversationMetadata.js';

test('updateConversationMetadata posts correct payload', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true };
  };
  await updateConversationMetadata({ conversationId: '123', symbol: 'BTCUSD', timeframe: '1h' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/functions/publicAgentConversations');
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body, {
    conversation_id: '123',
    metadata: { symbol: 'BTCUSD', timeframe: '1h' }
  });
});
