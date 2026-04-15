const Agent = require('../models/Agent');
const { invalidateAgentContext } = require('./agentContextCache');

async function listAgents() {
  return Agent.findAll();
}

async function getAgentById(agentId) {
  return Agent.findByAgentId(agentId);
}

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

async function deleteAgentById(agentId) {
  const result = await Agent.deleteByAgentId(agentId);

  if (result && result.agent_id) {
    invalidateAgentContext(result.agent_id);
  }

  return result;
}

module.exports = {
  listAgents,
  getAgentById,
  createAgent,
  updateAgentById,
  deleteAgentById
};