const ROLES = ["admin", "analyst", "responder", "viewer"];
const SEVERITIES = ["critical", "high", "medium", "low"];
const STATUSES = ["open", "in_progress", "resolved", "closed"];
const ACTIVE_STATUSES = ["open", "in_progress"];
const INCIDENT_TYPES = [
  "malware",
  "ransomware",
  "phishing",
  "data_breach",
  "unauthorized_access",
  "ddos",
  "insider_threat",
  "vulnerability",
  "other",
];

// Allowed status workflow
const TRANSITIONS = {
  open: ["in_progress"],
  in_progress: ["resolved", "open"],
  resolved: ["closed", "in_progress"],
  closed: ["in_progress"], // reopen (admin only, enforced in controller)
};

module.exports = { ROLES, SEVERITIES, STATUSES, ACTIVE_STATUSES, INCIDENT_TYPES, TRANSITIONS };
