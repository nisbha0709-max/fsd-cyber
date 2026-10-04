# Cybersecurity Incident Management Platform - Backend (MERN)

Node.js + Express + MongoDB (Mongoose) REST API with JWT auth, role-based access,
severity-based SLA tracking, forensic evidence with chain of custody, a dashboard
stats endpoint, and real-time updates over Socket.IO.

## Setup

```bash
npm install
cp .env.example .env      # then edit JWT_SECRET and MONGO_URI
npm run seed              # optional: demo users + incidents
npm run dev               # http://localhost:5000
```

Needs Node 18+ and a running MongoDB (local or Atlas).
Seeded accounts (password `Password@123`): admin@, analyst@, responder1@, responder2@, viewer@ `example.com`.

## Roles

| Role | Can do |
|---|---|
| viewer | Read incidents, dashboard, evidence metadata |
| responder | + change status of incidents assigned to them, add notes, upload/download evidence, tag |
| analyst | + create/edit incidents, assign anyone, change any status, close, verify evidence integrity |
| admin | + manage users, edit SLA rules, delete incidents (without evidence), reopen closed ones |

The first account registered becomes **admin**; later public sign-ups are **analysts**
(set `ALLOW_PUBLIC_REGISTRATION=false` to disable sign-up once the admin exists).

## Incident lifecycle

`open -> in_progress -> resolved -> closed` (also `in_progress -> open`, `resolved -> in_progress`, `closed -> in_progress` for admins).
Resolving needs a resolution summary (`note`). Every change is appended to `history` (audit trail).

**Auto-routing:** if the SLA rule for the severity has `autoAssign: true` (default for critical and high),
a new incident goes to the active responder with the fewest open incidents.
**SLA:** each severity has `responseMinutes` and `resolutionMinutes`. A cron job runs every minute and
escalates overdue incidents (`escalated: true`) and flags response breaches.

## API

All routes except register/login/health need `Authorization: Bearer <token>`.

| Method | Route | Roles | Purpose |
|---|---|---|---|
| POST | /api/auth/register | public | Create account |
| POST | /api/auth/login | public | Get JWT |
| GET | /api/auth/me | any | Current user |
| PATCH | /api/auth/password | any | Change own password |
| GET | /api/users | admin, analyst | List users (`?role=responder&active=true`) |
| POST | /api/users | admin | Create user with a role |
| PATCH | /api/users/:id | admin | Change name / role / isActive |
| GET | /api/sla | any | SLA rules |
| PUT | /api/sla/:severity | admin | Update rule |
| POST | /api/incidents | admin, analyst | Report incident |
| GET | /api/incidents | any | List + filter + paginate |
| GET | /api/incidents/:id | any | Detail + audit trail + evidence list |
| PATCH | /api/incidents/:id | admin, analyst | Edit fields / severity |
| PATCH | /api/incidents/:id/assign | admin, analyst | `{ "assignedTo": userId or null }` |
| PATCH | /api/incidents/:id/status | admin, analyst, responder | `{ "status", "note" }` |
| POST | /api/incidents/:id/notes | admin, analyst, responder | `{ "note" }` |
| DELETE | /api/incidents/:id | admin | Only if it has no evidence |
| POST | /api/incidents/:id/evidence | admin, analyst, responder | multipart: `files` (up to 10), `tags`, `description` |
| GET | /api/incidents/:id/evidence | any | Evidence list |
| GET | /api/evidence/:id | any | Metadata + custody log (logs a "viewed" entry) |
| GET | /api/evidence/:id/custody | any | Chain of custody |
| GET | /api/evidence/:id/download | admin, analyst, responder | Re-hashes first; blocks tampered files |
| POST | /api/evidence/:id/verify | admin, analyst | Integrity check |
| PATCH | /api/evidence/:id/tags | admin, analyst, responder | `{ "add": [], "remove": [] }` |
| GET | /api/dashboard/stats | any | Counts, SLA stats, last 7 days, recent |

List filters: `severity=critical,high` `status=open` `type=phishing` `assignedTo=me` `unassigned=true`
`overdue=true` `escalated=true` `search=text` `sort=-createdAt|resolutionDueAt` `page` `limit`.

## Real-time (Socket.IO)

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:5000", { auth: { token } });
socket.on("incident:created", ...);   socket.on("incident:updated", ...);
socket.on("incident:assigned", ...);  // only to the assignee
socket.on("incident:escalated", ...); socket.on("incident:response_breached", ...);
socket.on("incident:deleted", ...);
```

## Quick test (curl)

```bash
TOKEN=$(curl -s -X POST localhost:5000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"analyst@example.com","password":"Password@123"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")

curl -X POST localhost:5000/api/incidents -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Malware on HR laptop","description":"AV flagged a trojan on HR-LT-04","type":"malware","severity":"high"}'

curl -X POST localhost:5000/api/incidents/<ID>/evidence -H "Authorization: Bearer $TOKEN" \
  -F "files=@./sample.log" -F "tags=logs,endpoint"
```

## Project structure

```
server.js            app + middleware + boot
realtime.js          Socket.IO (JWT-authenticated)
config/              db connection, upload path
models/              User, Incident, Evidence, SlaRule, Counter
controllers/         auth, user, incident, evidence, dashboard, sla
routes/              one router per resource
middleware/          auth + roles, uploads, sanitize, validation, errors
services/            incident creation, SLA deadlines, auto-routing
jobs/slaChecker.js   cron: escalation + response-breach flags
utils/               helpers, constants, hashing, seed script
```

## Design notes

- Evidence is hashed (SHA-256) on upload; every view / download / verify / tag is logged with user, time and IP.
  Downloads re-hash the file first and are refused if it no longer matches.
- Evidence cannot be deleted through the API, and incidents with evidence cannot be deleted (chain of custody).
- Uploaded files are stored under random names; originals are kept only in the database.
- Security: helmet, CORS allow-list, rate-limited auth, bcrypt (cost 12), NoSQL-operator sanitising, input validation.
