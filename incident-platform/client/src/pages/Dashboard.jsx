import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { errMsg } from "../api/client";
import { useRealtime } from "../context/RealtimeContext";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import SlaMeter from "../components/SlaMeter";
import Spinner from "../components/Spinner";
import { SEVERITIES, label, timeAgo } from "../utils/format";

const SEV_COLORS = { critical: "#cf2a3f", high: "#e3701a", medium: "#c99700", low: "#2a9d6f" };
const AXIS = { fontSize: 12, fill: "#5b6a7e" };

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [overdue, setOverdue] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([
        api.get("/dashboard/stats"),
        api.get("/incidents", { params: { overdue: true, sort: "resolutionDueAt", limit: 6 } }),
      ]);
      setStats(s.data.data);
      setOverdue(o.data.data);
      setError("");
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime(["incident:created", "incident:updated", "incident:escalated", "incident:deleted"], load);

  if (error) return <div className="page"><div className="error-box">{error}</div></div>;
  if (!stats) return <Spinner />;

  const { totals, sla, bySeverity, byType, last7Days, recent } = stats;

  const severityData = SEVERITIES.map((s) => ({ key: s, name: label(s), value: bySeverity[s] || 0 })).filter((d) => d.value > 0);
  const dayData = last7Days.map((d) => ({
    day: new Date(d.date).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }),
    count: d.count,
  }));
  const typeData = Object.entries(byType)
    .map(([k, v]) => ({ name: label(k), value: v }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>What needs attention now, and how the team is doing against its deadlines.</p>
        </div>
      </div>

      <div className="strip">
        <Link to="/incidents?status=open,in_progress">
          <div className="num">{totals.active}</div>
          <div className="cap">Active incidents</div>
        </Link>
        <Link to="/incidents?scope=overdue">
          <div className={`num ${sla.overdue ? "bad" : ""}`}>{sla.overdue}</div>
          <div className="cap">Past deadline</div>
        </Link>
        <Link to="/incidents?scope=escalated">
          <div className={`num ${sla.escalated ? "warn" : ""}`}>{sla.escalated}</div>
          <div className="cap">Escalated</div>
        </Link>
        <Link to="/incidents?scope=unassigned">
          <div className={`num ${totals.unassigned ? "warn" : ""}`}>{totals.unassigned}</div>
          <div className="cap">Unassigned</div>
        </Link>
        <Link to="/incidents?scope=me">
          <div className="num">{totals.myAssigned}</div>
          <div className="cap">Assigned to you</div>
        </Link>
        <div>
          <div className="num">{sla.avgResolutionHours == null ? "-" : `${sla.avgResolutionHours}h`}</div>
          <div className="cap">Avg. time to resolve</div>
        </div>
        <div>
          <div className="num">{sla.slaCompliancePercent == null ? "-" : `${sla.slaCompliancePercent}%`}</div>
          <div className="cap">Resolved within SLA</div>
        </div>
      </div>

      <div className="stack">
        <section className="panel">
          <div className="panel-head">
            <h2>Past their deadline</h2>
            <Link to="/incidents?scope=overdue" className="small">View all</Link>
          </div>
          {overdue.length === 0 ? (
            <div className="empty"><strong>Nothing is past its deadline.</strong>Active incidents are all inside their SLA window.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <tbody>
                  {overdue.map((i) => (
                    <tr key={i._id} className={`incident-row sev-${i.severity}`} onClick={() => navigate(`/incidents/${i._id}`)}>
                      <td className="mono nowrap">{i.incidentNumber}</td>
                      <td className="title-cell">{i.title}</td>
                      <td><SeverityBadge value={i.severity} /></td>
                      <td>{i.assignedTo ? i.assignedTo.name : <span className="muted">Unassigned</span>}</td>
                      <td><SlaMeter incident={i} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid-2">
          <section className="panel">
            <div className="panel-head"><h2>Active incidents by severity</h2></div>
            <div className="panel-body chart-box">
              {severityData.length === 0 ? (
                <div className="empty">No active incidents.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} label={({ name, value }) => `${name} ${value}`}>
                      {severityData.map((d) => <Cell key={d.key} fill={SEV_COLORS[d.key]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Reported in the last 7 days</h2></div>
            <div className="panel-body chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayData}>
                  <CartesianGrid stroke="#eaeef3" vertical={false} />
                  <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={28} />
                  <Tooltip cursor={{ fill: "#f2f4f7" }} />
                  <Bar dataKey="count" name="Incidents" fill="#2457d6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="grid-2">
          <section className="panel">
            <div className="panel-head"><h2>Incidents by type</h2></div>
            <div className="panel-body chart-box">
              {typeData.length === 0 ? (
                <div className="empty">No incidents yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid stroke="#eaeef3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={120} />
                    <Tooltip cursor={{ fill: "#f2f4f7" }} />
                    <Bar dataKey="value" name="Incidents" fill="#7a4fd6" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Latest reports</h2>
              <Link to="/incidents" className="small">All incidents</Link>
            </div>
            {recent.length === 0 ? (
              <div className="empty">No incidents have been reported yet.</div>
            ) : (
              <ul className="list-plain">
                {recent.map((i) => (
                  <li key={i._id}>
                    <div style={{ minWidth: 0 }}>
                      <Link to={`/incidents/${i._id}`}>{i.title}</Link>
                      <div className="muted small"><span className="mono">{i.incidentNumber}</span> &middot; {timeAgo(i.createdAt)}</div>
                    </div>
                    <div className="btn-row" style={{ flexWrap: "nowrap" }}>
                      <SeverityBadge value={i.severity} />
                      <StatusBadge value={i.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
