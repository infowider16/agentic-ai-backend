const express = require('express');
const router = express.Router();
const { postChat } = require('../controllers/chatController');

// In-memory rate limiter: max 20 requests per IP per minute
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;

function chatRateLimit(req, res, next) {
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return next();
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many messages. Please wait a moment before sending more.' });
  }

  next();
}

// POST /api/chat
router.post('/', chatRateLimit, postChat);

module.exports = router;
