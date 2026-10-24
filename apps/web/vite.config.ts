import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // TanStack's devtools under pnpm dev; removed from the build. Must come first.
    devtools(),
    // Writes src/gen/routeTree.gen.ts from the files in src/routes (tsr.config.json).
    tanstackRouter({ autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  // Assets stay files with a hash in their name, never inlined: iOS ignores a
  // Home Screen icon given as a data URL, and a new logo gets a new address
  // that no cache (Safari's icons, Cloudflare) can answer with the old one.
  build: { assetsInlineLimit: 0 },
  // In dev the service runs on its own port: Vite forwards API calls to it.
  server: {
    proxy: { "/api": "http://localhost:3000", "/frames": "http://localhost:3000" },
  },
});
