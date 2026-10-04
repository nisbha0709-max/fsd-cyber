const cron = require("node-cron");
const Incident = require("../models/Incident");
const realtime = require("../realtime");
const { ACTIVE_STATUSES } = require("../utils/constants");

const payload = (i, extra = {}) => ({
  id: i._id,
  incidentNumber: i.incidentNumber,
  title: i.title,
  severity: i.severity,
  ...extra,
});

// Flags incidents that missed the response or resolution deadline
async function runSlaCheck() {
  const now = new Date();

  // 1) Resolution deadline missed -> escalate
  const overdue = await Incident.find({
    status: { $in: ACTIVE_STATUSES },
    escalated: false,
    resolutionDueAt: { $lt: now },
  });
  for (const inc of overdue) {
    const r = await Incident.updateOne(
      { _id: inc._id, escalated: false }, // guard against double-escalation
      {
        $set: { escalated: true, escalationLevel: 1, escalatedAt: now },
        $push: { history: { action: "escalated", by: null, note: "Resolution SLA deadline exceeded", at: now } },
      }
    );
    if (r.modifiedCount) {
      realtime.emit("incident:escalated", payload(inc));
      realtime.emitToUser(inc.assignedTo, "incident:escalated", payload(inc));
    }
  }

  // 2) Nobody responded in time -> mark response breach
  const slow = await Incident.find({
    status: { $in: ACTIVE_STATUSES },
    firstRespondedAt: null,
    responseBreached: false,
    responseDueAt: { $lt: now },
  });
  for (const inc of slow) {
    const r = await Incident.updateOne(
      { _id: inc._id, responseBreached: false },
      {
        $set: { responseBreached: true },
        $push: { history: { action: "response_sla_breached", by: null, note: "No response before the response SLA deadline", at: now } },
      }
    );
    if (r.modifiedCount) realtime.emit("incident:response_breached", payload(inc));
  }

  if (overdue.length || slow.length) {
    console.log(`[SLA] escalated ${overdue.length}, response breaches ${slow.length}`);
  }
}

// Runs once at startup, then every minute
function start() {
  const safeRun = () => runSlaCheck().catch((e) => console.error("[SLA] check failed:", e.message));
  safeRun();
  return cron.schedule("* * * * *", safeRun);
}

module.exports = { start, runSlaCheck };
