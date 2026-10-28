import { defineConfig } from 'vite';

// In development, the poster API is served by the stand server (`pnpm server`, see server/index.ts),
// on port 3000 or STAND_PORT (the end-to-end tests run their own, see playwright.config.ts).
export default defineConfig({
  server: {
    proxy: { '/api': `http://localhost:${process.env.STAND_PORT ?? 3000}` },
  },
});
