import { defineConfig } from '@playwright/test';

// Runs against the local Supabase stack (`supabase start` and `supabase functions serve`)
// and the exported web app in ../mobile/dist. See the README for running it locally.
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8099',
    viewport: { width: 390, height: 844 },
    locale: 'en-US',
    geolocation: { latitude: 39.4699, longitude: -0.3763 },
    permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: [
    { command: 'node serve.mjs ../mobile/dist 8099', url: 'http://localhost:8099', reuseExistingServer: true },
    { command: 'node oembed-stub.mjs', port: 8787, reuseExistingServer: true },
  ],
});
