import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  envPrefix: ["VITE_", "OFFICIAL_"],
  plugins: [react()],
  optimizeDeps: {
    include: ["mediasoup-client"]
  },
  server: {
    port: 5173,
    allowedHosts: ["opencom.online"]
  }
});
