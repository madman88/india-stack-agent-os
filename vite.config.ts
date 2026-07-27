import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react],
  server: {
    proxy: {
      "/v1": {
        target: process.env.MOCK_API_TARGET ?? "http://localhost:8787",
        changeOrigin: true
      }
    }
  }
});
