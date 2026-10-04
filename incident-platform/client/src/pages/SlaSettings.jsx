import { useEffect, useState } from "react";
import api, { errMsg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { SeverityBadge } from "../components/Badges";
import Spinner from "../components/Spinner";
import { label, minutesLabel } from "../utils/format";

export default function SlaSettings() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === "admin";
  const [rules, setRules] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  useEffect(() => {
    api.get("/sla").then((r) => setRules(r.data.data)).catch((e) => setError(errMsg(e)));
  }, []);

  const edit = (severity, field, value) =>
    setRules((list) => list.map((r) => (r.severity === severity ? { ...r, [field]: value } : r)));

  async function save(rule) {
    setSaving(rule.severity);
    try {
      await api.put(`/sla/${rule.severity}`, {
        responseMinutes: Number(rule.responseMinutes),
        resolutionMinutes: Number(rule.resolutionMinutes),
        autoAssign: !!rule.autoAssign,
      });
      toast.push(`${label(rule.severity)} rule saved. It applies to new incidents.`, "success");
    } catch (e) {
      toast.push(errMsg(e), "error");
    } finally {
      setSaving("");
    }
  }

  if (error) return <div className="page"><div className="error-box">{error}</div></div>;
  if (!rules) return <Spinner />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>SLA rules</h1>
          <p>How quickly each severity must be picked up and resolved. {isAdmin ? "Changes apply to incidents reported from now on." : "Only admins can change these."}</p>
        </div>
      </div>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>First response within</th>
                <th>Resolution within</th>
                <th>Auto-route to responder</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.severity}>
                  <td><SeverityBadge value={r.severity} /></td>
                  <td>
                    {isAdmin ? (
                      <div className="btn-row" style={{ alignItems: "center", flexWrap: "nowrap" }}>
                        <input type="number" min="1" style={{ width: "6rem" }} aria-label={`${r.severity} response minutes`} value={r.responseMinutes} onChange={(e) => edit(r.severity, "responseMinutes", e.target.value)} />
                        <span className="muted small">min ({minutesLabel(Number(r.responseMinutes) || 0)})</span>
                      </div>
                    ) : minutesLabel(r.responseMinutes)}
                  </td>
                  <td>
                    {isAdmin ? (
                      <div className="btn-row" style={{ alignItems: "center", flexWrap: "nowrap" }}>
                        <input type="number" min="1" style={{ width: "6rem" }} aria-label={`${r.severity} resolution minutes`} value={r.resolutionMinutes} onChange={(e) => edit(r.severity, "resolutionMinutes", e.target.value)} />
                        <span className="muted small">min ({minutesLabel(Number(r.resolutionMinutes) || 0)})</span>
                      </div>
                    ) : minutesLabel(r.resolutionMinutes)}
                  </td>
                  <td>
                    {isAdmin ? (
                      <label style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
                        <input type="checkbox" checked={!!r.autoAssign} onChange={(e) => edit(r.severity, "autoAssign", e.target.checked)} /> {r.autoAssign ? "On" : "Off"}
                      </label>
                    ) : r.autoAssign ? "On" : "Off"}
                  </td>
                  {isAdmin && (
                    <td><button className="btn btn-sm btn-primary" disabled={saving === r.severity} onClick={() => save(r)}>{saving === r.severity ? "Saving..." : "Save"}</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
