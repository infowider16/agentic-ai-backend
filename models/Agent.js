const pool = require('../db');

const Agent = {
  async findById(agentId) {
    const [rows] = await pool.query('SELECT * FROM agents WHERE id = ?', [agentId]);
    return rows[0];
  },
  // Add more model methods as needed
};

module.exports = Agent;
