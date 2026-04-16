const crypto = require('crypto');
const { listAgents, getAgentById, createAgent, updateAgentById, deleteAgentById } = require('../services/agentService');
const { generateKnowledgeBaseForUrl } = require('../services/knowledgeBaseService');

function normalizeWebsiteUrl(value) {
  const url = new URL(String(value || '').trim());

  if (!/^https?:$/i.test(url.protocol)) {
    throw new Error('Website URL must use http or https');
  }

  return url.toString();
}

function getDefaultAgentName(websiteUrl) {
  const hostname = new URL(websiteUrl).hostname.replace(/^www\./i, '');
  const label = hostname
    .split('.')
    .filter(Boolean)
    .map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');

  return (label || 'Website') + ' AI Assistant';
}

function resolveProviderName(modelName) {
  const normalizedModelName = String(modelName || '').trim().toLowerCase();

  if (normalizedModelName.startsWith('gemini')) {
    return 'gemini';
  }

  if (normalizedModelName.startsWith('gpt') || normalizedModelName.startsWith('o1') || normalizedModelName.startsWith('o3')) {
    return 'openai';
  }

  throw new Error('Unsupported model type. Use a Gemini or OpenAI model.');
}

function normalizeProviderName(providerName, modelName) {
  const normalizedProviderName = String(providerName || '').trim().toLowerCase();

  if (!normalizedProviderName || normalizedProviderName === 'auto') {
    return resolveProviderName(modelName);
  }

  if (normalizedProviderName === 'gemini' || normalizedProviderName === 'openai') {
    return normalizedProviderName;
  }

  throw new Error('Unsupported provider name. Use gemini, openai, or auto.');
}

function buildAgentId() {
  return 'AGENT_' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function buildScriptId() {
  return 'script_' + crypto.randomBytes(6).toString('hex');
}

function escapeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizePublicBaseUrl(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return '';
  }

  const url = new URL(rawValue);

  if (!/^https?:$/i.test(url.protocol)) {
    throw new Error('PUBLIC_BASE_URL must use http or https');
  }

  return url.toString().replace(/\/+$/, '');
}

function getApiBaseUrl(req) {
  const publicBaseUrl = normalizePublicBaseUrl(process.env.PUBLIC_BASE_URL);

  if (publicBaseUrl) {
    return publicBaseUrl;
  }

  return 'https://' + req.get('host');
}

function buildScriptTag(agent, req) {
  const apiBaseUrl = getApiBaseUrl(req);

  return '<script src="' + escapeHtmlAttribute(apiBaseUrl + '/widget.js') + '" data-agent-id="' + escapeHtmlAttribute(agent.agent_id) + '" data-agent-name="' + escapeHtmlAttribute(agent.agent_name) + '" data-api-base-url="' + escapeHtmlAttribute(apiBaseUrl) + '"></script>';
}

function resolveApiKeyState(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return {
      configured: false,
      readable: true,
      plaintext: true,
      unreadable: false,
      value: ''
    };
  }

  return {
    configured: true,
    readable: true,
    plaintext: true,
    unreadable: false,
    value: rawValue
  };
}

function toAgentResponse(agent, req) {
  const apiKeyState = resolveApiKeyState(agent.api_key);
  const knowledgeBaseSummary = summarizeKnowledgeBase(agent.knowledge_base);

  return {
    agent_id: agent.agent_id,
    agent_name: agent.agent_name,
    website_url: agent.website_url,
    provider_name: agent.provider_name,
    model_name: agent.model_name,
    script_id: agent.script_id,
    api_key_configured: apiKeyState.configured,
    api_key_readable: apiKeyState.readable,
    api_key_plaintext_legacy: apiKeyState.plaintext,
    api_key_unreadable: apiKeyState.unreadable,
    api_key_masked: buildMaskedApiKey(apiKeyState),
    knowledge_base_configured: knowledgeBaseSummary.configured,
    knowledge_base_items: knowledgeBaseSummary.itemCount,
    total_chats: Number(agent.total_chats || 0),
    script_tag: buildScriptTag(agent, req),
    created_at: agent.created_at,
    updated_at: agent.updated_at
  };
}

