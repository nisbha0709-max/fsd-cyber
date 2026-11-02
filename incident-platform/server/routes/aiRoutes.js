const router = require('express').Router();
const { generateSuggestion } = require('../services/aiAssistant');
const Incident = require('../models/Incident');

/**
 * GET /suggest/:incidentId
 * Returns AI generated suggestion for the given incident.
 */
router.get('/suggest/:incidentId', async (req, res) => {
  try {
    const { incidentId } = req.params;
    const incident = await Incident.findById(incidentId).lean();
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }
    const suggestion = await generateSuggestion(incident);
    res.json({ success: true, suggestion });
  } catch (err) {
    console.error('AI route error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
