# Cybersecurity Incident Management Platform (MERN)

- `server/`  Node + Express + MongoDB API (see server/README.md)
- `client/`  React + Vite frontend (see client/README.md)

## Run it

Terminal 1 - backend (needs MongoDB running or an Atlas URI in server/.env):
```bash
cd server
npm install
cp .env.example .env     # set JWT_SECRET and MONGO_URI
npm run seed             # demo users + incidents
npm run dev              # http://localhost:5000
```

Terminal 2 - frontend:
```bash
cd client
npm install
npm run dev              # http://localhost:3000
```

Open http://localhost:3000 and sign in with analyst@example.com / Password@123
(admin@, responder1@, responder2@ and viewer@example.com use the same password).
