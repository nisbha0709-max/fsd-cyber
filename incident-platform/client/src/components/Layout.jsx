import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { label } from "../utils/format";

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 12 84 26v26c0 19-14 32-34 38C30 84 16 71 16 52V26z" fill="none" stroke="#ff6b4a" strokeWidth="8" />
      <path d="M36 50h10l5-12 8 24 5-12h4" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const canCreate = ["admin", "analyst"].includes(user.role);

  // close the mobile menu after navigating
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    if (open) setOpen(false);
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <Logo />
          <strong>IncidentDesk</strong>
        </div>
        <nav className="nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/incidents" end>Incidents</NavLink>
          {canCreate && <NavLink to="/incidents/new">Report incident</NavLink>}
          <div className="nav-gap" />
          <NavLink to="/sla">SLA rules</NavLink>
          {user.role === "admin" && <NavLink to="/users">Team</NavLink>}
        </nav>
        <div className="side-user">
          <div className="name">{user.name}</div>
          <div className="role">{label(user.role)}</div>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>

      <div className="main">
        <div className="mobile-bar">
          <button onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">&#9776;</button>
          <strong>IncidentDesk</strong>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
