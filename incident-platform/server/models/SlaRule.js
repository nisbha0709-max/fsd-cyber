const mongoose = require("mongoose");
const { SEVERITIES } = require("../utils/constants");

const slaRuleSchema = new mongoose.Schema(
  {
    severity: { type: String, enum: SEVERITIES, required: true, unique: true },
    responseMinutes: { type: Number, required: true, min: 1 },
    resolutionMinutes: { type: Number, required: true, min: 1 },
    // When true, new incidents of this severity are auto-routed to the least-loaded responder
    autoAssign: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const DEFAULTS = [
  { severity: "critical", responseMinutes: 15, resolutionMinutes: 60, autoAssign: true },
  { severity: "high", responseMinutes: 60, resolutionMinutes: 240, autoAssign: true },
  { severity: "medium", responseMinutes: 240, resolutionMinutes: 1440, autoAssign: false },
  { severity: "low", responseMinutes: 1440, resolutionMinutes: 4320, autoAssign: false },
];

// Inserts default rules for any severity that has none yet
slaRuleSchema.statics.seedDefaults = async function () {
  for (const rule of DEFAULTS) {
    await this.updateOne({ severity: rule.severity }, { $setOnInsert: rule }, { upsert: true });
  }
};

module.exports = mongoose.model("SlaRule", slaRuleSchema);
