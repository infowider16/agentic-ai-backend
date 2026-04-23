const { getAgentContext } = require('../services/agentContextCache');
const { buildChatReply } = require('../services/chatResponseService');
const Agent = require('../models/Agent');
const { verifyUserToken } = require('../services/jwtUtils');

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
  const { agent_id: agentId, message, history, session_id: sessionId, conversation_id: conversationId, token } = req.body;
  const normalizedMessage = String(message || '').trim();
  const normalizedHistory = normalizeHistory(history);

  if (!agentId || !normalizedMessage) {
    return res.status(400).json({ error: 'agent_id and message required' });
  }

  try {
    // Fetch agent to get client_secret_key
    const agent = await Agent.findByAgentId(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    let userContext = null;
    if (token && agent.client_secret_key) {
      userContext = verifyUserToken(token, agent.client_secret_key);
    }

    // Prepare user context for prompt
    let userPromptContext = '';
    if (userContext && userContext.user_name && userContext.role) {
      userPromptContext = `You are talking to ${userContext.user_name} who is an ${userContext.role} on this platform. Use this information to personalize your answers.`;
    } else {
      userPromptContext = `You are talking to a Guest User. Personalize your answers accordingly.`;
    }

    // Get agent context and inject userPromptContext into system prompt
    const agentContext = await getAgentContext(agentId);
    if (!agentContext) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Inject userPromptContext at the start of the system prompt
    agentContext.systemPrompt = `${userPromptContext}\n\n${agentContext.systemPrompt}`;

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
