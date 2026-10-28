// The trades ("filières") the game can show, one module each in its own folder. A trade brings its
// tasks for the office, its domains of the job, its work stations, the object the character holds on
// the poster and its texts (see mediamatique/index.ts and docs/adding-a-trade.md).
// What the welcome screen needs to offer the choice is here; the rest loads once a trade is chosen.

import type { IconName } from '../ui/iconPaths.ts';
import type { Trade, TradeEntry, TradeMeta, TradeModule } from './types.ts';

/** The game itself, whatever the trade: on the welcome screen when it offers several trades, and on the poster. */
export const GAME: { title: string; icon: IconName } = { title: 'Mini Future Me', icon: 'person-arms-spread' };

export const TRADES: TradeEntry[] = [
  {
    id: 'mediamatique',
    job: 'médiamaticien·ne',
    icon: 'film-slate',
    pitch: 'Photo, graphisme, réseaux sociaux',
    load: () => import('./mediamatique/index.ts'),
  },
];

/** "Médiamaticien·ne": the job with a capital, the trade's short name. */
const capitalized = (job: string) => `${job[0].toLocaleUpperCase('fr')}${job.slice(1)}`;

/**
 * The trades the stand shows, in order: `VITE_TRADES` (ids separated by commas, in .env.local), every
 * trade by default. `?filiere=<id>` in the URL keeps only that one, handy in development.
 */
export function enabledTrades(): TradeMeta[] {
  const forced = new URLSearchParams(location.search).get('filiere');
  const ids = forced ? [forced] : (import.meta.env.VITE_TRADES ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  const trades = ids.map((id) => TRADES.find((t) => t.id === id)).filter((t) => t !== undefined);
  if (trades.length < ids.length) console.warn(`Filière inconnue dans ${forced ? '?filiere' : 'VITE_TRADES'} : ${ids.join(', ')}`);
  // Each trade is named after the game and its job: "Mini Future Me Médiamaticien·ne".
  return (trades.length ? trades : TRADES).map((t) => ({ ...t, name: capitalized(t.job), title: `${GAME.title} ${capitalized(t.job)}` }));
}

// The photo scan at the start of a game: on unless VITE_SCAN is false (in .env.local), and each trade
// may turn it off with `scan: false` in its module. Without it, the visitor creates the avatar by hand.
const SCAN = !/^(false|0|off|non)$/i.test(import.meta.env.VITE_SCAN ?? '');

/** Whether visitors of `trade` (a loaded trade) may have their photos analysed. */
export function scanEnabled(trade: Pick<TradeModule, 'scan'>): boolean {
  return SCAN && trade.scan !== false;
}

/** Loads the module of `meta` (an entry of enabledTrades()), with its id, job, name and title. */
export async function loadTrade(meta: TradeMeta): Promise<Trade> {
  const { default: trade } = await meta.load();
  return { ...meta, ...trade };
}
