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

  return String(agent.api_key).trim();
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

    `Your job is to help visitors of the website by answering their questions based ONLY on the provided knowledge base.`,

    `IMPORTANT RULES:`,

    `1. You must only answer using the information from the knowledge base context provided below.`,
    `2. Do NOT use your own knowledge or make up information.`,
    `3. If the answer is not present in the knowledge base, say politely that the information is not available.`,
    `4. Keep answers short, clear, and conversational like a human support agent.`,
    `5. If the user greets you (hi, hello, hey), respond with a friendly greeting and ask how you can help.`,
    `6. Use the conversation history to understand follow-up questions.`,
    `7. If the user asks something unclear but related to the business, ask one clarifying question.`,

    `OUT OF SCOPE RULE:`,

    `If the user asks something unrelated to ${agent.website_url} or the knowledge base, reply politely: 
    "I'm sorry, I can only assist with questions related to ${agent.website_url}."`,

    `LEAD FORM RULE:`,

    `If the user asks for pricing, requests a quote, asks to contact support, wants to speak with a human, or requests a callback, respond normally and then append the exact token below on a new line at the very end of your reply.`,

    `Only use this token when the user clearly shows intent to start a business enquiry or contact the company. Do NOT use it during normal informational conversation.`,

    `[LEAD_FORM]`,

    `KNOWLEDGE BASE:`,

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