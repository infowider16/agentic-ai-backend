const Agent = require('../models/Agent');
const { buildChatReply } = require('../services/chatResponseService');

async function postChat(req, res) {
  const { agent_id: agentId, message } = req.body;

  if (!agentId || !message) {
    return res.status(400).json({ error: 'agent_id and message required' });
  }

  try {
    const agent = await Agent.findByAgentId(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const reply = await buildChatReply({
      agent,
      message
    });

    return res.json({
      agent_id: agent.agent_id,
      agent_name: agent.agent_name,
      reply
    });
  } catch (error) {
    console.error('Chat controller error:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
  }
}

module.exports = {
  postChat
};
