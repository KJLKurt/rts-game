import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { buildIdentifier } from "./scripts/build-identity";
export default defineConfig({
  define: { __FRONTIER_BUILD_ID__: JSON.stringify(buildIdentifier(fileURLToPath(new URL('.', import.meta.url)))) },
  base: "/rts-game/",
  server: { host: "0.0.0.0", port: 4173 },
  preview: { host: "0.0.0.0", port: 4173 },
  build: { target: "es2022", sourcemap: true },
  test: { include: ["tests/**/*.test.ts"] },
} as any);
