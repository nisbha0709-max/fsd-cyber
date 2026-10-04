# IncidentDesk - React frontend

React 18 + Vite client for the Incident Management API (Express + MongoDB).

```bash
npm install
npm run dev        # http://localhost:3000
```

The dev server proxies `/api` and `/socket.io` to `http://localhost:5000`, so start the backend first.
For production hosting, copy `.env.example` to `.env` and set `VITE_API_URL` / `VITE_SOCKET_URL`, then `npm run build`.

## Pages

| Route | Who | What |
|---|---|---|
| /login | everyone | Sign in / create account |
| / | everyone | Dashboard: deadline strip, past-deadline list, charts, latest reports |
| /incidents | everyone | Search, filter (severity, status, type, quick views), pagination, live refresh |
| /incidents/new | admin, analyst | Report an incident with SLA hint and optional assignee |
| /incidents/:id | everyone | Details, status workflow, assignment, severity, notes, audit timeline, evidence |
| /sla | everyone (edit: admin) | View and edit SLA rules |
| /users | admin | Add team members, change roles, deactivate |

Buttons and forms follow the same role rules as the API; the server still enforces them.

## Live updates

The app opens a Socket.IO connection after sign-in. Lists and dashboards refresh on incident events,
and toasts appear for new incidents, assignments to you, escalations and missed responses.

## Structure

```
src/
  api/client.js          axios + token + error handling
  context/               Auth, Toast, Realtime (Socket.IO)
  components/            Layout, SlaMeter, Timeline, EvidencePanel, Modal, Badges
  pages/                 Login, Dashboard, Incidents, NewIncident, IncidentDetail, SlaSettings, Users
  utils/format.js        labels, dates, durations, workflow constants
  index.css              design tokens and styles
```
