const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
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

function findKnowledgeMatch(entries, message) {
  const normalizedMessage = message.toLowerCase();

  return entries.find(function(entry) {
    return normalizedMessage.includes(entry.key) || entry.value.toLowerCase().includes(normalizedMessage);
  });
}

function buildFallbackReply(agent, entries) {
  if (entries.length > 0) {
    return 'I am ' + agent.agent_name + ' for ' + agent.website_url + '. Here is something from the knowledge base: ' + entries[0].value;
  }

  return 'Hello, I am ' + agent.agent_name + ' for ' + agent.website_url + '. How can I help you?';
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

function extractReplyText(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map(extractReplyText).filter(Boolean).join(' ').trim();
  }

  if (typeof value === 'object') {
    if (typeof value.text === 'string') {
      return value.text.trim();
    }

    if (Array.isArray(value.parts)) {
      return extractReplyText(value.parts);
    }
  }

  return '';
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

async function requestOpenAIReply(apiKey, model, systemPrompt, message) {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: message
      }
    ]
  });

  return extractReplyText(completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content);
}

async function requestGeminiReply(apiKey, model, systemPrompt, message) {
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: systemPrompt + '\n\nUser question: ' + message
  });

  return extractReplyText(response && response.text);
}

function buildSystemPrompt(agent, knowledgeBase) {
  return [
    'You are ' + agent.agent_name + ', the website assistant for ' + agent.website_url + '.',
    'Use the provided knowledge base as the primary source of truth when answering.',
    'If the answer is not available in the knowledge base, say you do not have that information instead of inventing facts.',
    'Keep the answer concise, helpful, and suitable for website visitors.',
    'Knowledge base:',
    buildKnowledgeContext(knowledgeBase)
  ].join('\n\n');
}

async function requestProviderReply(agent, knowledgeBase, message) {
  const apiKey = getAgentApiKey(agent);

  if (!apiKey) {
    return '';
  }

  const modelConfig = resolveModelConfig(agent, apiKey);
  const systemPrompt = buildSystemPrompt(agent, knowledgeBase);

  if (modelConfig.provider === 'openai') {
    return requestOpenAIReply(apiKey, modelConfig.model || OPENAI_DEFAULT_MODEL, systemPrompt, message);
  }

  if (modelConfig.provider === 'gemini') {
    return requestGeminiReply(apiKey, modelConfig.model || GEMINI_DEFAULT_MODEL, systemPrompt, message);
  }

  const error = new Error('Unsupported AI provider for model_name: ' + (agent.model_name || 'unknown'));
  error.statusCode = 400;
  throw error;
}

async function buildChatReply(params) {
  const agent = params.agent;
  const message = params.message || '';
  const knowledgeBase = safeParseKnowledgeBase(agent.knowledge_base);
  const knowledgeEntries = [];

  flattenKnowledgeBase(knowledgeBase, knowledgeEntries);

  try {
    const providerReply = await requestProviderReply(agent, knowledgeBase, message);

    if (providerReply) {
      return providerReply;
    }
  } catch (error) {
    console.error('AI provider request failed:', error.message);
  }

  const match = findKnowledgeMatch(knowledgeEntries, message);

  if (match) {
    return 'According to our knowledge base, ' + match.value;
  }

  if (/\b(hello|hi|hey|namaste)\b/i.test(message)) {
    return 'Hello, I am ' + agent.agent_name + '. How can I help you today?';
  }

  return buildFallbackReply(agent, knowledgeEntries);
}

module.exports = {
  buildChatReply
};
