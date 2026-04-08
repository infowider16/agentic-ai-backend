const { decrypt } = require('../utils/encrypt');

const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
const GEMINI_DEFAULT_MODEL = process.env.GEMINI_DEFAULT_MODEL || process.env.GEMINI_TEST_MODEL || 'gemini-2.0-flash';

function safeParseKnowledgeBase(knowledgeBase) {
  if (!knowledgeBase) {
    return {};
  }

  if (typeof knowledgeBase === 'object') {
    return knowledgeBase;
  }

  try {
    return JSON.parse(knowledgeBase);
  } catch (error) {
    return {};
  }
}

function flattenKnowledgeBase(value, items, prefix = '') {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach(function(entry, index) {
      flattenKnowledgeBase(entry, items, prefix ? prefix + ' ' + (index + 1) : String(index + 1));
    });
    return;
  }

  if (typeof value === 'object') {
    Object.keys(value).forEach(function(key) {
      const nextPrefix = prefix ? prefix + ' ' + key : key;
      flattenKnowledgeBase(value[key], items, nextPrefix);
    });
    return;
  }

  items.push({
    key: String(prefix || 'info').toLowerCase(),
    value: String(value)
  });
}

function buildKnowledgeContext(knowledgeBase) {
  const serializedKnowledge = JSON.stringify(knowledgeBase, null, 2);

  if (!serializedKnowledge || serializedKnowledge === '{}') {
    return 'No knowledge base was provided.';
  }

  if (serializedKnowledge.length <= 12000) {
    return serializedKnowledge;
  }

  return serializedKnowledge.slice(0, 12000) + '\n...\n[Knowledge base truncated]';
}

function getAgentApiKey(agent) {
  if (!agent.api_key) {
    return '';
  }

  try {
    return decrypt(agent.api_key);
  } catch (error) {
    return String(agent.api_key).trim();
  }
}

function resolveModelConfig(agent, apiKey) {
  const rawProvider = String(agent.provider_name || '').trim();
  const normalizedProvider = rawProvider.toLowerCase();
  const rawModel = String(agent.model_name || '').trim();
  const normalizedModel = rawModel.toLowerCase();
  const normalizedKey = String(apiKey || '').trim().toLowerCase();

  if (normalizedProvider === 'openai') {
    return {
      provider: 'openai',
      model: rawModel || OPENAI_DEFAULT_MODEL
    };
  }

  if (normalizedProvider === 'gemini' || normalizedProvider === 'google') {
    return {
      provider: 'gemini',
      model: rawModel || GEMINI_DEFAULT_MODEL
    };
  }

  if (normalizedModel === 'openai' || normalizedModel === 'chatgpt') {
    return {
      provider: 'openai',
      model: OPENAI_DEFAULT_MODEL
    };
  }

  if (normalizedModel === 'gemini' || normalizedModel === 'google') {
    return {
      provider: 'gemini',
      model: GEMINI_DEFAULT_MODEL
    };
  }

  if (normalizedModel.includes('gemini')) {
    return {
      provider: 'gemini',
      model: rawModel
    };
  }

  if (
    normalizedModel.includes('gpt') ||
    normalizedModel.startsWith('o1') ||
    normalizedModel.startsWith('o3') ||
    normalizedModel.startsWith('text-embedding')
  ) {
    return {
      provider: 'openai',
      model: rawModel
    };
  }

  if (normalizedKey.startsWith('aiza')) {
    return {
      provider: 'gemini',
      model: rawModel || GEMINI_DEFAULT_MODEL
    };
  }

  if (normalizedKey.startsWith('sk-')) {
    return {
      provider: 'openai',
      model: rawModel || OPENAI_DEFAULT_MODEL
    };
  }

  return {
    provider: '',
    model: rawModel
  };
}

function buildSystemPrompt(agent, knowledgeBase) {
  return [
    `You are ${agent.agent_name}, the AI assistant for ${agent.website_url}.`,
    `Answer naturally and use the knowledge base when it is relevant to the user's question.`,
    `If the requested information is not available in the knowledge base, say that clearly instead of inventing details.`,
    `Do not force a greeting, bullet list, call to action, or any fixed response structure unless it genuinely fits the answer.`,
    `Knowledge base context:`,
    buildKnowledgeContext(knowledgeBase)
  ].join('\n\n');
}

module.exports = {
  OPENAI_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  safeParseKnowledgeBase,
  flattenKnowledgeBase,
  buildKnowledgeContext,
  getAgentApiKey,
  resolveModelConfig,
  buildSystemPrompt
};