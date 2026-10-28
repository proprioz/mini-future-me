import { DECORS } from './decors.ts';
import { POSES } from '../character/poses.ts';
import { trade } from '../trades/current.ts';
import type { Decor } from './decors.ts';
import type { Pose } from '../character/poses.ts';

// The decors and poses the trade offers for the poster (`trade().studio.decors` / `.poses`), in order:
// ids of the shared ones (decors.ts, poses.ts) or the trade's own objects. `trade().studio.unlocks`
// gives, by id, the domain of the job to win in the office first (an id of `trade().skills`); the
// others are free from the start.

function offer<T extends { id: string; skill?: string }>(list: (string | T)[], shared: T[]): T[] {
  const { unlocks = {} } = trade().studio;
  return list.map((entry) => {
    const option = typeof entry === 'string' ? shared.find((o) => o.id === entry) : entry;
    if (!option) throw new Error(`Option du studio inconnue : ${entry}`);
    return unlocks[option.id] ? { ...option, skill: unlocks[option.id] } : option;
  });
}

let offered: { trade: unknown; decors: Decor[]; poses: Pose[] } | null = null; // { trade, decors, poses }: the trade does not change until the page reloads

function options(): { decors: Decor[]; poses: Pose[] } {
  if (offered?.trade !== trade()) {
    offered = { trade: trade(), decors: offer(trade().studio.decors, DECORS), poses: offer(trade().studio.poses, POSES) };
  }
  return offered;
}

/** The trade's poster decors, each { id, label, draw, skill? }. */
export function studioDecors() {
  return options().decors;
}

/** The trade's poses, each a pose of poses.ts with `skill` when a domain unlocks it. */
export function studioPoses() {
  return options().poses;
}

/** What winning the domain `skill` unlocks, e.g. [{ kind: 'décor', label: 'Fête' }]. */
export function unlockedBy(skill: string) {
  return [
    ...studioDecors().map((decor) => ({ ...decor, kind: 'décor' })),
    ...studioPoses().map((pose) => ({ ...pose, kind: 'pose' })),
  ].filter((unlock) => unlock.skill === skill);
}
