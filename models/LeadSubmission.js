const pool = require('../db');

const LeadSubmission = {
  async create(submission) {
    const values = [
      submission.agent_id,
      submission.full_name,
      submission.work_email,
      submission.phone_number || null,
      submission.question,
      submission.trigger_reason || null
    ];
    const [result] = await pool.query(
      'INSERT INTO lead_submissions (agent_id, full_name, work_email, phone_number, question, trigger_reason) VALUES (?, ?, ?, ?, ?, ?)',
      values
    );

    return {
      id: result.insertId,
      ...submission
    };
  },
  async deleteByAgentId(agentId, connection = pool) {
    const [result] = await connection.query(
      'DELETE FROM lead_submissions WHERE agent_id = ?',
      [agentId]
    );

    return result.affectedRows || 0;
  }
};

module.exports = LeadSubmission;