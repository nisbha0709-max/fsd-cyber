const mongoose = require("mongoose");
const Incident = require("../models/Incident");
const Evidence = require("../models/Evidence");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const realtime = require("../realtime");
const { getRule, createIncidentRecord, addMinutes } = require("../services/incidentService");
const { SEVERITIES, INCIDENT_TYPES, STATUSES, ACTIVE_STATUSES, TRANSITIONS } = require("../utils/constants");
const { str, oneOf, strArray, escapeRegex } = require("../utils/validate");

const USER_FIELDS = "name email role";
const POPULATE = [
  { path: "reportedBy", select: USER_FIELDS },
  { path: "assignedTo", select: USER_FIELDS },
];

const summary = (i) => ({
  id: i._id,
  incidentNumber: i.incidentNumber,
  title: i.title,
  severity: i.severity,
  status: i.status,
  assignedTo: i.assignedTo && i.assignedTo._id ? i.assignedTo._id : i.assignedTo,
});

// Validates a user id that can be given work (not a viewer, must be active)
async function findAssignable(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new ApiError(400, "Invalid assignedTo");
  const user = await User.findOne({ _id: userId, isActive: true });
  if (!user) throw new ApiError(400, "Assignee not found or inactive");
  if (user.role === "viewer") throw new ApiError(400, "Viewers cannot be assigned incidents");
  return user;
}

// POST /api/incidents   (admin, analyst)
exports.createIncident = asyncHandler(async (req, res) => {
  const data = {
    title: str(req.body.title, "Title", { min: 3, max: 200 }),
    description: str(req.body.description, "Description", { min: 10, max: 5000 }),
    type: oneOf(req.body.type, INCIDENT_TYPES, "type"),
    severity: oneOf(req.body.severity, SEVERITIES, "severity"),
    affectedSystems: strArray(req.body.affectedSystems, "affectedSystems", { maxItems: 30 }),
  };
  const assignee = req.body.assignedTo ? await findAssignable(req.body.assignedTo) : null;

  const { incident, autoAssigned } = await createIncidentRecord(data, req.user, assignee);
  await incident.populate(POPULATE);

  realtime.emit("incident:created", summary(incident));
  if (incident.assignedTo && String(incident.assignedTo._id) !== String(req.user._id)) {
    realtime.emitToUser(incident.assignedTo._id, "incident:assigned", { ...summary(incident), autoAssigned });
  }

  res.status(201).json({ success: true, autoAssigned, data: incident });
});

// GET /api/incidents?severity=critical,high&status=open&assignedTo=me&overdue=true&search=phish&page=1&limit=20
exports.listIncidents = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = {};

  for (const key of ["severity", "status", "type"]) {
    if (q[key]) filter[key] = { $in: String(q[key]).split(",").map((s) => s.trim()) };
  }
  if (q.assignedTo === "me") filter.assignedTo = req.user._id;
  else if (q.assignedTo && mongoose.isValidObjectId(q.assignedTo)) filter.assignedTo = q.assignedTo;
  if (q.unassigned === "true") filter.assignedTo = null;
  if (q.escalated === "true") filter.escalated = true;
  if (q.overdue === "true") {
    filter.status = { $in: ACTIVE_STATUSES };
    filter.resolutionDueAt = { $lt: new Date() };
  }
  if (q.search) {
    const rx = new RegExp(escapeRegex(String(q.search).slice(0, 100)), "i");
    filter.$or = [{ title: rx }, { incidentNumber: rx }, { affectedSystems: rx }];
  }

  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 100);
  const sortField = String(q.sort || "-createdAt");
  const allowedSort = ["createdAt", "updatedAt", "resolutionDueAt"];
  const sort = allowedSort.includes(sortField.replace(/^-/, "")) ? sortField : "-createdAt";

  const [items, total] = await Promise.all([
    Incident.find(filter)
      .select("-history")
      .populate(POPULATE)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Incident.countDocuments(filter),
  ]);

  res.json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    count: items.length,
    data: items,
  });
});

// GET /api/incidents/:id   (full detail with audit trail + evidence list)
exports.getIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.id)
    .populate(POPULATE)
    .populate({ path: "history.by", select: "name role" });
  if (!incident) throw new ApiError(404, "Incident not found");

  const evidence = await Evidence.find({ incident: incident._id })
    .select("-custodyLog")
    .populate("uploadedBy", "name role")
    .sort("-createdAt");

  res.json({ success: true, data: { ...incident.toJSON(), evidence } });
});

