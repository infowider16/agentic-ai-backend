const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const { buildAgentContext } = require('./agentContextCache');
const {
  buildSystemPrompt,
  extractKnowledgeDocuments,
  filterDocumentsByAccess,
  OPENAI_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  selectRelevantKnowledgeDocuments
} = require('./agentContextUtils');

const MAX_HISTORY_ITEMS = Number(process.env.CHAT_HISTORY_LIMIT || 20);

function sanitizeInlineText(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*•]\s+/g, '')
    .trim();
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMeaningfulTokens(text) {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'about', 'can', 'do', 'for', 'from', 'give', 'hello', 'help', 'hey',
    'hi', 'i', 'is', 'it', 'know', 'me', 'means', 'more', 'need', 'of', 'on', 'please', 'service',
    'services', 'tell', 'the', 'to', 'want', 'what', 'with', 'you', 'your'
  ]);

  return normalizeText(text)
    .split(' ')
    .filter(function(token) {
      return token.length >= 3 && !stopWords.has(token);
    });
}

function findKnowledgeMatch(entries, message) {
  const normalizedMessage = normalizeText(message);
  const messageTokens = getMeaningfulTokens(message);
  let bestMatch = null;
  let bestScore = 0;

  entries.forEach(function(entry) {
    const normalizedKey = normalizeText(entry.key);
    const normalizedValue = normalizeText(entry.value);
    let score = 0;

    if (normalizedMessage && normalizedKey && normalizedMessage.includes(normalizedKey)) {
      score += normalizedKey.split(' ').length + 3;
    }

    if (normalizedMessage.length >= 12 && normalizedValue.includes(normalizedMessage)) {
      score += 4;
    }

    messageTokens.forEach(function(token) {
      if (normalizedKey.split(' ').includes(token)) {
        score += 2;
      } else if (normalizedValue.includes(token)) {
        score += 1;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  });

  return bestScore >= 2 ? bestMatch : null;
}

function isDirectKnowledgeMatch(match, message) {
  const normalizedMessage = normalizeText(message);

  if (!match || !normalizedMessage) {
    return false;
  }

  const normalizedKey = normalizeText(match.key);
  const normalizedValue = normalizeText(match.value);

  if (normalizedKey && (normalizedKey === normalizedMessage || normalizedKey.includes(normalizedMessage))) {
    return true;
  }

  if (normalizedMessage.length >= 12 && normalizedValue.includes(normalizedMessage)) {
    return true;
  }

  return false;
}

function buildFallbackReply(message, match) {
  if (isDirectKnowledgeMatch(match, message)) {
    return buildReplyPayload(match.value);
  }

  if (/\b(hello|hi|hey|namaste|good morning|good afternoon|good evening)\b/i.test(message)) {
    return buildReplyPayload('Sorry, I could not process that right now. Please try again in a moment.');
  }

  return buildReplyPayload('Sorry, I could not process that right now. Please try again in a moment.');
}

function splitIntoSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map(function(sentence) {
      return sentence.trim();
    })
    .filter(Boolean);
}

function buildDocumentFallbackReply(document) {
  if (!document || (!document.content && !document.summary)) {
    return buildReplyPayload('Sorry, I could not process that right now. Please try again in a moment.');
  }

  const sentences = splitIntoSentences(document.content || document.summary);
  const summaryText = sentences.slice(0, 3).join(' ').trim() || String(document.content || document.summary || '').trim();

  return buildReplyPayload(summaryText);
}

function isUnavailableReply(text) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return false;
  }

  return [
    'information not available',
    'not available in the current knowledge base',
    'not available in the knowledge base',
    'i do not have information',
    'i dont have information',
    'i do not have enough information',
    'i dont have enough information',
    'i do not have the information',
    'i dont have the information',
    'do not have that information',
    'dont have that information',
    'do not have information about',
    'dont have information about',
    'cannot find that information',
    'could not find that information'
  ].some(function(pattern) {
    return normalizedText.includes(pattern);
  });
}

function normalizeHistoryEntries(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map(function(entry) {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const role = entry.role === 'assistant' ? 'assistant' : entry.role === 'user' ? 'user' : '';
      const content = String(entry.content || '').trim();

      if (!role || !content) {
        return null;
      }

      return {
        role,
        content
      };
    })
    .filter(Boolean)
    .slice(-MAX_HISTORY_ITEMS);
}

function appendCurrentMessage(history, message) {
  const normalizedHistory = normalizeHistoryEntries(history);
  const normalizedMessage = String(message || '').trim();

  if (!normalizedMessage) {
    return normalizedHistory;
  }

  const lastEntry = normalizedHistory[normalizedHistory.length - 1];

  if (!lastEntry || lastEntry.role !== 'user' || lastEntry.content !== normalizedMessage) {
    normalizedHistory.push({
      role: 'user',
      content: normalizedMessage
    });
  }

  return normalizedHistory.slice(-MAX_HISTORY_ITEMS);
}

