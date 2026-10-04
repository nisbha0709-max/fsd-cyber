const Counter = require("../models/Counter");
const SlaRule = require("../models/SlaRule");
const User = require("../models/User");
const Incident = require("../models/Incident");
const ApiError = require("../utils/ApiError");
const { ACTIVE_STATUSES } = require("../utils/constants");

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);

async function nextIncidentNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "incident" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `INC-${String(counter.seq).padStart(4, "0")}`;
}

async function getRule(severity) {
  const rule = await SlaRule.findOne({ severity });
  if (!rule) throw new ApiError(500, `No SLA rule configured for severity '${severity}'`);
  return rule;
}

// Picks the active responder with the fewest open incidents
async function pickResponder() {
  const responders = await User.find({ role: "responder", isActive: true }).select("_id name");
  if (!responders.length) return null;

  const ids = responders.map((r) => r._id);
  const loads = await Incident.aggregate([
    { $match: { assignedTo: { $in: ids }, status: { $in: ACTIVE_STATUSES } } },
    { $group: { _id: "$assignedTo", n: { $sum: 1 } } },
  ]);
  const loadMap = new Map(loads.map((l) => [String(l._id), l.n]));

  return responders.reduce((best, r) =>
    (loadMap.get(String(r._id)) || 0) < (loadMap.get(String(best._id)) || 0) ? r : best
  );
}

// Creates an incident, computes SLA deadlines, routes it, writes the first audit entries
async function createIncidentRecord(data, reporter, assignee = null) {
  const now = new Date();
  const rule = await getRule(data.severity);

  let autoAssigned = false;
  if (!assignee && rule.autoAssign) {
    assignee = await pickResponder();
    autoAssigned = !!assignee;
  }

  const history = [
    { action: "created", by: reporter._id, to: "open", note: `Reported with ${data.severity} severity`, at: now },
  ];
  if (assignee) {
    history.push({
      action: autoAssigned ? "auto_assigned" : "assigned",
      by: autoAssigned ? null : reporter._id,
      note: `Assigned to ${assignee.name}${autoAssigned ? " (auto-routed by severity)" : ""}`,
      at: now,
    });
  }

  const incident = await Incident.create({
    incidentNumber: await nextIncidentNumber(),
    title: data.title,
    description: data.description,
    type: data.type,
    severity: data.severity,
    affectedSystems: data.affectedSystems || [],
    reportedBy: reporter._id,
    assignedTo: assignee ? assignee._id : null,
    responseDueAt: addMinutes(now, rule.responseMinutes),
    resolutionDueAt: addMinutes(now, rule.resolutionMinutes),
    history,
  });

  return { incident, autoAssigned };
}

module.exports = { nextIncidentNumber, getRule, pickResponder, createIncidentRecord, addMinutes };
