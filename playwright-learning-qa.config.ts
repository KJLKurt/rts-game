import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Bounded learning/layout gate. Never retries failures or cuts off remaining identities. */
export default defineConfig({
  ...base,
  testMatch: /\/(learning-first-move|learning|guide-clearance|hud-collisions|learning-recovery)\.spec\.ts$/,
  projects: base.projects!.filter(project => project.name !== "pwa"),
  retries: 0,
  maxFailures: 0,
  workers: 2,
  globalTimeout: 10 * 60_000,
  use: { ...base.use, trace: "retain-on-failure", screenshot: "only-on-failure", video: "off" },
  outputDir: "test-results-learning",
  reporter: [["list"], ["json", { outputFile: "learning-identity-ledger.json" }],
    ["html", { open: "never", outputFolder: "learning-report" }]],
});
