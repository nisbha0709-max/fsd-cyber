const { generateSuggestion } = require('../services/aiAssistant');
const Incident = require('../models/Incident');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// GET /api/ai/suggest/:id – returns AI‑generated insight for an incident
exports.suggest = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.id);
  if (!incident) throw new ApiError(404, 'Incident not found');

  const suggestion = await generateSuggestion(incident);
  res.json({ success: true, suggestion });
});
