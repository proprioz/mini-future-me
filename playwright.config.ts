import { defineConfig } from '@playwright/test';

// `pnpm test:e2e`: the game played in a browser (tests/e2e), against its own Vite server and stand
// server, on ports of their own so it runs next to `pnpm dev` and `pnpm server`.
// Every test plays in the installed Microsoft Edge by default, the browser of the booth (no download, like
// the Playwright MCP server of .mcp.json). Without Edge, and in CI: Playwright's own Chromium, then
// `E2E_BROWSER=chromium pnpm test:e2e`. The tests tagged @target (the target screen of AGENTS.md: a
// landscape tablet from 1180 px wide) also play in WebKit (Safari) and Firefox. Install Playwright's
// browsers once with `pnpm exec playwright install chromium webkit firefox`; on Linux without a screen,
// `xvfb-run pnpm test:e2e` (see the Firefox project).
const CHROMIUM = Boolean(process.env.CI) || process.env.E2E_BROWSER === 'chromium';
const GAME_PORT = 5199;
const STAND_PORT = 3199;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${GAME_PORT}`,
    viewport: { width: 1280, height: 620 },
    // The game's animations stop (see prefers-reduced-motion in src/style.css): buttons hold still to be clicked.
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: CHROMIUM ? 'chromium' : 'edge',
      use: {
        browserName: 'chromium',
        channel: CHROMIUM ? undefined : 'msedge',
        // WebGL without a GPU, in CI (the 300 dpi poster then takes a while to render).
        launchOptions: process.env.CI ? { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } : {},
      },
    },
    { name: 'webkit', use: { browserName: 'webkit' }, grep: /@target/ },
    // Headless Firefox has no WebGL on Linux: there, it opens a window (in CI, on xvfb-run's screen).
    { name: 'firefox', use: { browserName: 'firefox', headless: process.platform !== 'linux' }, grep: /@target/ },
  ],
  webServer: [
    {
      // Not through pnpm, which would not pass on the signal that stops the server.
      command: `node node_modules/vite/bin/vite.js --port ${GAME_PORT} --strictPort`,
      url: `http://localhost:${GAME_PORT}`,
      env: { STAND_PORT: String(STAND_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node server/index.ts',
      url: `http://localhost:${STAND_PORT}/fonts/fredoka.woff2`,
      env: { PORT: String(STAND_PORT), POSTER_TTL_MINUTES: '5' },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
