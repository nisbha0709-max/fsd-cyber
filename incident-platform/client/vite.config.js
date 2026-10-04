import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server runs on :3000 (matches CLIENT_URL in the backend .env)
// and proxies API + Socket.IO traffic to the Express server on :5000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:5000",
      "/socket.io": { target: "http://localhost:5000", ws: true },
    },
  },
});
