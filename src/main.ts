// Fonts bundled from node_modules so the stand works offline.
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './style.css';
import { Game } from './game/Game.ts';
import { CharacterCreator } from './ui/CharacterCreator.ts';
import { ScanScreen } from './ui/ScanScreen.ts';
import { PosterStudio } from './ui/PosterStudio.ts';
import { WelcomeScreen } from './ui/WelcomeScreen.ts';
import { DEFAULT_LOOK, type Look } from './character/Character.ts';
import { kiosk } from './kiosk/kiosk.ts';
import { wonSkills } from './game/skills.ts';
import { enabledTrades, loadTrade } from './trades/index.ts';
import { setTrade } from './trades/current.ts';
import { logoSvg } from './ui/icons.ts';
import type { Trade } from './trades/types.ts';

/** Handle for poking at the game from the devtools / Playwright, in development only. */
export interface DevStudio {
  welcome: WelcomeScreen;
  scan: ScanScreen;
  creator: CharacterCreator;
  kiosk: typeof kiosk;
  trades: Trade[];
  /** Once the game has started. */
  game?: Game;
  posterStudio?: PosterStudio;
}

declare global {
  interface Window {
    studio: DevStudio;
  }
}

// On the stand, inactivity sends back to the welcome screen. In development only with ?borne, since
// it reloads the page (and would do so under the devtools).
kiosk.install(document.body, { idle: !import.meta.env.DEV || new URLSearchParams(location.search).has('borne') });

// The trades the stand shows: all loaded now, « Dans les coulisses » explains each one's job.
const trades = await Promise.all(enabledTrades().map(loadTrade));

const welcome = new WelcomeScreen(document.body, trades);
const scan = new ScanScreen(document.body);
const creator = new CharacterCreator(document.body);
// Handle for poking at the game from the devtools / Playwright.
if (import.meta.env.DEV) window.studio = { welcome, scan, creator, kiosk, trades };

const { start, trade } = await welcome.run();
setTrade(trade);
document.title = trade.title;
document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.href = `data:image/svg+xml,${encodeURIComponent(logoSvg(trade.icon))}`;
kiosk.startWatching();
let scanned: Partial<Look> | null = null;
if (start === 'photos') {
  // The file picker and the analysis need no touch: more time before "Tu es encore là ?".
  const done = kiosk.extend(150);
  scanned = await scan.run();
  done();
}
const look = await creator.edit({ ...DEFAULT_LOOK, ...scanned });

const game = new Game(document.getElementById('app')!, look);
const posterStudio = new PosterStudio(document.body);
game.start();
if (import.meta.env.DEV) Object.assign(window.studio, { game, posterStudio });

game.hud.onAction('look', async () => {
  game.stop();
  game.player.setLook(await creator.edit(game.player.look));
  game.start();
});

game.hud.onAction('poster', async () => {
  game.stop();
  game.hud.highlight('poster', false);
  const made = trade.creation.from(game.results);
  await posterStudio.open({ look: game.player.look, skills: wonSkills(game.done), made });
  game.start();
});
