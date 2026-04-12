const express = require('express');
const router = express.Router();
const { postLead } = require('../controllers/leadController');

// POST /api/leads
router.post('/', postLead);

module.exports = router;
