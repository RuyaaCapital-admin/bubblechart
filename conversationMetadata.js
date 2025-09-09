export async function updateConversationMetadata({ conversationId, symbol, timeframe }) {
  if (!conversationId) return;
  try {
    await fetch('/functions/publicAgentConversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        metadata: { symbol, timeframe }
      })
    });
  } catch (err) {
    console.error('Failed to update conversation metadata', err);
  }
}
