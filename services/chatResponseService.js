const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const { buildAgentContext } = require('./agentContextCache');
const {
  OPENAI_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL
} = require('./agentContextUtils');

function sanitizeInlineText(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*•]\s+/g, '')
    .trim();
}

function findKnowledgeMatch(entries, message) {
  const normalizedMessage = message.toLowerCase();

  return entries.find(function(entry) {
    return normalizedMessage.includes(entry.key) || entry.value.toLowerCase().includes(normalizedMessage);
  });
}

function buildFallbackReply(agent, entries) {
  if (entries.length > 0) {
    return buildReplyPayload('Based on our info: ' + entries[0].value);
  }

  return buildReplyPayload('Hello, I am ' + agent.agent_name + '.\nHow can I help?');
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

function formatReplyText(text) {
  const normalized = String(text || '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  const rawLines = normalized
    .split('\n')
    .map(function(line) {
      return sanitizeInlineText(line);
    })
    .filter(Boolean);

  if (rawLines.length > 1) {
    return rawLines.join('\n');
  }

  return normalized
    .split(/(?<=[.!?])\s+/)
    .map(function(line) {
      return sanitizeInlineText(line);
    })
    .filter(Boolean)
    .join('\n');
}

function isLikelyCallToAction(line) {
  return /(contact|call|email|share|tell me|let me know|get started|reach out|send|book|discuss|budget|timeline|requirements|project)/i.test(line);
}

function buildReplyBlocks(text) {
  const formatted = formatReplyText(text);

  if (!formatted) {
    return {
      summary: '',
      bullets: [],
      cta: ''
    };
  }

  const lines = formatted
    .split('\n')
    .map(function(line) {
      return sanitizeInlineText(line);
    })
    .filter(Boolean);
  const summary = lines[0] || '';
  const remaining = lines.slice(1);
  let bullets = remaining;
  let cta = '';

  if (remaining.length && isLikelyCallToAction(remaining[remaining.length - 1])) {
    const lastLine = remaining[remaining.length - 1];
    cta = lastLine;
    bullets = remaining.slice(0, -1);
  }

  return {
    summary,
    bullets,
    cta
  };
}

function buildReplyPayload(text) {
  const replyText = formatReplyText(text);

  return {
    text: replyText,
    blocks: buildReplyBlocks(replyText)
  };
}

function buildImmediateReply(agentContext, message) {
  const agent = agentContext.agent;
  const match = findKnowledgeMatch(agentContext.knowledgeEntries, message);

  if (match) {
    return buildReplyPayload(match.value);
  }

  if (/\b(hello|hi|hey|namaste)\b/i.test(message)) {
    return buildReplyPayload('Hello, I am ' + agent.agent_name + '.\nHow can I help today?');
  }

  return null;
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
    contents: systemPrompt + '\n\nUser question: ' + message,
    config: {
      temperature: 0.2
    }
  });

  return extractReplyText(response && response.text);
}

async function requestProviderReply(agentContext, message) {
  if (!agentContext.apiKey) {
    return '';
  }

  if (agentContext.modelConfig.provider === 'openai') {
    return requestOpenAIReply(
      agentContext.apiKey,
      agentContext.modelConfig.model || OPENAI_DEFAULT_MODEL,
      agentContext.systemPrompt,
      message
    );
  }

  if (agentContext.modelConfig.provider === 'gemini') {
    return requestGeminiReply(
      agentContext.apiKey,
      agentContext.modelConfig.model || GEMINI_DEFAULT_MODEL,
      agentContext.systemPrompt,
      message
    );
  }

  const error = new Error('Unsupported AI provider for model_name: ' + (agentContext.agent.model_name || 'unknown'));
  error.statusCode = 400;
  throw error;
}

async function buildChatReply(params) {
  const agentContext = params.agentContext || buildAgentContext(params.agent);
  const agent = agentContext.agent;
  const message = params.message || '';
  const immediateReply = buildImmediateReply(agentContext, message);

  if (immediateReply) {
    return immediateReply;
  }

  try {
    const providerReply = await requestProviderReply(agentContext, message);

    if (providerReply) {
      return buildReplyPayload(providerReply);
    }
  } catch (error) {
    console.error('AI provider request failed:', error.message);
  }

  return buildFallbackReply(agent, agentContext.knowledgeEntries);
}

module.exports = {
  buildChatReply,
  buildReplyBlocks,
  formatReplyText
};
