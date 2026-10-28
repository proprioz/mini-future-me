import { describe, expect, test } from 'vitest';
import { Grid } from '../../src/game/Grid.ts';

// The office floor: the avatar walks around the stations (A*), diagonally but never through a corner.

const steps = (path: { x: number; z: number }[]) => path.slice(1).map((t, i) => [t.x - path[i].x, t.z - path[i].z]);

describe('findPath', () => {
  test('a straight line on an empty floor', () => {
    const grid = new Grid(7, 5);
    expect(grid.findPath({ x: 0, z: 2 }, { x: 6, z: 2 })).toEqual([0, 1, 2, 3, 4, 5, 6].map((x) => ({ x, z: 2 })));
  });

  test('diagonals when they are shorter', () => {
    const path = new Grid(7, 5).findPath({ x: 0, z: 0 }, { x: 4, z: 4 })!;
    expect(path).toHaveLength(5);
  });

  test('around a wall, one tile at a time, without cutting its corners', () => {
    const grid = new Grid(7, 5);
    grid.block([3, 0], [3, 1], [3, 2], [3, 3]);
    const path = grid.findPath({ x: 1, z: 1 }, { x: 5, z: 1 })!;
    expect(path.at(-1)).toEqual({ x: 5, z: 1 });
    for (const tile of path) expect(grid.isWalkable(tile.x, tile.z)).toBe(true);
    for (const [dx, dz] of steps(path)) {
      expect(Math.max(Math.abs(dx), Math.abs(dz))).toBe(1);
    }
    for (const [i, [dx, dz]] of steps(path).entries()) {
      if (dx && dz) {
        expect(grid.isWalkable(path[i].x + dx, path[i].z)).toBe(true);
        expect(grid.isWalkable(path[i].x, path[i].z + dz)).toBe(true);
      }
    }
  });

  test('no path to a blocked or walled-in tile', () => {
    const grid = new Grid(7, 5);
    grid.block([6, 4]);
    expect(grid.findPath({ x: 0, z: 0 }, { x: 6, z: 4 })).toBeNull();
    grid.block([5, 0], [5, 1], [6, 1]);
    expect(grid.findPath({ x: 0, z: 0 }, { x: 6, z: 0 })).toBeNull();
  });
});

test('nearestWalkable', () => {
  const grid = new Grid(7, 5);
  grid.block([3, 2]);
  expect(grid.nearestWalkable({ x: 1, z: 1 })).toEqual({ x: 1, z: 1 });
  const near = grid.nearestWalkable({ x: 3, z: 2 })!;
  expect(Math.abs(near.x - 3) + Math.abs(near.z - 2)).toBe(1);
  expect(grid.tileAt({ x: 9.4, z: -2 })).toEqual({ x: 6, z: 0 }); // clamped into the room
});
