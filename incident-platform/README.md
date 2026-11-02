# Cybersecurity Incident Management Platform (MERN)

- `server/`  Node + Express + MongoDB API (see server/README.md)
- `client/`  React + Vite frontend (see client/README.md)

server/.env is already filled in with the MongoDB Atlas connection. It contains a password:
do not upload this zip or the .env file anywhere public.

## Run it

Terminal 1 - backend:
```bash
cd server
npm install
npm run seed             # demo users + incidents (first run)
npm run dev              # http://localhost:5001
```

Terminal 2 - frontend:
```bash
cd client
npm install
npm run dev              # http://localhost:3001
```

Open http://localhost:3001 and sign in with analyst@example.com / Password@123
