const Incident = require("../models/Incident");
const asyncHandler = require("../utils/asyncHandler");
const { ACTIVE_STATUSES } = require("../utils/constants");

const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
const countBy = (field, match = {}) =>
  Incident.aggregate([{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]);

// GET /api/dashboard/stats
exports.getStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const active = { status: { $in: ACTIVE_STATUSES } };

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));

  const [
    total,
    activeCount,
    bySeverity,
    byStatus,
    byType,
    overdue,
    escalated,
    unassigned,
    resolvedAgg,
    resolvedLate,
    perDay,
    myAssigned,
    recent,
  ] = await Promise.all([
    Incident.countDocuments(),
    Incident.countDocuments(active),
    countBy("severity", active),
    countBy("status"),
    countBy("type"),
    Incident.countDocuments({ ...active, resolutionDueAt: { $lt: now } }),
    Incident.countDocuments({ ...active, escalated: true }),
    Incident.countDocuments({ ...active, assignedTo: null }),
    Incident.aggregate([
      { $match: { resolvedAt: { $ne: null } } },
      { $group: { _id: null, n: { $sum: 1 }, avgMs: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } } } },
    ]),
    Incident.countDocuments({ resolvedAt: { $ne: null }, $expr: { $gt: ["$resolvedAt", "$resolutionDueAt"] } }),
    Incident.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, n: { $sum: 1 } } },
    ]),
    Incident.countDocuments({ ...active, assignedTo: req.user._id }),
    Incident.find().sort("-createdAt").limit(5).select("incidentNumber title severity status createdAt").lean(),
  ]);

  // Fill days with zero incidents so charts always get 7 points
  const dayMap = toMap(perDay);
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    return { date: d, count: dayMap[d] || 0 };
  });

  const resolvedTotal = resolvedAgg[0] ? resolvedAgg[0].n : 0;
  const avgResolutionHours = resolvedAgg[0] ? Number((resolvedAgg[0].avgMs / 3600000).toFixed(2)) : null;
  const slaCompliancePercent = resolvedTotal
    ? Number((((resolvedTotal - resolvedLate) / resolvedTotal) * 100).toFixed(1))
    : null;

  res.json({
    success: true,
    data: {
      totals: { total, active: activeCount, resolved: resolvedTotal, unassigned, myAssigned },
      bySeverity: toMap(bySeverity), // active incidents only
      byStatus: toMap(byStatus),
      byType: toMap(byType),
      sla: { overdue, escalated, resolvedLate, slaCompliancePercent, avgResolutionHours },
      last7Days,
      recent,
    },
  });
});
