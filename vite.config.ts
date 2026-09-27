import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// The skin talks ONLY to the gateway, at its own origin: in dev Vite proxies /api to the gateway so the httpOnly
// session cookies are first-party (P3-04 cookie mode). The gateway resolves the skin from the Host it receives —
// the laptop stack's `skin-test` serves 127.0.0.1 and localhost — so changeOrigin hands it the target's host.
// The gateway's published /openapi/v1.json is what `npm run api:sync` generates the client from (P3-26).
const API_TARGET = process.env.VITE_API_TARGET ?? "http://127.0.0.1:5000";

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    proxy: {
      // ws: the balance hub (P3-28) upgrades to a WebSocket under /api/v1/hubs.
      "/api": { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
