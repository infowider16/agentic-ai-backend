const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const { buildAgentContext } = require('./agentContextCache');
const {
  OPENAI_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL
} = require('./agentContextUtils');

const MAX_REPLY_LINES = 3;
const MAX_REPLY_CHARS = 280;
const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_CHAT_MAX_TOKENS || 120);
const GEMINI_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_CHAT_MAX_OUTPUT_TOKENS || 120);

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

function truncateLine(line, maxChars) {
  if (line.length <= maxChars) {
    return line;
  }

  return line.slice(0, maxChars - 3).trim() + '...';
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

  let lines = rawLines;

  if (rawLines.length <= 1) {
    lines = normalized
      .split(/(?<=[.!?])\s+/)
      .map(function(line) {
        return sanitizeInlineText(line);
      })
      .filter(Boolean);
  }

  const limitedLines = lines.slice(0, MAX_REPLY_LINES);
  const lineBudget = Math.max(60, Math.floor(MAX_REPLY_CHARS / Math.max(1, limitedLines.length)));
  const formatted = limitedLines.map(function(line) {
    return truncateLine(line, lineBudget);
  }).join('\n');

  return truncateLine(formatted, MAX_REPLY_CHARS);
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

  if (remaining.length > 1 || (remaining.length === 1 && isLikelyCallToAction(remaining[0]))) {
    const lastLine = remaining[remaining.length - 1];

    if (isLikelyCallToAction(lastLine) || remaining.length > 1) {
      cta = lastLine;
      bullets = remaining.slice(0, -1);
    }
  }

  return {
    summary,
    bullets: bullets.slice(0, 2),
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
    max_tokens: OPENAI_MAX_TOKENS,
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
      temperature: 0.2,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS
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
