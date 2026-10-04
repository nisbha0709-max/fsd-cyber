import { useCallback, useEffect, useState } from "react";
import api, { errMsg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { fmtDate, label } from "../utils/format";

const ROLES = ["admin", "analyst", "responder", "viewer"];
const ROLE_HELP = {
  admin: "Everything, including team, SLA rules and deleting incidents",
  analyst: "Report, edit, assign and close incidents; verify evidence",
  responder: "Work on assigned incidents; upload and download evidence",
  viewer: "Read-only access",
};

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "responder" });
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get("/users").then((r) => setUsers(r.data.data)).catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(u, body, message) {
    try {
      await api.patch(`/users/${u._id}`, body);
      toast.push(message, "success");
      load();
    } catch (e) {
      toast.push(errMsg(e), "error");
    }
  }

  async function create(e) {
    e.preventDefault();
    setFormError("");
    setBusy(true);
    try {
      await api.post("/users", form);
      toast.push(`${form.name} was added to the team`, "success");
      setShowNew(false);
      setForm({ name: "", email: "", password: "", role: "responder" });
      load();
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (error) return <div className="page"><div className="error-box">{error}</div></div>;
  if (!users) return <Spinner />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p>Add people and choose what each role can do.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>Add team member</button>
      </div>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th>Status</th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u._id === me._id;
                return (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 500 }}>{u.name}{self && <span className="muted"> (you)</span>}</td>
                    <td>{u.email}</td>
                    <td>
                      <select aria-label={`Role for ${u.name}`} style={{ width: "9rem" }} value={u.role} disabled={self} onChange={(e) => patch(u, { role: e.target.value }, `${u.name} is now ${label(e.target.value).toLowerCase()}`)}>
                        {ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
                      </select>
                    </td>
                    <td className="small">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : "Never"}</td>
                    <td>
                      <button className={`btn btn-sm ${u.isActive ? "" : "btn-primary"}`} disabled={self} onClick={() => patch(u, { isActive: !u.isActive }, u.isActive ? `${u.name} was deactivated` : `${u.name} was reactivated`)}>
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showNew && (
        <Modal title="Add team member" onClose={() => setShowNew(false)}>
          <form onSubmit={create}>
            {formError && <div className="error-box" role="alert">{formError}</div>}
            <div className="field">
              <label htmlFor="u-name">Full name</label>
              <input id="u-name" type="text" required minLength={2} value={form.name} onChange={set("name")} />
            </div>
            <div className="field">
              <label htmlFor="u-email">Email</label>
              <input id="u-email" type="email" required value={form.email} onChange={set("email")} />
            </div>
            <div className="field">
              <label htmlFor="u-pass">Temporary password</label>
              <input id="u-pass" type="password" required minLength={8} value={form.password} onChange={set("password")} autoComplete="new-password" />
              <span className="hint">At least 8 characters. They can change it after signing in.</span>
            </div>
            <div className="field">
              <label htmlFor="u-role">Role</label>
              <select id="u-role" value={form.role} onChange={set("role")}>
                {ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
              </select>
              <span className="hint">{ROLE_HELP[form.role]}</span>
            </div>
            <div className="btn-row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Adding..." : "Add team member"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
