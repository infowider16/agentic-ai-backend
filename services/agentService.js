const Agent = require('../models/Agent');
const { invalidateAgentContext } = require('./agentContextCache');

async function createAgent(agentData) {
  const agent = await Agent.create(agentData);

  if (agent && agent.agent_id) {
    invalidateAgentContext(agent.agent_id);
  }

  return agent;
}

async function updateAgentById(agentId, updates) {
  const agent = await Agent.updateByAgentId(agentId, updates);

  if (agent && agent.agent_id) {
    invalidateAgentContext(agent.agent_id);
  }

  return agent;
}

module.exports = {
  createAgent,
  updateAgentById
};