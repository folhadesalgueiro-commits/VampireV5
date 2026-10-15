import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const path = join(mkdtempSync(join(tmpdir(), "v5-browser-")), "cronica.sqlite");
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 45000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3101",
    headless: true,
    launchOptions: {
      executablePath: process.env.V5_BROWSER || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm start",
    env: { V5_DB_PATH: path, PORT: "3101" },
    url: "http://127.0.0.1:3101/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
