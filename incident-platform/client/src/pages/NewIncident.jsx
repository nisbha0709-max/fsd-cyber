import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { errMsg } from "../api/client";
import { useToast } from "../context/ToastContext";
import { SEVERITIES, TYPES, label, minutesLabel } from "../utils/format";

export default function NewIncident() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ title: "", description: "", type: "phishing", severity: "medium", affectedSystems: "", assignedTo: "" });
  const [users, setUsers] = useState([]);
  const [rules, setRules] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/users", { params: { active: true } }).then((r) => setUsers(r.data.data.filter((u) => u.role !== "viewer"))).catch(() => {});
    api.get("/sla").then((r) => setRules(r.data.data)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const rule = rules.find((r) => r.severity === form.severity);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = { ...form };
      if (!body.assignedTo) delete body.assignedTo;
      const { data } = await api.post("/incidents", body);
      const who = data.data.assignedTo ? ` and assigned to ${data.data.assignedTo.name}${data.autoAssigned ? " automatically" : ""}` : "";
      toast.push(`${data.data.incidentNumber} reported${who}`, "success");
      navigate(`/incidents/${data.data._id}`);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <Link to="/incidents" className="crumb">Back to incidents</Link>
      <div className="page-head">
        <div>
          <h1>Report an incident</h1>
          <p>Choose a severity to set the response and resolution deadlines.</p>
        </div>
      </div>

      <form className="panel" onSubmit={submit}>
        <div className="panel-body">
          {error && <div className="error-box" role="alert">{error}</div>}

          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" type="text" value={form.title} onChange={set("title")} required minLength={3} maxLength={200} placeholder="Short summary, e.g. Phishing emails reported by finance team" />
          </div>

          <div className="field">
            <label htmlFor="description">What happened?</label>
            <textarea id="description" value={form.description} onChange={set("description")} required minLength={10} maxLength={5000} placeholder="Describe what was seen, when, and what has been done so far." />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="type">Type</label>
              <select id="type" value={form.type} onChange={set("type")}>
                {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="severity">Severity</label>
              <select id="severity" value={form.severity} onChange={set("severity")}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
            </div>
          </div>

          {rule && (
            <div className="notice" style={{ marginBottom: "1rem" }}>
              {label(rule.severity)} incidents need a first response within {minutesLabel(rule.responseMinutes)} and a resolution within {minutesLabel(rule.resolutionMinutes)}.
              {rule.autoAssign ? " They are routed to the least busy responder automatically." : ""}
            </div>
          )}

          <div className="field">
            <label htmlFor="systems">Affected systems</label>
            <input id="systems" type="text" value={form.affectedSystems} onChange={set("affectedSystems")} placeholder="Separate with commas, e.g. FS-01, VPN gateway" />
          </div>

          <div className="field">
            <label htmlFor="assignedTo">Assign to</label>
            <select id="assignedTo" value={form.assignedTo} onChange={set("assignedTo")}>
              <option value="">{rule && rule.autoAssign ? "Route automatically" : "Leave unassigned"}</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.name} ({label(u.role)})</option>)}
            </select>
          </div>
        </div>
        <div className="panel-head" style={{ borderTop: "1px solid var(--line-soft)", borderBottom: 0, justifyContent: "flex-end" }}>
          <Link to="/incidents" className="btn">Cancel</Link>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Reporting..." : "Report incident"}</button>
        </div>
      </form>
    </div>
  );
}
