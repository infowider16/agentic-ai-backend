const { getAgentContext } = require('../services/agentContextCache');
const { buildChatReply } = require('../services/chatResponseService');

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map(function(entry) {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const role = entry.role === 'assistant' ? 'assistant' : entry.role === 'user' ? 'user' : '';
      const content = String(entry.content || '').trim();

      if (!role || !content) {
        return null;
      }

      return {
        role,
        content
      };
    })
    .filter(Boolean)
    .slice(-20);
}

function normalizeIdentifier(value) {
  const normalizedValue = String(value || '').trim();

  return normalizedValue || undefined;
}

async function postChat(req, res) {
  const { agent_id: agentId, message, history, session_id: sessionId, conversation_id: conversationId } = req.body;
  const normalizedMessage = String(message || '').trim();
  const normalizedHistory = normalizeHistory(history);

  if (!agentId || !normalizedMessage) {
    return res.status(400).json({ error: 'agent_id and message required' });
  }

  try {
    const agentContext = await getAgentContext(agentId);

    if (!agentContext) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const reply = await buildChatReply({
      agentContext,
      message: normalizedMessage,
      history: normalizedHistory,
      sessionId: normalizeIdentifier(sessionId),
      conversationId: normalizeIdentifier(conversationId)
    });

    return res.json({
      agent_id: agentContext.agent.agent_id,
      agent_name: agentContext.agent.agent_name,
      reply: reply.text,
      reply_blocks: reply.blocks,
      trigger_lead_form: reply.trigger_lead_form || false,
      session_id: normalizeIdentifier(sessionId),
      conversation_id: normalizeIdentifier(conversationId)
    });
  } catch (error) {
    console.error('Chat controller error:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
  }
}

module.exports = {
  postChat
};
