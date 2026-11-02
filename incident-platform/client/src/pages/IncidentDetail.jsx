import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { errMsg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useRealtime } from "../context/RealtimeContext";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import SlaMeter from "../components/SlaMeter";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import Timeline from "../components/Timeline";
import EvidencePanel from "../components/EvidencePanel";
import { SEVERITIES, STATUS_ACTION, TRANSITIONS, fmtDate, label } from "../utils/format";

export default function IncidentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const role = user.role;

  const [inc, setInc] = useState(null);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [assignee, setAssignee] = useState("");
  const [severity, setSeverity] = useState("");
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusNote, setStatusNote] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/incidents/${id}`);
      setInc(data.data);
      setError("");
    } catch (e) {
      setError(errMsg(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // keep the form controls in sync with the loaded incident
  useEffect(() => {
    if (inc) {
      setAssignee(inc.assignedTo ? inc.assignedTo._id : "");
      setSeverity(inc.severity);
    }
  }, [inc]);

  useEffect(() => {
    if (["admin", "analyst"].includes(role)) {
      api.get("/users", { params: { active: true } }).then((r) => setUsers(r.data.data.filter((u) => u.role !== "viewer"))).catch(() => {});
    }
  }, [role]);

  useRealtime(["incident:updated", "incident:escalated", "incident:response_breached", "incident:assigned"], (_e, p) => {
    if (p && String(p.id) === String(id)) load();
  });

  if (error) {
    return (
      <div className="page">
        <Link to="/incidents" className="crumb">Back to incidents</Link>
        <div className="error-box">{error}</div>
      </div>
    );
  }
  if (!inc) return <Spinner />;

  const isMine = inc.assignedTo && inc.assignedTo._id === user._id;
  const canManage = ["admin", "analyst"].includes(role) && inc.status !== "closed";
  const canNote = ["admin", "analyst", "responder"].includes(role);

  const nextStatuses = (TRANSITIONS[inc.status] || []).filter((s) => {
    if (role === "viewer") return false;
    if (inc.status === "closed" && role !== "admin") return false;
    if (role === "responder") return isMine && s !== "closed";
    return true;
  });

  async function run(fn, okMessage) {
    setBusy(true);
    try {
      await fn();
      if (okMessage) toast.push(okMessage, "success");
      await load();
      return true;
    } catch (e) {
      toast.push(errMsg(e), "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmStatus() {
    if (statusTarget === "resolved" && !statusNote.trim()) return toast.push("Describe how it was resolved before continuing.", "error");
    const ok = await run(() => api.patch(`/incidents/${id}/status`, { status: statusTarget, note: statusNote.trim() || undefined }), "Status updated");
    if (ok) {
      setStatusTarget(null);
      setStatusNote("");
    }
  }

  // Fetch AI suggestion
  async function fetchSuggestion() {
    setAiLoading(true);
    try {
      const { data } = await api.get(`/ai/suggest/${id}`);
      setAiSuggestion(data.suggestion);
    } catch (e) {
      toast.push(errMsg(e), "error");
    } finally {
      setAiLoading(false);
    }
  }

  const saveAssignee = () => run(() => api.patch(`/incidents/${id}/assign`, { assignedTo: assignee || null }), assignee ? "Incident assigned" : "Assignment removed");
  const saveSeverity = () => run(() => api.patch(`/incidents/${id}`, { severity }), "Severity changed and deadlines recalculated");

  async function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    const ok = await run(() => api.post(`/incidents/${id}/notes`, { note: note.trim() }), "Note added");
    if (ok) setNote("");
  }

  async function remove() {
    if (!window.confirm(`Delete ${inc.incidentNumber}? This cannot be undone.`)) return;
    try {
      await api.delete(`/incidents/${id}`);
      toast.push(`${inc.incidentNumber} deleted`, "success");
      navigate("/incidents");
    } catch (e) {
      toast.push(errMsg(e), "error");
    }
  }

  return (
    <div className="page">
      <Link to="/incidents" className="crumb">Back to incidents</Link>

      <div className="detail-title">
        <span className="mono muted">{inc.incidentNumber}</span>
        <SeverityBadge value={inc.severity} />
        <StatusBadge value={inc.status} />
        {inc.escalated && <span className="chip flag">Escalated</span>}
        {inc.responseBreached && <span className="chip flag amber">Response was late</span>}
        <h1>{inc.title}</h1>
      </div>

      <div className="detail-grid">
        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>What happened</h2></div>
            <div className="panel-body">
              <p className="description">{inc.description}</p>
              {inc.affectedSystems.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                  <div className="muted small" style={{ marginBottom: "0.35rem" }}>Affected systems</div>
                  {inc.affectedSystems.map((s) => <span className="chip" key={s}>{s}</span>)}
                </div>
              )}
              {inc.resolutionSummary && (
                <div className="notice" style={{ marginTop: "1rem" }}>
                  <strong>Resolution:</strong> {inc.resolutionSummary}
                </div>
              )}
            </div>
          </section>

          <EvidencePanel incident={inc} onChanged={load} />

          <section className="panel">
            <div className="panel-head"><h2>Activity</h2></div>
            <div className="panel-body">
              {canNote && (
                <form onSubmit={addNote} style={{ marginBottom: "1.2rem" }}>
                  <div className="field" style={{ marginBottom: "0.5rem" }}>
                    <label htmlFor="note">Add a note</label>
                    <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={5000} placeholder="Findings, actions taken, who you contacted..." style={{ minHeight: "4rem" }} />
                  </div>
                  <button className="btn btn-sm" disabled={busy || !note.trim()}>Add note</button>
                </form>
              )}
              <Timeline history={inc.history} />
            </div>
          </section>
        </div>

        <div className="actions-col">
          <section className="panel">
            <div className="panel-head"><h2>Details</h2></div>
            <div className="panel-body">
              <dl className="kv" style={{ margin: 0 }}>
                <dt>Type</dt><dd>{label(inc.type)}</dd>
                <dt>Reported by</dt><dd>{inc.reportedBy ? inc.reportedBy.name : "-"}</dd>
                <dt>Assigned to</dt><dd>{inc.assignedTo ? inc.assignedTo.name : <span className="muted">Unassigned</span>}</dd>
                <dt>Reported</dt><dd>{fmtDate(inc.createdAt)}</dd>
                <dt>First response</dt>
                <dd>{inc.firstRespondedAt ? fmtDate(inc.firstRespondedAt) : <span className={inc.responseBreached ? "verify-bad" : "muted"}>Not yet</span>}</dd>
                <dt>Respond by</dt><dd>{fmtDate(inc.responseDueAt)}</dd>
                <dt>Resolve by</dt><dd>{fmtDate(inc.resolutionDueAt)}</dd>
                {inc.resolvedAt && (<><dt>Resolved</dt><dd>{fmtDate(inc.resolvedAt)}</dd></>)}
                <dt>Deadline</dt>
                <dd>
                  <SlaMeter incident={inc} />
                  {role !== "viewer" && (
                    <button className="btn btn-sm" onClick={fetchSuggestion} disabled={aiLoading}>
                      {aiLoading ? "Generating…" : "Get AI Suggestion"}
                    </button>
              )}
{aiSuggestion && (
  <section className="panel">
    <div className="panel-head"><h2>AI Suggestion</h2></div>
    <div className="panel-body"><p>{aiSuggestion}</p></div>
  </section>
)}
                </dd>
              </dl>
            </div>
          </section>

          {nextStatuses.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h2>Move forward</h2></div>
              <div className="panel-body">
                <div className="btn-row">
                  {nextStatuses.map((s) => (
                    <button key={s} className={`btn ${s === "in_progress" || s === "resolved" ? "btn-primary" : ""}`} disabled={busy} onClick={() => { setStatusTarget(s); setStatusNote(""); }}>
                      {STATUS_ACTION[s]}
                    </button>
                  ))}
                </div>
                {role === "responder" && <p className="muted small" style={{ marginTop: "0.7rem" }}>Responders resolve incidents. An analyst closes them.</p>}
              </div>
            </section>
          )}

          {canManage && (
            <section className="panel">
              <div className="panel-head"><h2>Manage</h2></div>
              <div className="panel-body">
                <div className="field">
                  <label htmlFor="assignee">Assigned to</label>
                  <select id="assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u._id} value={u._id}>{u.name} ({label(u.role)})</option>)}
                  </select>
                </div>
                <button className="btn btn-sm" disabled={busy || assignee === (inc.assignedTo ? inc.assignedTo._id : "")} onClick={saveAssignee}>Save assignment</button>

                <hr className="divider" />

                <div className="field">
                  <label htmlFor="severity">Severity</label>
                  <select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                    {SEVERITIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                  </select>
                  <span className="hint">Changing severity recalculates both deadlines from the report time.</span>
                </div>
                <button className="btn btn-sm" disabled={busy || severity === inc.severity} onClick={saveSeverity}>Save severity</button>
              </div>
            </section>
          )}

          {role === "admin" && (
            <button className="btn btn-danger" onClick={remove}>Delete incident</button>
          )}
        </div>
      </div>

      {statusTarget && (
        <Modal
          title={STATUS_ACTION[statusTarget]}
          onClose={() => setStatusTarget(null)}
          footer={
            <>
              <button className="btn" onClick={() => setStatusTarget(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={confirmStatus}>{busy ? "Saving..." : "Confirm"}</button>
            </>
          }
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="status-note">{statusTarget === "resolved" ? "How was it resolved?" : "Note (optional)"}</label>
            <textarea id="status-note" autoFocus value={statusNote} onChange={(e) => setStatusNote(e.target.value)} maxLength={5000} placeholder={statusTarget === "resolved" ? "Root cause, fix applied, follow-up actions" : "Add context for the audit trail"} />
          </div>
        </Modal>
      )}
    </div>
  );
}
