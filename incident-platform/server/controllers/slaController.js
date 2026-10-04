const SlaRule = require("../models/SlaRule");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { SEVERITIES } = require("../utils/constants");
const { oneOf } = require("../utils/validate");

// GET /api/sla
exports.listRules = asyncHandler(async (req, res) => {
  const rules = await SlaRule.find();
  rules.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
  res.json({ success: true, data: rules });
});

// PUT /api/sla/:severity   (admin) - only affects incidents created afterwards
exports.updateRule = asyncHandler(async (req, res) => {
  const severity = oneOf(req.params.severity, SEVERITIES, "severity");
  const rule = await SlaRule.findOne({ severity });
  if (!rule) throw new ApiError(404, "SLA rule not found");

  const { responseMinutes, resolutionMinutes, autoAssign } = req.body;
  if (responseMinutes !== undefined) {
    if (!Number.isInteger(responseMinutes) || responseMinutes < 1) {
      throw new ApiError(400, "responseMinutes must be a positive integer");
    }
    rule.responseMinutes = responseMinutes;
  }
  if (resolutionMinutes !== undefined) {
    if (!Number.isInteger(resolutionMinutes) || resolutionMinutes < 1) {
      throw new ApiError(400, "resolutionMinutes must be a positive integer");
    }
    rule.resolutionMinutes = resolutionMinutes;
  }
  if (autoAssign !== undefined) {
    if (typeof autoAssign !== "boolean") throw new ApiError(400, "autoAssign must be true or false");
    rule.autoAssign = autoAssign;
  }
  if (rule.resolutionMinutes < rule.responseMinutes) {
    throw new ApiError(400, "resolutionMinutes cannot be shorter than responseMinutes");
  }

  await rule.save();
  res.json({ success: true, data: rule });
});
