const pool = require('../db');

const Agent = {
  async findByAgentId(agentId) {
    const [rows] = await pool.query('SELECT * FROM agents WHERE agent_id = ?', [agentId]);
    return rows[0];
  },
  async create(agentData) {
    const fields = [
      'agent_id',
      'agent_name',
      'website_url',
      'provider_name',
      'api_key',
      'model_name',
      'knowledge_base',
      'script_id'
    ];
    const values = fields.map(function(field) {
      return agentData[field] !== undefined ? agentData[field] : null;
    });

    await pool.query(
      'INSERT INTO agents (agent_id, agent_name, website_url, provider_name, api_key, model_name, knowledge_base, script_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      values
    );

    return this.findByAgentId(agentData.agent_id);
  },
  async updateByAgentId(agentId, updates) {
    const allowedFields = [
      'agent_name',
      'website_url',
      'provider_name',
      'api_key',
      'model_name',
      'knowledge_base',
      'script_id'
    ];
    const assignments = [];
    const values = [];

    allowedFields.forEach(function(field) {
      if (updates[field] !== undefined) {
        assignments.push(field + ' = ?');
        values.push(updates[field]);
      }
    });

    if (assignments.length === 0) {
      return this.findByAgentId(agentId);
    }

    values.push(agentId);

    await pool.query(
      'UPDATE agents SET ' + assignments.join(', ') + ' WHERE agent_id = ?',
      values
    );

    return this.findByAgentId(agentId);
  },
  // Add more model methods as needed
};

module.exports = Agent;
