export const SEVERITIES = ["critical", "high", "medium", "low"];
export const STATUSES = ["open", "in_progress", "resolved", "closed"];
export const TYPES = [
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

// Mirrors the backend workflow
export const TRANSITIONS = {
  open: ["in_progress"],
  in_progress: ["resolved", "open"],
  resolved: ["closed", "in_progress"],
  closed: ["in_progress"],
};

export const STATUS_ACTION = {
  open: "Move back to open",
  in_progress: "Start work",
  resolved: "Mark resolved",
  closed: "Close incident",
};

export const label = (s) => (s ? String(s).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");

export function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function fmtBytes(n) {
  if (n == null) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function fmtDuration(ms) {
  const m = Math.round(Math.abs(ms) / 60000);
  if (m < 1) return "under 1 min";
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${mm}m`;
  return `${mm}m`;
}

export const minutesLabel = (min) => fmtDuration(min * 60000);

export function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return "just now";
  return `${fmtDuration(diff)} ago`;
}

export const shortHash = (h) => (h ? `${h.slice(0, 10)}...${h.slice(-8)}` : "");
