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

  if (normalizedMessage.length > 2000) {
    return res.status(400).json({ error: 'Message is too long. Please keep it under 2000 characters.' });
  }

  try {
    // Fetch agent to get client_secret_key
    const agent = await Agent.findByAgentId(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    let userContext = null;

    console.log('Received token:', token, 'length:', token ? token.length : 0);
    console.log('Agent client_secret_key:', agent.client_secret_key);
    if (token && agent.client_secret_key) {
      try {
        userContext = verifyUserToken(token, agent.client_secret_key);
        if (!userContext) {
          console.error('JWT verification failed: verifyUserToken returned null');
        } else {
          console.log('Decoded userContext:', userContext);
        }
      } catch (e) {
        console.error('JWT verify error (exception):', e);
      }
    } else {
      console.error('Token or client_secret_key missing for JWT verification');
    }
    console.log('userContext:', userContext);



    // Prepare user context for prompt
    let userPromptContext = '';
    if (userContext && userContext.user_name) {
      const contextLines = [];

      contextLines.push(`You are talking to ${userContext.user_name}.`);

      if (userContext.role) {
        contextLines.push(`Their role on this platform is: ${userContext.role}.`);
      }

      if (userContext.subscription_plan) {
        contextLines.push(`Their active subscription plan is: ${userContext.subscription_plan}.`);
      }

      if (userContext.plan_amount) {
        contextLines.push(`Their personal billing amount for this plan is: ${userContext.plan_amount}. Note: this is their specific billing amount and may differ from the standard list price shown on the plans page.`);
      }

      if (userContext.plan_start_date && userContext.plan_end_date) {
        contextLines.push(`Plan start date: ${userContext.plan_start_date}. Plan end date: ${userContext.plan_end_date}.`);
      } else if (userContext.plan_start_date) {
        contextLines.push(`Plan start date: ${userContext.plan_start_date}.`);
      } else if (userContext.plan_end_date) {
        contextLines.push(`Plan end date: ${userContext.plan_end_date}.`);
      }

      if (Array.isArray(userContext.saved_aircraft) && userContext.saved_aircraft.length > 0) {
        const aircraftList = userContext.saved_aircraft
          .map(function(a) {
            return String((a.manufacturer || '') + ' ' + (a.model || '')).trim();
          })
          .filter(Boolean)
          .join(', ');
        if (aircraftList) {
          contextLines.push(`Saved aircraft profiles: ${aircraftList}.`);
        }
      }

      contextLines.push(`Use this information to give personalized answers about their plan, cancellation, saved aircraft, and calculations. When answering about the user's billing cost use their plan_amount. When answering about standard list prices use the knowledge base plan pricing.`);
      userPromptContext = contextLines.join(' ');
    } else {
      userPromptContext = `You are talking to a Guest User. Personalize your answers accordingly.`;
    }

    // Get agent context
    const cachedAgentContext = await getAgentContext(agentId);
    if (!cachedAgentContext) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agentContext = Object.assign({}, cachedAgentContext, {
      userContextPrompt: userPromptContext
    });

    console.log('Final systemPrompt:', agentContext.systemPrompt);

    const reply = await buildChatReply({
      agentContext,
      userContext,
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
