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

function buildChatReply(params) {
  const agent = params.agent;
  const message = params.message || '';
  const knowledgeBase = safeParseKnowledgeBase(agent.knowledge_base);
  const knowledgeEntries = [];

  flattenKnowledgeBase(knowledgeBase, knowledgeEntries);

  const match = findKnowledgeMatch(knowledgeEntries, message);

  if (match) {
    return 'According to our knowledge base, ' + match.value;
  }

  if (/hello|hi|hey|namaste/i.test(message)) {
    return 'Hello, I am ' + agent.agent_name + '. How can I help you today?';
  }

  return buildFallbackReply(agent, knowledgeEntries);
}

module.exports = {
  buildChatReply
};
