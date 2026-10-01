import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/auth",
  outputDir: "test-results/auth",
  workers: 1,
  timeout: 30000,
  use: { baseURL: "http://localhost:3107", browserName: "chromium", trace: "off", screenshot: "off", video: "off" },
  webServer: {
    command: "node --require ./tests/auth-mock.cjs node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3107",
    url: "http://localhost:3107",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
