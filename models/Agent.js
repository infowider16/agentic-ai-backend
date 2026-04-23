const pool = require('../db');
const LeadSubmission = require('./LeadSubmission');

const Agent = {
  async findAll() {
    const [rows] = await pool.query(
      'SELECT * FROM agents ORDER BY created_at DESC, id DESC'
    );

    return rows;
  },
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
      'script_id',
      'client_secret_key'
    ];
    const values = fields.map(function(field) {
      return agentData[field] !== undefined ? agentData[field] : null;
    });


    await pool.query(
      'INSERT INTO agents (agent_id, agent_name, website_url, provider_name, api_key, model_name, knowledge_base, script_id, client_secret_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
      'script_id',
      'client_secret_key'
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
  async deleteByAgentId(agentId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existingAgent = await this.findByAgentId(agentId);

      if (!existingAgent) {
        await connection.rollback();
        return null;
      }

      const deletedLeadCount = await LeadSubmission.deleteByAgentId(agentId, connection);
      const [result] = await connection.query('DELETE FROM agents WHERE agent_id = ?', [agentId]);

      await connection.commit();

      return {
        agent_id: agentId,
        deleted: result.affectedRows > 0,
        deleted_lead_submissions: deletedLeadCount
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  // Add more model methods as needed
};

module.exports = Agent;
