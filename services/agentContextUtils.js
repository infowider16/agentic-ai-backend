const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
const GEMINI_DEFAULT_MODEL = process.env.GEMINI_DEFAULT_MODEL || process.env.GEMINI_TEST_MODEL || 'gemini-2.0-flash';
const MAX_SCOPED_KNOWLEDGE_DOCS = Number(process.env.MAX_SCOPED_KNOWLEDGE_DOCS || 6);
const MAX_SCOPED_KNOWLEDGE_CHARS = Number(process.env.MAX_SCOPED_KNOWLEDGE_CHARS || 12000);

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

function normalizeSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearchText(text) {
  return normalizeSearchText(text)
    .split(' ')
    .filter(function(token) {
      return token.length >= 3;
    });
}

function buildExpandedSearchTokens(message) {
  const normalizedMessage = normalizeSearchText(message);
  const tokenSet = new Set(tokenizeSearchText(message));

  if (
    normalizedMessage.includes('terms and conditions') ||
    normalizedMessage.includes('term and condition') ||
    normalizedMessage.includes('terms of service') ||
    normalizedMessage.includes('terms of services') ||
    tokenSet.has('terms') ||
    tokenSet.has('term') ||
    tokenSet.has('conditions') ||
    tokenSet.has('condition') ||
    (tokenSet.has('terms') && tokenSet.has('service')) ||
    (tokenSet.has('terms') && tokenSet.has('services'))
  ) {
    ['terms', 'term', 'conditions', 'condition', 'service', 'services', 'liability', 'disclaimer', 'legal'].forEach(function(token) {
      tokenSet.add(token);
    });
  }

  if (
    tokenSet.has('privacy') ||
    tokenSet.has('policy') ||
    tokenSet.has('policies') ||
    tokenSet.has('poicy')
  ) {
    ['privacy', 'policy', 'policies', 'poicy', 'data', 'security'].forEach(function(token) {
      tokenSet.add(token);
    });
  }

  if (tokenSet.has('refund') || tokenSet.has('billing') || tokenSet.has('subscription')) {
    ['billing', 'subscription', 'payments', 'cancel'].forEach(function(token) {
      tokenSet.add(token);
    });
  }

  return Array.from(tokenSet);
}

function extractKnowledgeDocuments(knowledgeBase) {
  if (Array.isArray(knowledgeBase)) {
    const chunkDocuments = knowledgeBase
      .map(function(entry, index) {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};
        const title = String(metadata.page_title || entry.title || entry.id || 'Knowledge Base').trim();
        const sectionTitle = String(metadata.section_title || '').trim();
        const content = String(entry.content || '').trim();
        const summary = String(metadata.summary || '').trim();
        const keywords = Array.isArray(metadata.keywords) ? metadata.keywords.map(String) : [];
        const sourceUrl = String(metadata.source_url || '').trim();
        const searchableText = [
          title,
          sectionTitle,
          summary,
          keywords.join(' '),
          content,
          sourceUrl,
          String(entry.id || '')
        ].join(' ').trim();

        if (!searchableText) {
          return null;
        }

        return {
          id: String(entry.id || 'knowledge-doc-' + (index + 1)),
          title,
          sectionTitle,
          summary,
          content,
          sourceUrl,
          keywords,
          searchableText,
          contentType: String(metadata.content_type || 'general_page').trim()
        };
      })
      .filter(Boolean);

    if (chunkDocuments.length > 0) {
      return chunkDocuments;
    }
  }

  const flattenedEntries = [];
  flattenKnowledgeBase(knowledgeBase, flattenedEntries);

  return flattenedEntries.map(function(entry, index) {
    const value = String(entry.value || '').trim();

    return {
      id: 'knowledge-entry-' + (index + 1),
      title: String(entry.key || 'Knowledge Base').trim(),
      sectionTitle: '',
      summary: value.slice(0, 240),
      content: value,
      sourceUrl: '',
      keywords: tokenizeSearchText(entry.key),
      searchableText: [entry.key, value].join(' ').trim(),
      contentType: 'general_page'
    };
  }).filter(function(document) {
    return Boolean(document.searchableText);
  });
}

