const LeadSubmission = require('../models/LeadSubmission');

const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

async function postLead(req, res) {
  const { agent_id, full_name, work_email, phone_number, question, trigger_reason } = req.body;

  const normalizedAgentId = String(agent_id || '').trim();
  const normalizedName = String(full_name || '').trim();
  const normalizedEmail = String(work_email || '').trim().toLowerCase();
  const normalizedPhone = String(phone_number || '').trim() || null;
  const normalizedQuestion = String(question || '').trim();
  const normalizedTrigger = String(trigger_reason || '').trim() || null;

  if (!normalizedAgentId || !normalizedName || !normalizedEmail || !normalizedQuestion) {
    return res.status(400).json({ error: 'agent_id, full_name, work_email, and question are required' });
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const submission = await LeadSubmission.create({
      agent_id: normalizedAgentId,
      full_name: normalizedName,
      work_email: normalizedEmail,
      phone_number: normalizedPhone,
      question: normalizedQuestion,
      trigger_reason: normalizedTrigger
    });

    return res.status(201).json({ success: true, id: submission.id });
  } catch (error) {
    console.error('Lead submission error:', error.message);
    return res.status(500).json({ error: 'Failed to save lead' });
  }
}

module.exports = { postLead };