function buildOpenAIMessages(systemPrompt, history) {
  const messages = [
    {
      role: 'system',
      content: systemPrompt
    }
  ];

  history.forEach(function(entry) {
    messages.push({
      role: entry.role,
      content: entry.content
    });
  });

  return messages;
}

function buildGeminiContents(history) {
  return history.map(function(entry) {
    return {
      role: entry.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text: entry.content
        }
      ]
    };
  });
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

function extractLeadFormFlag(text) {
  const marker = '[LEAD_FORM]';
  const idx = String(text || '').indexOf(marker);

  if (idx === -1) {
    return { cleanText: String(text || ''), triggerLeadForm: false };
  }

  return {
    cleanText: String(text || '').slice(0, idx).trim(),
    triggerLeadForm: true
  };
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
  const bullets = lines.slice(1);

  return {
    summary,
    bullets,
    cta: ''
  };
}

function buildReplyPayload(text) {
  const { cleanText, triggerLeadForm } = extractLeadFormFlag(text);
  const replyText = formatReplyText(cleanText);

  return {
    text: replyText,
    blocks: buildReplyBlocks(replyText),
    trigger_lead_form: triggerLeadForm
  };
}

function hasAvailableProvider(agentContext) {
  return Boolean(agentContext.apiKey && agentContext.modelConfig && agentContext.modelConfig.provider);
}

async function requestOpenAIReply(apiKey, model, systemPrompt, history) {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: buildOpenAIMessages(systemPrompt, history)
  });

  return extractReplyText(completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content);
}

async function requestGeminiReply(apiKey, model, systemPrompt, history) {
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: buildGeminiContents(history),
    config: {
      temperature: 0.2,
      systemInstruction: systemPrompt
    }
  });

  return extractReplyText(response && response.text);
}

async function requestProviderReply(agentContext, history) {
  if (!agentContext.apiKey) {
    return '';
  }

  if (agentContext.modelConfig.provider === 'openai') {
    return requestOpenAIReply(
      agentContext.apiKey,
      agentContext.modelConfig.model || OPENAI_DEFAULT_MODEL,
      agentContext.systemPrompt,
      history
    );
  }

  if (agentContext.modelConfig.provider === 'gemini') {
    return requestGeminiReply(
      agentContext.apiKey,
      agentContext.modelConfig.model || GEMINI_DEFAULT_MODEL,
      agentContext.systemPrompt,
      history
    );
  }

  const error = new Error('Unsupported AI provider for model_name: ' + (agentContext.agent.model_name || 'unknown'));
  error.statusCode = 400;
  throw error;
}

async function buildChatReply(params) {

  const agentContext = params.agentContext || buildAgentContext(params.agent);
  const message = params.message || '';
  const userContext = params.userContext || null;
  const history = appendCurrentMessage(params.history, message);
  const knowledgeMatch = findKnowledgeMatch(agentContext.knowledgeEntries, message);
  const knowledgeDocuments = Array.isArray(agentContext.knowledgeDocuments) && agentContext.knowledgeDocuments.length > 0
    ? agentContext.knowledgeDocuments
    : extractKnowledgeDocuments(agentContext.knowledgeBase);
  const accessFilteredDocuments = filterDocumentsByAccess(knowledgeDocuments, userContext);
  const relevantDocuments = selectRelevantKnowledgeDocuments(accessFilteredDocuments, message, history);

  // Use userContextPrompt if present, else default system prompt
  let scopedSystemPrompt = '';
  if (agentContext.userContextPrompt) {
    scopedSystemPrompt = agentContext.userContextPrompt + '\n' + buildSystemPrompt(agentContext.agent, agentContext.knowledgeBase, { relevantDocuments });
  } else {
    scopedSystemPrompt = buildSystemPrompt(agentContext.agent, agentContext.knowledgeBase, { relevantDocuments });
  }

  if (hasAvailableProvider(agentContext)) {
    try {
      const providerReply = await requestProviderReply(
        Object.assign({}, agentContext, {
          systemPrompt: scopedSystemPrompt
        }),
        history
      );

      if (providerReply) {
        if (isUnavailableReply(providerReply) && relevantDocuments.length > 0) {
          return buildDocumentFallbackReply(relevantDocuments[0]);
        }

        return buildReplyPayload(providerReply);
      }
    } catch (error) {
      console.error('AI provider request failed:', error.message);
    }
  }

  if (relevantDocuments.length > 0) {
    return buildDocumentFallbackReply(relevantDocuments[0]);
  }

  return buildFallbackReply(message, knowledgeMatch);
}

module.exports = {
  buildChatReply,
  buildReplyBlocks,
  formatReplyText
};
