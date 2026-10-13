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
  // In dev the service runs on its own port: Vite forwards API calls to it.
  server: {
    proxy: { "/api": "http://localhost:3000", "/frames": "http://localhost:3000" },
  },
});
