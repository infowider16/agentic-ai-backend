const express = require('express');
const router = express.Router();
const { postChat } = require('../controllers/chatController');

// POST /api/chat
router.post('/', postChat);

module.exports = router;
