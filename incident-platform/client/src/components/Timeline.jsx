import { fmtDate, label } from "../utils/format";

const TITLES = {
  created: "Incident reported",
  assigned: "Assigned",
  auto_assigned: "Auto-routed by severity",
  unassigned: "Assignment removed",
  status_changed: "Status changed",
  severity_changed: "Severity changed",
  updated: "Details updated",
  note: "Note added",
  evidence_added: "Evidence added",
  escalated: "Escalated",
  response_sla_breached: "Response deadline missed",
};

export default function Timeline({ history }) {
  const items = [...history].reverse();
  if (!items.length) return <div className="empty">No activity yet.</div>;

  return (
    <ol className="timeline">
      {items.map((h, i) => (
        <li key={i} className={`k-${h.action}`}>
          <div className="t-title">
            {TITLES[h.action] || label(h.action)}
            {h.from && h.to ? ` (${label(h.from)} to ${label(h.to)})` : ""}
          </div>
          <div className="t-meta">
            {h.by ? `${h.by.name} (${h.by.role})` : "System"} &middot; {fmtDate(h.at)}
          </div>
          {h.note && <div className="t-note">{h.note}</div>}
        </li>
      ))}
    </ol>
  );
}
