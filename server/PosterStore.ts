import { randomBytes } from 'node:crypto';
import type { PosterTrade } from './phonePages.ts';

export interface Poster {
  image: Buffer;
  type: string;
  fileName: string;
  trade: PosterTrade;
  created: number;
}

/**
 * Finished posters, kept in memory only (never written to disk) and forgotten after `ttl` ms, or
 * when the server stops. Each one is reachable by a short random id, the one in the QR code.
 */
export class PosterStore {
  ttl: number;
  max: number;
  posters: Map<string, Poster>;
  sweeper: NodeJS.Timeout;

  constructor({ ttl, max }: { ttl: number; max: number }) {
    this.ttl = ttl;
    this.max = max;
    this.posters = new Map(); // id → { image, type, fileName, trade, created }
    this.sweeper = setInterval(() => this.sweep(), 30_000);
    this.sweeper.unref();
  }

  add({ image, type, fileName, trade }: Omit<Poster, 'created'>): string {
    // Hard cap on memory: drop the oldest ones first (a Map keeps insertion order).
    while (this.posters.size >= this.max) this.posters.delete(this.posters.keys().next().value!);
    let id: string;
    do id = randomBytes(6).toString('base64url'); while (this.posters.has(id));
    this.posters.set(id, { image, type, fileName, trade, created: Date.now() });
    return id;
  }

  get(id: string): Poster | null {
    const poster = this.posters.get(id);
    if (poster && Date.now() - poster.created > this.ttl) {
      this.posters.delete(id);
      return null;
    }
    return poster ?? null;
  }

  /** Minutes left before the poster is erased. */
  minutesLeft(poster: Poster): number {
    return Math.max(1, Math.ceil((poster.created + this.ttl - Date.now()) / 60_000));
  }

  sweep() {
    for (const [id, poster] of this.posters) {
      if (Date.now() - poster.created > this.ttl) this.posters.delete(id);
    }
  }

  clear() {
    this.posters.clear();
  }
}