function buildMaskedApiKey(apiKeyState) {
  if (!apiKeyState || !apiKeyState.configured) {
    return 'Not configured';
  }

  if (!apiKeyState.readable) {
    return 'Configured (cannot decrypt)';
  }

  const apiKey = apiKeyState.value;
  const visibleSuffix = apiKey.slice(-4);
  return '••••••••' + visibleSuffix;
}

function summarizeKnowledgeBase(knowledgeBase) {
  if (!knowledgeBase) {
    return {
      configured: false,
      itemCount: 0
    };
  }

  let parsedKnowledgeBase = knowledgeBase;

  if (typeof parsedKnowledgeBase === 'string') {
    try {
      parsedKnowledgeBase = JSON.parse(parsedKnowledgeBase);
    } catch (error) {
      return {
        configured: true,
        itemCount: 0
      };
    }
  }

  if (Array.isArray(parsedKnowledgeBase)) {
    return {
      configured: parsedKnowledgeBase.length > 0,
      itemCount: parsedKnowledgeBase.length
    };
  }

  if (parsedKnowledgeBase && typeof parsedKnowledgeBase === 'object') {
    const itemCount = Object.keys(parsedKnowledgeBase).length;

    return {
      configured: itemCount > 0,
      itemCount
    };
  }

  return {
    configured: true,
    itemCount: 0
  };
}

function formatKnowledgeBaseForEdit(knowledgeBase) {
  if (!knowledgeBase) {
    return '';
  }

  if (typeof knowledgeBase !== 'string') {
    return JSON.stringify(knowledgeBase, null, 2);
  }

  try {
    return JSON.stringify(JSON.parse(knowledgeBase), null, 2);
  } catch (error) {
    return knowledgeBase;
  }
}

function toAgentDetailResponse(agent, req) {
  return Object.assign({}, toAgentResponse(agent, req), {
    knowledge_base: formatKnowledgeBaseForEdit(agent.knowledge_base)
  });
}

async function getAgents(req, res) {
  try {
    const agents = await listAgents();

    return res.json({
      agents: agents.map(function(agent) {
        return toAgentResponse(agent, req);
      })
    });
  } catch (error) {
    console.error('List agents error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to load agents' });
  }
}

async function getAgent(req, res) {
  const agentId = String(req.params.agentId || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'agentId is required' });
  }

  try {
    const agent = await getAgentById(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json({
      agent: toAgentDetailResponse(agent, req)
    });
  } catch (error) {
    console.error('Get agent error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to load agent' });
  }
}

async function postAgent(req, res) {
  const websiteUrlInput = String(req.body.website_url || '').trim();
  const modelName = String(req.body.model_name || '').trim();
  const apiKey = String(req.body.api_key || '').trim();
  const agentNameInput = String(req.body.agent_name || '').trim();

  if (!websiteUrlInput || !modelName || !apiKey) {
    return res.status(400).json({ error: 'website_url, model_name, and api_key are required' });
  }

  try {
    const websiteUrl = normalizeWebsiteUrl(websiteUrlInput);
    const providerName = normalizeProviderName(req.body.provider_name, modelName);
    const agentName = agentNameInput || getDefaultAgentName(websiteUrl);
    const agentId = buildAgentId();
    const knowledgeBaseResult = await generateKnowledgeBaseForUrl(websiteUrl, {
      cleanupOutputDir: true
    });
    const agent = await createAgent({
      agent_id: agentId,
      agent_name: agentName,
      website_url: websiteUrl,
      provider_name: providerName,
      api_key: apiKey,
      model_name: modelName,
      knowledge_base: knowledgeBaseResult.knowledgeBase,
      script_id: buildScriptId()
    });

    return res.status(201).json({
      message: 'Agent created successfully',
      agent: toAgentResponse(agent, req),
      knowledge_base: {
        page_count: knowledgeBaseResult.pageCount,
        processed_pages: knowledgeBaseResult.processedPages,
        failed_pages: knowledgeBaseResult.failedPages,
        chunk_count: knowledgeBaseResult.chunkCount
      }
    });
  } catch (error) {
    console.error('Create agent error:', error.message);

    if (/website url must use http or https|unsupported model type|unsupported provider name/i.test(String(error.message || ''))) {
      return res.status(400).json({ error: error.message });
    }

    if (/duplicate|unique|er_dup_entry/i.test(String(error.message || ''))) {
      return res.status(409).json({ error: 'Agent could not be created because a generated identifier already exists. Please retry.' });
    }

    if (/valid http or https start url|html page/i.test(String(error.message || ''))) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: error.message || 'Failed to create agent' });
  }
}

