import { expect, test, type Page } from '@playwright/test';
import type { MiniGame } from '../../src/minigames/MiniGame.ts';

// The game in a browser, for every trade: a whole visit from the welcome screen to the poster sent to
// the stand server, then the kiosk reset. The mini-games themselves are won by calling `end(true)`
// (each trade may test its own gestures); what is checked here is what every trade shares.
//
// Every request that leaves the PC is blocked and counted: the stand may have no Internet, and no image
// of a face may leave the PC (AGENTS.md). Any console error fails the test.

declare global {
  interface Window {
    /** The mini-game on screen, recorded by the test. */
    miniGame?: MiniGame;
  }
}

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Blocks what leaves the PC, collects errors; check them with `expectClean()` at the end. */
function watch(page: Page) {
  const outside: string[] = [];
  const errors: string[] = [];
  page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (LOCAL.has(url.hostname) || url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
    outside.push(url.href);
    return route.abort();
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // MediaPipe's runtime logs its start on the error output ("INFO: Created TensorFlow Lite…").
    if (message.type() === 'error' && !message.text().startsWith('INFO:')) errors.push(message.text());
  });
  return {
    expectClean() {
      expect(outside, 'requests leaving the PC').toEqual([]);
      expect(errors, 'console errors').toEqual([]);
    },
  };
}

