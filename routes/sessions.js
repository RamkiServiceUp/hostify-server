const express = require('express');
const router = express.Router();
const { Session } = require('../models/Room');

// End a session
router.put('/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;
    const session = await Session.findByIdAndUpdate(sessionId, updates, { new: true });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to end session', details: err.message });
  }
});

module.exports = router;
