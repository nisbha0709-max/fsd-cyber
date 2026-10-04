import useNow from "../hooks/useNow";
import { fmtDuration } from "../utils/format";

// Shows time left until the resolution deadline, with a bar for how much of the window is used
export default function SlaMeter({ incident }) {
  const now = useNow();
  const due = new Date(incident.resolutionDueAt).getTime();
  const start = new Date(incident.createdAt).getTime();

  if (incident.status === "resolved" || incident.status === "closed") {
    const end = new Date(incident.resolvedAt || incident.closedAt || now).getTime();
    const late = end > due;
    return (
      <div className="sla">
        <span className={`sla-text ${late ? "bad" : "ok"}`}>{late ? "Resolved late" : "Resolved on time"}</span>
      </div>
    );
  }

  const used = Math.min(Math.max((now - start) / Math.max(due - start, 1), 0), 1);
  const left = due - now;
  const state = left < 0 ? "bad" : used > 0.75 ? "warn" : "ok";

  return (
    <div className="sla">
      <span className={`sla-text ${state}`}>{left < 0 ? `Overdue by ${fmtDuration(left)}` : `${fmtDuration(left)} left`}</span>
      <div className="slabar" aria-hidden="true">
        <span className={`fill ${state}`} style={{ width: `${used * 100}%` }} />
      </div>
    </div>
  );
}
