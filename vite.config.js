import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:3000" }
  },
  build: {
    target: ["es2020", "chrome80", "firefox78", "safari14"],
    minify: "esbuild",
    modulePreload: {
      polyfill: false,
      resolveDependencies: () => [],
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react-router")) {
            return "router";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react-vendor";
          }
          if (id.includes("Bot.jsx")) {
            return "bot";
          }
          if (id.includes("Privacy.jsx") || id.includes("Accessibility.jsx")) {
            return "pages";
          }
          if (id.includes("/pages/")) {
            return "landing-pages";
          }
        },
      },
    },
  },
  esbuild: {
    drop: ["console", "debugger"],
  },
});
