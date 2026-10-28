import { defineConfig } from 'vitest/config';

// `pnpm test`: the game's rules and the trades' contract, in Node (tests/unit). The game in a browser
// is tested by Playwright (`pnpm test:e2e`, tests/e2e).
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
