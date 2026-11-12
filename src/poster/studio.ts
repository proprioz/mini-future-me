import { DECORS } from './decors.ts';
import { POSES } from '../character/poses.ts';
import { trade } from '../trades/current.ts';
import type { Decor } from './decors.ts';
import type { Pose } from '../character/poses.ts';

// The decors and poses the trade offers for the poster (`trade().studio.decors` / `.poses`), in order:
// ids of the shared ones (decors.ts, poses.ts) or the trade's own objects. All of them are free from
// the start: the poster can be made at any time of the visit.

function offer<T extends { id: string }>(list: (string | T)[], shared: T[]): T[] {
  return list.map((entry) => {
    const option = typeof entry === 'string' ? shared.find((o) => o.id === entry) : entry;
    if (!option) throw new Error(`Option du studio inconnue : ${entry}`);
    return option;
  });
}

let offered: { trade: unknown; decors: Decor[]; poses: Pose[] } | null = null; // { trade, decors, poses }: the trade does not change until the page reloads

function options(): { decors: Decor[]; poses: Pose[] } {
  if (offered?.trade !== trade()) {
    offered = { trade: trade(), decors: offer(trade().studio.decors, DECORS), poses: offer(trade().studio.poses, POSES) };
  }
  return offered;
}

/** The trade's poster decors, each { id, label, draw }. */
export function studioDecors() {
  return options().decors;
}

/** The trade's poses, each a pose of poses.ts. */
export function studioPoses() {
  return options().poses;
}
