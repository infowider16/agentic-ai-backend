const express = require('express');
const router = express.Router();
const { getAgents, getAgent, postAgent, putAgent, getAgentApiKey, deleteAgent } = require('../controllers/agentController');

router.get('/', getAgents);
router.get('/:agentId', getAgent);
router.post('/', postAgent);
router.put('/:agentId', putAgent);
router.delete('/:agentId', deleteAgent);
router.get('/:agentId/api-key', getAgentApiKey);

module.exports = router;