/** Starts from the welcome screen, once it listens (the page may still be loading), until `next` shows. */
async function play(page: Page, next: ReturnType<Page['locator']>) {
  await expect(async () => {
    await page.locator('.welcome-play').click();
    await expect(next).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

/** From the welcome screen to the office, creating the avatar by hand. */
async function startByHand(page: Page, trade: string) {
  await page.goto(`/?filiere=${trade}`);
  const manual = page.locator('[data-choice="manual"]:visible');
  // With the scan, a consent card first; without it, straight to the avatar creator.
  const done = page.locator('[data-action="done"]:visible');
  await play(page, manual.or(done).first());
  if (await manual.isVisible()) await manual.click();
  await done.click();
  await page.waitForFunction(() => window.studio.game);
}

/** Ids of every trade of src/trades/index.ts, loaded by Vite like the game does. */
async function tradeIds(page: Page) {
  await page.goto('/');
  return page.evaluate(async () => (await import('/src/trades/index.ts')).TRADES.map((t) => t.id));
}

/** Records every mini-game that opens, so the test can end it. */
async function recordMiniGames(page: Page) {
  await page.evaluate(async () => {
    const { MiniGame } = await import('/src/minigames/MiniGame.ts');
    const run = MiniGame.prototype.run;
    MiniGame.prototype.run = function (root) {
      window.miniGame = this;
      return run.call(this, root);
    };
  });
}

test('a whole visit for every trade, offline', async ({ page }) => {
  const checks = watch(page);
  const ids = await tradeIds(page);
  test.setTimeout(ids.length * 120_000); // the A4 poster is rendered at 300 dpi, slow without a GPU
  for (const id of ids) {
    await test.step(`filière ${id}`, async () => {
      await startByHand(page, id);
      await recordMiniGames(page);
      const tasks = await page.evaluate(() => window.studio.trades[0].tasks.map(({ id, win }) => ({ id, win })));
      const skills = await page.evaluate(() => window.studio.trades[0].skills.length);

      for (const task of tasks) {
        await page.evaluate((id) => void window.studio.game!.openTask(id), task.id);
        await expect(page.locator('.minigame .mg-play')).toBeVisible();
        await page.evaluate(() => window.miniGame!.end(true));
        await expect(page.locator('.mg-result h2')).toHaveText(task.win);
        await page.locator('.mg-result [data-action="back"]').click();
        await expect(page.locator('.minigame')).toHaveCount(0);
      }
      expect(await page.evaluate(() => window.studio.game!.done.size)).toBe(tasks.length);
      await expect(page.locator('.hud .skill-badge.on')).toHaveCount(skills);

      // The poster: studio, then sent to the stand server for the QR code.
      await page.locator('.hud [data-action="poster"]').click();
      const sent = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/posters' && r.request().method() === 'POST');
      await page.locator('[data-action="finish"]').click();
      expect((await sent).ok()).toBe(true);
      await expect(page.locator('.export-qr canvas')).toBeVisible();

      // The kiosk reset brings the next visitor back to the welcome screen.
      const done = page.locator('[data-action="done"].export-done');
      await done.click();
      await expect(done).toHaveText('Sûr·e ? Touche encore');
      await done.click();
      await page.waitForEvent('load');
      await expect(page.locator('.welcome-play')).toBeVisible();
    });
  }
  checks.expectClean();
});

test('every station of every trade can be reached', async ({ page }) => {
  const checks = watch(page);
  for (const id of await tradeIds(page)) {
    await test.step(`filière ${id}`, async () => {
      await startByHand(page, id);
      const unreachable = await page.evaluate(() => {
        const { grid, interactables } = window.studio.game!.room;
        const tiles = interactables.map((item) => ({ id: item.id, x: item.useTile.x, z: item.useTile.z }));
        return tiles.flatMap((from) => tiles.filter((to) => to !== from && !grid.findPath(from, to)).map((to) => `${from.id} → ${to.id}`));
      });
      expect(unreachable).toEqual([]);
      // Every task is played at a station of the office.
      const missing = await page.evaluate(() => {
        const stations = new Set(window.studio.game!.room.interactables.map((item) => item.id));
        return window.studio.trades[0].tasks.filter((task) => !stations.has(task.item)).map((task) => task.id);
      });
      expect(missing).toEqual([]);
    });
  }
  checks.expectClean();
});

test('the photo scan loads its models from the PC', async ({ page }) => {
  const checks = watch(page);
  const models: string[] = [];
  page.on('requestfinished', (request) => {
    if (/\/(mediapipe|face-api)\//.test(request.url())) models.push(request.url());
  });
  const photo = await noFace(page);
  await page.goto('/');
  const photos = page.locator('[data-choice="photos"]:visible');
  await play(page, photos);
  await photos.click();
  // A photo with no face in it, as the front photo: everything loads, then the game asks for another.
  await page.locator('[data-slot="front"] input').setInputFiles({ name: 'face.png', mimeType: 'image/png', buffer: photo });
  await page.locator('[data-action="go"]').click();
  await expect(page.getByText('Je ne trouve pas de visage')).toBeVisible({ timeout: 30_000 });
  expect(models.some((url) => url.endsWith('.task'))).toBe(true);
  checks.expectClean();
});

/** A PNG of a sky-blue gradient. */
async function noFace(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(480, 640);
    const g = canvas.getContext('2d')!;
    const gradient = g.createLinearGradient(0, 0, 0, 640);
    gradient.addColorStop(0, '#8fe3d6');
    gradient.addColorStop(1, '#5aa9ff');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 480, 640);
    return [...new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer())];
  });
  return Buffer.from(bytes);
}

for (const [width, height] of [[1280, 620], [1920, 1080], [3440, 1440]]) {
  test(`everything fits on a ${width}×${height} screen`, async ({ page }) => {
    const checks = watch(page);
    await page.setViewportSize({ width, height });
    const offScreen = () => page.evaluate(() => [...document.querySelectorAll('button, [role="dialog"]')]
      .filter((el) => el.checkVisibility())
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1;
      })
      .map((el) => el.outerHTML.slice(0, 80)));

    await page.goto('/');
    await expect(page.locator('.welcome-play')).toBeVisible();
    await expect.poll(offScreen, { message: 'welcome' }).toEqual([]);
    await startByHand(page, (await tradeIds(page))[0]);
    await expect(page.locator('.hud')).toBeVisible();
    await expect.poll(offScreen, { message: 'office' }).toEqual([]); // once the HUD has slid in
    checks.expectClean();
  });
}
