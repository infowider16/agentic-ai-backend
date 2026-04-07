const { getAgentContext } = require('../services/agentContextCache');
const { buildChatReply } = require('../services/chatResponseService');

async function postChat(req, res) {
  const { agent_id: agentId, message } = req.body;

  if (!agentId || !message) {
    return res.status(400).json({ error: 'agent_id and message required' });
  }

  try {
    const agentContext = await getAgentContext(agentId);

    if (!agentContext) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const reply = await buildChatReply({
      agentContext,
      message
    });

    return res.json({
      agent_id: agentContext.agent.agent_id,
      agent_name: agentContext.agent.agent_name,
      reply: reply.text,
      reply_blocks: reply.blocks
    });
  } catch (error) {
    console.error('Chat controller error:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
  }
}

module.exports = {
  postChat
};
