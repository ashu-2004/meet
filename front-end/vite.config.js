import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3004",
        changeOrigin: true,
        secure: false,
      },
      "/fastapi": {
        target: "http://localhost:8004",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/fastapi/, ""),
      },
    },
  },
});
