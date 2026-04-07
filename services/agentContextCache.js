const Agent = require('../models/Agent');
const {
  safeParseKnowledgeBase,
  flattenKnowledgeBase,
  getAgentApiKey,
  resolveModelConfig,
  buildSystemPrompt
} = require('./agentContextUtils');

const agentContextCache = new Map();
const CACHE_TTL_MS = Number(process.env.AGENT_CACHE_TTL_MS || 5 * 60 * 1000);

function getCacheKey(agentId) {
  return String(agentId || '').trim();
}

function isCacheEntryFresh(entry) {
  return Boolean(entry && entry.expiresAt > Date.now());
}

function buildAgentContext(agent) {
  const knowledgeBase = safeParseKnowledgeBase(agent.knowledge_base);
  const knowledgeEntries = [];
  const apiKey = getAgentApiKey(agent);

  flattenKnowledgeBase(knowledgeBase, knowledgeEntries);

  return {
    agent,
    knowledgeBase,
    knowledgeEntries,
    apiKey,
    modelConfig: resolveModelConfig(agent, apiKey),
    systemPrompt: buildSystemPrompt(agent, knowledgeBase)
  };
}

async function getAgentContext(agentId) {
  const cacheKey = getCacheKey(agentId);
  const cachedEntry = agentContextCache.get(cacheKey);

  if (isCacheEntryFresh(cachedEntry)) {
    return cachedEntry.value;
  }

  if (cachedEntry) {
    agentContextCache.delete(cacheKey);
  }

  const agent = await Agent.findByAgentId(agentId);

  if (!agent) {
    return null;
  }

  const context = buildAgentContext(agent);

  agentContextCache.set(cacheKey, {
    value: context,
    expiresAt: Date.now() + CACHE_TTL_MS
  });

  return context;
}

function invalidateAgentContext(agentId) {
  agentContextCache.delete(getCacheKey(agentId));
}

module.exports = {
  buildAgentContext,
  getAgentContext,
  invalidateAgentContext
};