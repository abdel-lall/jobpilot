import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/health": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