async function putAgent(req, res) {
  const agentId = String(req.params.agentId || '').trim();
  const updates = {};

  if (!agentId) {
    return res.status(400).json({ error: 'agentId is required' });
  }

  try {
    if (req.body.agent_name !== undefined) {
      updates.agent_name = String(req.body.agent_name || '').trim();
    }

    if (req.body.website_url !== undefined) {
      updates.website_url = normalizeWebsiteUrl(req.body.website_url);
    }

    if (req.body.model_name !== undefined) {
      const modelName = String(req.body.model_name || '').trim();

      if (!modelName) {
        return res.status(400).json({ error: 'model_name cannot be empty' });
      }

      updates.model_name = modelName;
      updates.provider_name = normalizeProviderName(req.body.provider_name, modelName);
    } else if (req.body.provider_name !== undefined) {
      const existingAgent = await getAgentById(agentId);

      if (!existingAgent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      updates.provider_name = normalizeProviderName(req.body.provider_name, existingAgent.model_name);
    }

    if (req.body.api_key !== undefined) {
      const apiKey = String(req.body.api_key || '').trim();

      if (apiKey) {
        updates.api_key = apiKey;
      }
    }

    if (req.body.knowledge_base !== undefined) {
      const knowledgeBaseValue = String(req.body.knowledge_base || '').trim();

      if (knowledgeBaseValue) {
        JSON.parse(knowledgeBaseValue);
      }

      updates.knowledge_base = knowledgeBaseValue || null;
    }

    const updatedAgent = await updateAgentById(agentId, updates);

    if (!updatedAgent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json({
      message: 'Agent updated successfully',
      agent: toAgentResponse(updatedAgent, req)
    });
  } catch (error) {
    console.error('Update agent error:', error.message);

    if (/website url must use http or https|unsupported model type|unsupported provider name/i.test(String(error.message || ''))) {
      return res.status(400).json({ error: error.message });
    }

    if (/unexpected token|json/i.test(String(error.message || ''))) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: error.message || 'Failed to update agent' });
  }
}

async function getAgentApiKey(req, res) {
  const agentId = String(req.params.agentId || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'agentId is required' });
  }

  try {
    const agents = await listAgents();
    const agent = agents.find(function(entry) {
      return entry.agent_id === agentId;
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const apiKeyState = resolveApiKeyState(agent.api_key);

    return res.json({
      agent_id: agent.agent_id,
      api_key: apiKeyState.value,
      api_key_readable: apiKeyState.readable,
      api_key_plaintext_legacy: apiKeyState.plaintext,
      api_key_unreadable: apiKeyState.unreadable,
      message: apiKeyState.unreadable
        ? 'Saved API key exists, but it cannot be decrypted with the current ENCRYPTION_SECRET.'
        : ''
    });
  } catch (error) {
    console.error('Get agent api key error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to load API key' });
  }
}

async function deleteAgent(req, res) {
  const agentId = String(req.params.agentId || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'agentId is required' });
  }

  try {
    const result = await deleteAgentById(agentId);

    if (!result) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json({
      message: 'Agent deleted successfully',
      agent_id: agentId,
      deleted_lead_submissions: Number(result.deleted_lead_submissions || 0)
    });
  } catch (error) {
    console.error('Delete agent error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to delete agent' });
  }
}

module.exports = {
  getAgents,
  getAgent,
  postAgent,
  putAgent,
  getAgentApiKey,
  deleteAgent
};