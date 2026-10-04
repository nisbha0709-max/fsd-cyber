const mongoose = require("mongoose");
const { SEVERITIES, STATUSES, INCIDENT_TYPES } = require("../utils/constants");

const { ObjectId } = mongoose.Schema.Types;

// Every change to an incident is appended here -> audit trail
const historySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    by: { type: ObjectId, ref: "User", default: null }, // null = system
    from: String,
    to: String,
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    incidentNumber: { type: String, unique: true, required: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    type: { type: String, enum: INCIDENT_TYPES, required: true },
    severity: { type: String, enum: SEVERITIES, required: true },
    status: { type: String, enum: STATUSES, default: "open" },
    affectedSystems: [{ type: String, trim: true }],

    reportedBy: { type: ObjectId, ref: "User", required: true },
    assignedTo: { type: ObjectId, ref: "User", default: null },

    // SLA tracking
    responseDueAt: { type: Date, required: true },
    resolutionDueAt: { type: Date, required: true },
    firstRespondedAt: { type: Date, default: null },
    responseBreached: { type: Boolean, default: false },
    escalated: { type: Boolean, default: false },
    escalationLevel: { type: Number, default: 0 },
    escalatedAt: { type: Date, default: null },

    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    resolutionSummary: { type: String, trim: true, maxlength: 5000 },

    history: [historySchema],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        delete ret.id;
        return ret;
      },
    },
  }
);

incidentSchema.index({ status: 1, severity: 1 });
incidentSchema.index({ assignedTo: 1, status: 1 });
incidentSchema.index({ resolutionDueAt: 1 });
incidentSchema.index({ createdAt: -1 });

// True if the resolution deadline was (or currently is) missed
incidentSchema.virtual("slaBreached").get(function () {
  const end = this.resolvedAt || new Date();
  return end > this.resolutionDueAt;
});

module.exports = mongoose.model("Incident", incidentSchema);
