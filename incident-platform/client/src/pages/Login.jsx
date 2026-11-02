import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api/client";

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const from = (location.state && location.state.from) || "/";
  if (user) return <Navigate to={from} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || errMsg(err);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-art">
        <div className="brand" style={{ padding: 0 }}>
          <svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 12 84 26v26c0 19-14 32-34 38C30 84 16 71 16 52V26z" fill="none" stroke="#ff6b4a" strokeWidth="8" />
            <path d="M36 50h10l5-12 8 24 5-12h4" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <strong>IncidentDesk</strong>
        </div>
        <div>
          <h1>Every incident, from first report to closed case.</h1>
          <p>Report, triage and resolve security incidents against severity-based deadlines, with evidence that stays verifiable.</p>
        </div>
        <ul>
          <li>Deadlines set by severity, escalated automatically</li>
          <li>Evidence hashed on upload, every access logged</li>
          <li>One audit trail per incident</li>
        </ul>
      </section>

      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <h2>{mode === "login" ? "Sign in" : "Create your account"}</h2>
          {error && <div className="error-box" role="alert">{error}</div>}

          {mode === "register" && (
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" type="text" value={form.name} onChange={set("name")} required minLength={2} autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={set("password")}
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {mode === "register" && <span className="hint">At least 8 characters.</span>}
          </div>

          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <p className="switch">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button type="button" className="link-btn" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>

        </form>
      </section>
    </div>
  );
}
