import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Der dist-Ordner wird committed und vom Backend (FRONTEND_DIST) direkt
// ausgeliefert - der LXC-Container braucht dafür kein Node.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Dev-Server leitet API und Übungsmedien an das lokal laufende Backend durch
      "/api": "http://127.0.0.1:8080",
      "/media": "http://127.0.0.1:8080",
    },
  },
  build: {
    outDir: "dist",
  },
});
