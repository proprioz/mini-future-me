import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

/**
 * The game's version, shown on the welcome screen and in « Dans les coulisses » (src/ui/version.ts):
 * package.json's version, the last commit and its date, or the build time when the game is not a git clone.
 */
function build() {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  try {
    const [commit, date] = execSync('git log -1 --format=%h%n%cI', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n');
    return { version, commit, date };
  } catch {
    return { version, commit: '', date: new Date().toISOString() };
  }
}

// In development, the poster API is served by the stand server (`pnpm server`, see server/index.ts),
// on port 3000 or STAND_PORT (the end-to-end tests run their own, see playwright.config.ts).
export default defineConfig({
  define: { __BUILD__: JSON.stringify(build()) },
  server: {
    proxy: { '/api': `http://localhost:${process.env.STAND_PORT ?? 3000}` },
  },
});