function selectRelevantKnowledgeDocuments(documents, message, history) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  const normalizedMessage = normalizeSearchText(message);
  const expandedTokens = buildExpandedSearchTokens(message);
  const recentHistory = Array.isArray(history)
    ? history.slice(-4).map(function(entry) {
        return entry && entry.content ? String(entry.content) : '';
      }).join(' ')
    : '';
  const historyTokens = tokenizeSearchText(recentHistory);

  const rankedDocuments = documents
    .map(function(document) {
      const titleText = normalizeSearchText([document.title, document.sectionTitle].join(' '));
      const summaryText = normalizeSearchText(document.summary);
      const contentText = normalizeSearchText(document.content);
      const searchableText = normalizeSearchText(document.searchableText);
      const keywordSet = new Set((document.keywords || []).map(function(keyword) {
        return normalizeSearchText(keyword);
      }).filter(Boolean));
      let score = 0;

      if (normalizedMessage && titleText && (titleText.includes(normalizedMessage) || normalizedMessage.includes(titleText))) {
        score += 12;
      }

      expandedTokens.forEach(function(token) {
        if (keywordSet.has(token)) {
          score += 6;
          return;
        }

        if (titleText.includes(token)) {
          score += 5;
          return;
        }

        if (summaryText.includes(token)) {
          score += 3;
          return;
        }

        if (contentText.includes(token) || searchableText.includes(token)) {
          score += 2;
        }
      });

      historyTokens.forEach(function(token) {
        if (titleText.includes(token) || keywordSet.has(token)) {
          score += 1;
        }
      });

      if ((expandedTokens.includes('terms') || expandedTokens.includes('conditions') || expandedTokens.includes('service') || expandedTokens.includes('services')) && /terms|conditions|service|services|liability|disclaimer/.test(searchableText)) {
        score += 8;
      }

      if ((expandedTokens.includes('privacy') || expandedTokens.includes('policy')) && /privacy|policy|data|security/.test(searchableText)) {
        score += 8;
      }

      return {
        document,
        score
      };
    })
    .filter(function(entry) {
      return entry.score > 0;
    })
    .sort(function(left, right) {
      return right.score - left.score;
    });

  return rankedDocuments.slice(0, MAX_SCOPED_KNOWLEDGE_DOCS).map(function(entry) {
    return entry.document;
  });
}

function buildRelevantKnowledgeContext(relevantDocuments) {
  if (!Array.isArray(relevantDocuments) || relevantDocuments.length === 0) {
    return 'No relevant knowledge base context was found for this question.';
  }

  let totalChars = 0;
  const contextSections = [];

  relevantDocuments.some(function(document, index) {
    const section = [
      'Document ' + (index + 1) + ':',
      'Title: ' + (document.title || 'Knowledge Base'),
      document.sectionTitle ? 'Section: ' + document.sectionTitle : '',
      document.sourceUrl ? 'Source URL: ' + document.sourceUrl : '',
      document.summary ? 'Summary: ' + document.summary : '',
      'Content: ' + String(document.content || '').trim()
    ].filter(Boolean).join('\n');

    if (totalChars >= MAX_SCOPED_KNOWLEDGE_CHARS) {
      return true;
    }

    const remainingChars = MAX_SCOPED_KNOWLEDGE_CHARS - totalChars;
    const nextSection = section.length > remainingChars
      ? section.slice(0, Math.max(0, remainingChars - 30)).trim() + '\n[Context truncated]'
      : section;

    contextSections.push(nextSection);
    totalChars += nextSection.length + 2;

    return totalChars >= MAX_SCOPED_KNOWLEDGE_CHARS;
  });

  return contextSections.join('\n\n');
}

function buildKnowledgeContext(knowledgeBase, options = {}) {
  if (Array.isArray(options.relevantDocuments)) {
    return buildRelevantKnowledgeContext(options.relevantDocuments);
  }

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

function buildSystemPrompt(agent, knowledgeBase, options = {}) {
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
    `8. Questions about terms and conditions, privacy policy, security, billing, refunds, subscriptions, legal disclaimers, or data usage are in scope when that information exists in the knowledge base. Answer those questions normally from the knowledge base and do not refuse just because the topic mentions privacy, security, policy, or legal terms.`,
    `9. If the knowledge base contains policy or legal text, you may summarize it in simple language, but do not add anything that is not supported by the knowledge base.`,

    `OUT OF SCOPE RULE:`,

    `If the user asks something unrelated to ${agent.website_url} or the knowledge base, reply politely: 
    "I'm sorry, I can only assist with questions related to ${agent.website_url}."`,

    `LEAD FORM RULE:`,

    `If the user asks for pricing, requests a quote, asks to contact support, wants to speak with a human, or requests a callback, respond normally and then append the exact token below on a new line at the very end of your reply.`,

    `Only use this token when the user clearly shows intent to start a business enquiry or contact the company. Do NOT use it during normal informational conversation.`,

    `[LEAD_FORM]`,

    options.userPromptContext ? `USER CONTEXT:\n${options.userPromptContext}` : null,

    `KNOWLEDGE BASE:`,

    buildKnowledgeContext(knowledgeBase, options)

  ].filter(Boolean).join('\n\n');
}

module.exports = {
  OPENAI_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  safeParseKnowledgeBase,
  flattenKnowledgeBase,
  extractKnowledgeDocuments,
  selectRelevantKnowledgeDocuments,
  buildKnowledgeContext,
  getAgentApiKey,
  resolveModelConfig,
  buildSystemPrompt
};