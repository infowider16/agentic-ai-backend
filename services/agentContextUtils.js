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
  const providerName = String(agent.provider_name || '').trim().toLowerCase();
  const modelName = String(agent.model_name || '').trim().toLowerCase();

  if (!agent.api_key) {
    if (providerName === 'gemini' || providerName === 'google' || modelName.includes('gemini')) {
      return String(process.env.GEMINI_API_KEY || '').trim();
    }

    if (providerName === 'openai' || modelName.includes('gpt') || modelName.startsWith('o1') || modelName.startsWith('o3')) {
      return String(process.env.OPENAI_API_KEY || '').trim();
    }

    return String(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
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
    `Your knowledge is strictly limited to the provided knowledge base context.`,
    `Respond like a helpful human support assistant: be conversational, concise, and relevant to the user's message.`,
    `If the user only greets you or starts the conversation casually, reply with a short greeting and ask what they need help with. Do not immediately dump company information.`,
    `Use the conversation history provided with the request to keep continuity. Interpret short confirmations such as yes, no, okay, sure, or continue in the context of the assistant's immediately previous question, and do not restart the conversation unless the user clearly changes topic.`,
    `If the user's request seems related to the business but is ambiguous, ask one short clarifying question before saying the topic is unavailable.`,
    `If the answer exists in the knowledge base, answer naturally using only that context. Do not add facts that are not present.`,
    `If a user asks something clearly outside the knowledge base or outside ${agent.website_url}, politely say: "I'm sorry, I don't have information about that. I can only assist with questions related to ${agent.website_url}."`,
    `Do not use your own internal knowledge to answer outside the provided context.`,
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