import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PosterStore } from '../../server/PosterStore.ts';

// The stand server keeps each poster in memory only, for a while (AGENTS.md: posters erased after
// about 30 min), and never more than `max` of them.

const poster = (n: number) => ({ image: Buffer.from(`poster ${n}`), type: 'image/png', fileName: `affiche-${n}.png`, trade: { title: 'Mini Future Me Médiamaticien·ne', job: 'médiamaticien·ne' } });
const MINUTE = 60_000;

let store: PosterStore;
beforeEach(() => {
  vi.useFakeTimers();
  store = new PosterStore({ ttl: 30 * MINUTE, max: 3 });
});
afterEach(() => {
  store.clear();
  vi.useRealTimers();
});

test('a poster is reachable by its id, then forgotten after the ttl', () => {
  const id = store.add(poster(1));
  expect(id).toMatch(/^[\w-]{8}$/);
  expect(store.get(id)?.fileName).toBe('affiche-1.png');
  expect(store.minutesLeft(store.get(id)!)).toBe(30);
  vi.advanceTimersByTime(29 * MINUTE);
  expect(store.minutesLeft(store.get(id)!)).toBe(1);
  vi.advanceTimersByTime(2 * MINUTE);
  expect(store.get(id)).toBeNull();
});

test('the sweeper erases expired posters nobody asks for', () => {
  store.add(poster(1));
  vi.advanceTimersByTime(31 * MINUTE);
  expect(store.posters.size).toBe(0);
});

test('never more than max posters: the oldest go first', () => {
  const ids = [1, 2, 3, 4].map((n) => store.add(poster(n)));
  expect(store.get(ids[0])).toBeNull();
  expect(ids.slice(1).map((id) => store.get(id)?.fileName)).toEqual(['affiche-2.png', 'affiche-3.png', 'affiche-4.png']);
  expect(new Set(ids).size).toBe(4);
});

test('unknown ids', () => {
  expect(store.get('nope')).toBeNull();
});