// PATCH /api/incidents/:id   (admin, analyst)
exports.updateIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.id);
  if (!incident) throw new ApiError(404, "Incident not found");
  if (incident.status === "closed") throw new ApiError(409, "Closed incidents cannot be edited. Reopen it first.");

  const changes = [];
  const title = str(req.body.title, "Title", { min: 3, max: 200, required: false });
  const description = str(req.body.description, "Description", { min: 10, max: 5000, required: false });
  const type = oneOf(req.body.type, INCIDENT_TYPES, "type", { required: false });
  const severity = oneOf(req.body.severity, SEVERITIES, "severity", { required: false });

  if (title && title !== incident.title) { incident.title = title; changes.push("title"); }
  if (description && description !== incident.description) { incident.description = description; changes.push("description"); }
  if (type && type !== incident.type) { incident.type = type; changes.push("type"); }
  if (req.body.affectedSystems !== undefined) {
    incident.affectedSystems = strArray(req.body.affectedSystems, "affectedSystems", { maxItems: 30 });
    changes.push("affectedSystems");
  }

  if (severity && severity !== incident.severity) {
    const rule = await getRule(severity);
    const from = incident.severity;
    incident.severity = severity;
    // Deadlines are re-based on the original report time
    incident.responseDueAt = addMinutes(incident.createdAt, rule.responseMinutes);
    incident.resolutionDueAt = addMinutes(incident.createdAt, rule.resolutionMinutes);
    if (incident.resolutionDueAt > new Date()) {
      incident.escalated = false;
      incident.escalationLevel = 0;
    }
    if (!incident.firstRespondedAt && incident.responseDueAt > new Date()) incident.responseBreached = false;
    incident.history.push({ action: "severity_changed", by: req.user._id, from, to: severity, note: `Severity changed from ${from} to ${severity}; SLA deadlines recalculated` });
  }

  if (changes.length) {
    incident.history.push({ action: "updated", by: req.user._id, note: `Updated: ${changes.join(", ")}` });
  }
  await incident.save();
  await incident.populate(POPULATE);

  realtime.emit("incident:updated", summary(incident));
  res.json({ success: true, data: incident });
});

// PATCH /api/incidents/:id/assign   body: { assignedTo: userId | null }   (admin, analyst)
exports.assignIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.id);
  if (!incident) throw new ApiError(404, "Incident not found");
  if (incident.status === "closed") throw new ApiError(409, "Closed incidents cannot be reassigned");

  const assignee = req.body.assignedTo ? await findAssignable(req.body.assignedTo) : null;
  incident.assignedTo = assignee ? assignee._id : null;
  incident.history.push({
    action: assignee ? "assigned" : "unassigned",
    by: req.user._id,
    note: assignee ? `Assigned to ${assignee.name}` : "Assignment removed",
  });
  await incident.save();
  await incident.populate(POPULATE);

  realtime.emit("incident:updated", summary(incident));
  if (assignee) realtime.emitToUser(assignee._id, "incident:assigned", summary(incident));
  res.json({ success: true, data: incident });
});

// PATCH /api/incidents/:id/status   body: { status, note }   (admin, analyst, responder-if-assigned)
exports.changeStatus = asyncHandler(async (req, res) => {
  const status = oneOf(req.body.status, STATUSES, "status");
  const note = str(req.body.note, "Note", { max: 5000, required: false });

  const incident = await Incident.findById(req.params.id);
  if (!incident) throw new ApiError(404, "Incident not found");

  if (!(TRANSITIONS[incident.status] || []).includes(status)) {
    throw new ApiError(400, `Cannot move an incident from '${incident.status}' to '${status}'. Allowed: ${TRANSITIONS[incident.status].join(", ")}`);
  }
  if (incident.status === "closed" && req.user.role !== "admin") {
    throw new ApiError(403, "Only an admin can reopen a closed incident");
  }
  if (req.user.role === "responder") {
    if (String(incident.assignedTo) !== String(req.user._id)) {
      throw new ApiError(403, "Responders can only update incidents assigned to them");
    }
    if (status === "closed") throw new ApiError(403, "Responders cannot close incidents. Resolve it and ask an analyst to close.");
  }
  if (status === "resolved" && !note) throw new ApiError(400, "A resolution summary (note) is required to resolve an incident");

  const now = new Date();
  const from = incident.status;
  incident.status = status;

  if (status === "in_progress") {
    if (!incident.firstRespondedAt) {
      incident.firstRespondedAt = now;
      incident.responseBreached = incident.responseBreached || now > incident.responseDueAt;
    }
    if (from === "resolved" || from === "closed") { incident.resolvedAt = null; incident.closedAt = null; }
  }
  if (status === "resolved") { incident.resolvedAt = now; incident.resolutionSummary = note; }
  if (status === "closed") incident.closedAt = now;

  incident.history.push({ action: "status_changed", by: req.user._id, from, to: status, note });
  await incident.save();
  await incident.populate(POPULATE);

  realtime.emit("incident:updated", summary(incident));
  res.json({ success: true, data: incident });
});

// POST /api/incidents/:id/notes   body: { note }   (admin, analyst, responder)
exports.addNote = asyncHandler(async (req, res) => {
  const note = str(req.body.note, "Note", { max: 5000 });
  const incident = await Incident.findById(req.params.id);
  if (!incident) throw new ApiError(404, "Incident not found");

  incident.history.push({ action: "note", by: req.user._id, note });
  await incident.save();
  res.status(201).json({ success: true, data: incident.history[incident.history.length - 1] });
});

// DELETE /api/incidents/:id   (admin; blocked if evidence exists to protect chain of custody)
exports.deleteIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.id);
  if (!incident) throw new ApiError(404, "Incident not found");
  if (await Evidence.exists({ incident: incident._id })) {
    throw new ApiError(409, "This incident has forensic evidence and cannot be deleted. Close it instead.");
  }
  await incident.deleteOne();
  realtime.emit("incident:deleted", { id: incident._id, incidentNumber: incident.incidentNumber });
  res.json({ success: true, message: "Incident deleted" });
});
