/**
 * update-agent-kb.js
 * Updates the knowledge base for a specific agent in the DB using a local JSON file.
 *
 * Usage:
 *   node scripts/update-agent-kb.js <AGENT_ID> <PATH_TO_KB_JSON>
 *
 * Example:
 *   node scripts/update-agent-kb.js AGENT_EF94371D ai_knowledge_base_new.json
 */

const path = require('path');
const fs = require('fs');
const pool = require('../db');

async function main() {
  const agentId = process.argv[2];
  const kbFilePath = process.argv[3];

  if (!agentId || !kbFilePath) {
    console.error('Usage: node scripts/update-agent-kb.js <AGENT_ID> <PATH_TO_KB_JSON>');
    process.exit(1);
  }

  const resolvedPath = path.isAbsolute(kbFilePath)
    ? kbFilePath
    : path.resolve(process.cwd(), kbFilePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error('File not found:', resolvedPath);
    process.exit(1);
  }

  let kbData;
  try {
    kbData = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse JSON file:', err.message);
    process.exit(1);
  }

  const [rows] = await pool.query('SELECT agent_id, agent_name FROM agents WHERE agent_id = ?', [agentId]);
  if (!rows || rows.length === 0) {
    console.error('Agent not found:', agentId);
    await pool.end();
    process.exit(1);
  }

  const agent = rows[0];
  console.log(`Updating knowledge base for agent: ${agent.agent_name} (${agent.agent_id})`);
  console.log(`KB file: ${resolvedPath}`);
  console.log(`Entries: ${Array.isArray(kbData) ? kbData.length : 'object'}`);

  await pool.query('UPDATE agents SET knowledge_base = ? WHERE agent_id = ?', [
    JSON.stringify(kbData),
    agentId
  ]);

  console.log('Knowledge base updated successfully for agent:', agentId);
  console.log('NOTE: Restart the server (or wait ~5 minutes) to clear the in-memory agent cache.');
  await pool.end();
}

main().catch(function(err) {
  console.error('Error:', err.message);
  process.exit(1);
});
