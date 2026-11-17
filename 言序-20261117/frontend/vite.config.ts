import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: ["lingua.exhan.dpdns.org", "localhost", "127.0.0.1"],
    proxy: {
      "/api": {
        target: process.env.API_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts: ["lingua.exhan.dpdns.org", "localhost", "127.0.0.1"],
  },
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 2000 },
});
