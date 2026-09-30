import fs from "fs"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Where /api requests go in development.
// Inside docker compose the backend is reachable by its service name;
// running `npm run dev` directly on your machine, it is on localhost.
const apiTarget =
  process.env.API_PROXY_TARGET ||
  (fs.existsSync("/.dockerenv") ? "http://backend:8000" : "http://localhost:8000")

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Keep the browser's Host header (localhost:5173): Django's
      // ALLOWED_HOSTS is empty, which with DEBUG=True only accepts localhost.
      "/api": { target: apiTarget, changeOrigin: false },
    },
  },
})
