const express = require('express');
const router = express.Router();
const { postKnowledgeBaseCrawl } = require('../controllers/knowledgeBaseController');

router.post('/crawl', postKnowledgeBaseCrawl);

module.exports = router;