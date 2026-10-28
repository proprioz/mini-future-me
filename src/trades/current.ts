// The trade the visitor plays, chosen on the welcome screen (see index.ts). Set once per visitor:
// the kiosk reset reloads the page.
import type { Trade } from './types.ts';

let current: Trade | null = null;

export function setTrade(trade: Trade) {
  current = trade;
}

/** The trade being played (its module, see mediamatique/index.ts for what it holds). */
export function trade(): Trade {
  if (!current) throw new Error('No trade chosen yet: call setTrade() first');
  return current;
}
