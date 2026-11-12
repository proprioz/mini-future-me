import { beforeAll, describe, expect, test } from 'vitest';
import { TRADES } from '../../src/trades/index.ts';
import { setTrade } from '../../src/trades/current.ts';
import type { Trade, TradeModule } from '../../src/trades/types.ts';
import { MiniGame } from '../../src/minigames/MiniGame.ts';
import { DECORS } from '../../src/poster/decors.ts';
import { POSES } from '../../src/character/poses.ts';
import { ICON_PATHS } from '../../src/ui/iconPaths.ts';
import { skillById, skillOf, skillProgress } from '../../src/game/skills.ts';
import { studioDecors, studioPoses } from '../../src/poster/studio.ts';

// The contract of docs/adding-a-trade.md, checked on every trade of src/trades/index.ts: what the
// types can't tell (ids that must match each other, a domain for every task…). The stations are
// checked in the browser (tests/e2e), since building them needs a canvas.

const ids = (list: { id: string }[]) => list.map((item) => item.id);
const idOf = (entry: string | { id: string }) => (typeof entry === 'string' ? entry : entry.id);

describe.each(TRADES)('filière $id', (entry) => {
  let trade: TradeModule;
  beforeAll(async () => {
    trade = (await entry.load()).default;
  });

  test('its entry', () => {
    expect(entry.id).toMatch(/^[a-z0-9-]+$/);
    expect(entry.job[0]).toBe(entry.job[0].toLocaleLowerCase('fr'));
    expect(ICON_PATHS).toHaveProperty(entry.icon);
    expect(entry.pitch).not.toBe('');
  });

  test('tasks', () => {
    expect(trade.tasks.length).toBeGreaterThan(0);
    expect(new Set(ids(trade.tasks)).size).toBe(trade.tasks.length);
    for (const task of trade.tasks) {
      expect(task.Game.prototype, task.id).toBeInstanceOf(MiniGame);
      expect(ICON_PATHS, task.id).toHaveProperty(task.icon);
      for (const text of [task.title, task.where, task.brief, task.win, task.fact]) {
        expect(text.trim(), task.id).not.toBe('');
        expect(text, task.id).not.toContain('\n'); // the bare minimum of text: one line each
      }
    }
  });

  test('domains of the job', () => {
    const tasks = ids(trade.tasks);
    expect(new Set(ids(trade.skills)).size).toBe(trade.skills.length);
    for (const skill of trade.skills) {
      expect(ICON_PATHS, skill.id).toHaveProperty(skill.icon);
      expect(skill.tasks.length, skill.id).toBeGreaterThan(0);
      for (const id of skill.tasks) expect(tasks, `${skill.id} → ${id}`).toContain(id);
    }
    // Every task trains a domain (its win screen shows it), and the final one is the whole order.
    setTrade({ ...entry, name: '', title: '', ...trade } as Trade);
    for (const task of trade.tasks) expect(skillOf(task), task.id).toBeDefined();
    expect(ids(trade.skills)).toContain(trade.finalSkill);
    for (const skill of trade.skills) expect(skillProgress(skill, new Set(tasks)), skill.id).toBe(1);
    expect(skillProgress(skillById(trade.finalSkill)!, new Set(tasks.slice(0, -1)))).toBeLessThan(1);
  });

  test('poster studio', () => {
    setTrade({ ...entry, name: '', title: '', ...trade } as Trade);
    const { studio } = trade;
    const decors = studio.decors.map(idOf);
    const poses = studio.poses.map(idOf);
    expect(new Set(decors).size).toBe(decors.length);
    expect(new Set(poses).size).toBe(poses.length);
    // A string is a shared decor or pose: studioDecors() and studioPoses() throw on an unknown one.
    for (const id of studio.decors.filter((d) => typeof d === 'string')) expect(ids(DECORS)).toContain(id);
    for (const id of studio.poses.filter((p) => typeof p === 'string')) expect(ids(POSES)).toContain(id);
    expect(studioDecors()).toHaveLength(decors.length);
    expect(studioPoses()).toHaveLength(poses.length);

    // The poster can be made at any time, with every pose: none waits for the object made.
    expect(decors).toContain(studio.defaultDecor ?? decors[0]);
    expect(studioPoses().filter((pose) => pose.needsCreation).map((pose) => pose.id)).toEqual([]);

    expect(studio.titles.length).toBeGreaterThan(0);
    expect(new Set(ids(studio.titles)).size).toBe(studio.titles.length);
    for (const { lines } of studio.titles) expect(lines).toHaveLength(2);
  });

  test('the object held on the poster', () => {
    expect(trade.creation.from({})).toBeNull(); // nothing made yet
  });

  test('texts', () => {
    expect(ICON_PATHS).toHaveProperty(trade.welcome.highlight[0]);
    expect(trade.poster.caption).not.toBe('');
    expect(trade.phone.fact).not.toBe('');
    const { chapter } = trade.about;
    expect(chapter.blocks.length).toBeGreaterThan(0);
    for (const { points } of chapter.blocks) for (const [name] of points) expect(ICON_PATHS).toHaveProperty(name);
  });
});
