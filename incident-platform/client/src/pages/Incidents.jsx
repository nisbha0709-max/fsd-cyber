import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api, { errMsg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import SlaMeter from "../components/SlaMeter";
import Spinner from "../components/Spinner";
import { SEVERITIES, STATUSES, TYPES, label, timeAgo } from "../utils/format";

const SCOPE_PARAMS = {
  me: { assignedTo: "me" },
  unassigned: { unassigned: true },
  overdue: { overdue: true },
  escalated: { escalated: true },
};

export default function Incidents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const f = {
    search: sp.get("search") || "",
    severity: sp.get("severity") || "",
    status: sp.get("status") || "",
    type: sp.get("type") || "",
    scope: sp.get("scope") || "",
    page: Number(sp.get("page")) || 1,
  };

  const [searchText, setSearchText] = useState(f.search);

  const update = useCallback(
    (changes) => {
      const next = new URLSearchParams(sp);
      Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      if (!("page" in changes)) next.delete("page"); // any filter change returns to page 1
      setSp(next, { replace: true });
    },
    [sp, setSp]
  );

  // Debounce the search box
  useEffect(() => {
    if (searchText === f.search) return undefined;
    const t = setTimeout(() => update({ search: searchText }), 350);
    return () => clearTimeout(t);
  }, [searchText, f.search, update]);

  const query = sp.toString();
  const load = useCallback(async () => {
    const p = new URLSearchParams(query);
    const params = { page: Number(p.get("page")) || 1, limit: 15 };
    ["search", "severity", "status", "type"].forEach((k) => p.get(k) && (params[k] = p.get(k)));
    Object.assign(params, SCOPE_PARAMS[p.get("scope")] || {});
    if (params.overdue) params.sort = "resolutionDueAt";
    try {
      const res = await api.get("/incidents", { params });
      setData(res.data);
      setError("");
    } catch (e) {
      setError(errMsg(e));
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime(["incident:created", "incident:updated", "incident:escalated", "incident:deleted"], load);

  const canCreate = ["admin", "analyst"].includes(user.role);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Incidents</h1>
          <p>Search, filter and open any incident.</p>
        </div>
        {canCreate && <Link to="/incidents/new" className="btn btn-primary">Report incident</Link>}
      </div>

      <section className="panel">
        <div className="filters">
          <input type="search" placeholder="Search by title, number or system" aria-label="Search incidents" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          <select aria-label="Severity" value={f.severity} onChange={(e) => update({ severity: e.target.value })}>
            <option value="">All severities</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <select aria-label="Status" value={f.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="open,in_progress">Active (open + in progress)</option>
            {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <select aria-label="Type" value={f.type} onChange={(e) => update({ type: e.target.value })}>
            <option value="">All types</option>
            {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
          <select aria-label="Quick view" value={f.scope} onChange={(e) => update({ scope: e.target.value })}>
            <option value="">Everyone's incidents</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            <option value="overdue">Past deadline</option>
            <option value="escalated">Escalated</option>
          </select>
        </div>

        {error && <div className="error-box" style={{ margin: "1rem" }}>{error}</div>}
        {!data && !error && <Spinner />}

        {data && data.data.length === 0 && (
          <div className="empty"><strong>No incidents match these filters.</strong>Try clearing a filter or searching for something else.</div>
        )}

        {data && data.data.length > 0 && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Incident</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Assigned to</th>
                    <th>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((i) => (
                    <tr key={i._id} className={`incident-row sev-${i.severity}`} onClick={() => navigate(`/incidents/${i._id}`)}>
                      <td className="mono nowrap">{i.incidentNumber}</td>
                      <td className="title-cell">
                        {i.title}
                        <div className="sub">{label(i.type)} &middot; reported {timeAgo(i.createdAt)}{i.escalated ? " \u00b7 escalated" : ""}</div>
                      </td>
                      <td><SeverityBadge value={i.severity} /></td>
                      <td><StatusBadge value={i.status} /></td>
                      <td>{i.assignedTo ? i.assignedTo.name : <span className="muted">Unassigned</span>}</td>
                      <td><SlaMeter incident={i} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span className="muted small">{data.total} incident{data.total === 1 ? "" : "s"}</span>
              <div className="btn-row">
                <button className="btn btn-sm" disabled={data.page <= 1} onClick={() => update({ page: String(data.page - 1) })}>Previous</button>
                <span className="small" style={{ alignSelf: "center" }}>Page {data.page} of {data.pages}</span>
                <button className="btn btn-sm" disabled={data.page >= data.pages} onClick={() => update({ page: String(data.page + 1) })}>Next</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
