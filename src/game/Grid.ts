import * as THREE from 'three';

const DIRECTIONS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** A floor tile, by column (x) and row (z). */
export interface Tile {
  x: number;
  z: number;
}

/** Walkable tile grid on the floor (1 tile = 1 world unit) with A* pathfinding. */
export class Grid {
  width: number;
  depth: number;
  blocked: Uint8Array;

  constructor(width: number, depth: number) {
    this.width = width;
    this.depth = depth;
    this.blocked = new Uint8Array(width * depth);
  }

  index(x: number, z: number): number {
    return z * this.width + x;
  }

  inside(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.width && z < this.depth;
  }

  block(...tiles: [number, number][]): void {
    for (const [x, z] of tiles) this.blocked[this.index(x, z)] = 1;
  }

  isWalkable(x: number, z: number): boolean {
    return this.inside(x, z) && !this.blocked[this.index(x, z)];
  }

  tileAt(point: { x: number; z: number }): Tile {
    return {
      x: THREE.MathUtils.clamp(Math.floor(point.x), 0, this.width - 1),
      z: THREE.MathUtils.clamp(Math.floor(point.z), 0, this.depth - 1),
    };
  }

  center(tile: Tile): THREE.Vector3 {
    return new THREE.Vector3(tile.x + 0.5, 0, tile.z + 0.5);
  }

  /** Closest walkable tile to `tile` (breadth-first), or null. */
  nearestWalkable(tile: Tile): Tile | null {
    const start = this.tileAt(tile);
    const seen = new Uint8Array(this.width * this.depth);
    const queue = [start];
    seen[this.index(start.x, start.z)] = 1;
    while (queue.length) {
      const t = queue.shift()!;
      if (this.isWalkable(t.x, t.z)) return t;
      for (const [dx, dz] of DIRECTIONS.slice(0, 4)) {
        const x = t.x + dx;
        const z = t.z + dz;
        if (!this.inside(x, z) || seen[this.index(x, z)]) continue;
        seen[this.index(x, z)] = 1;
        queue.push({ x, z });
      }
    }
    return null;
  }

  /** A* with diagonal moves (no corner cutting). Returns tiles from start to goal, or null. */
  findPath(start: Tile, goal: Tile): Tile[] | null {
    if (!this.isWalkable(goal.x, goal.z)) return null;

    const n = this.width * this.depth;
    const startIndex = this.index(start.x, start.z);
    const goalIndex = this.index(goal.x, goal.z);
    const g = new Float32Array(n).fill(Infinity);
    const f = new Float32Array(n).fill(Infinity);
    const cameFrom = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const open = [startIndex];

    const heuristic = (x: number, z: number) => {
      const dx = Math.abs(x - goal.x);
      const dz = Math.abs(z - goal.z);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };

    g[startIndex] = 0;
    f[startIndex] = heuristic(start.x, start.z);

    while (open.length) {
      let best = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[best]]) best = i;
      const current = open.splice(best, 1)[0];

      if (current === goalIndex) return this.reconstruct(cameFrom, current);
      closed[current] = 1;

      const cx = current % this.width;
      const cz = Math.floor(current / this.width);
      for (const [dx, dz] of DIRECTIONS) {
        const x = cx + dx;
        const z = cz + dz;
        if (!this.isWalkable(x, z)) continue;
        if (dx && dz && (!this.isWalkable(cx + dx, cz) || !this.isWalkable(cx, cz + dz))) continue;
        const next = this.index(x, z);
        if (closed[next]) continue;

        const cost = g[current] + (dx && dz ? Math.SQRT2 : 1);
        if (cost < g[next]) {
          g[next] = cost;
          f[next] = cost + heuristic(x, z);
          cameFrom[next] = current;
          if (!open.includes(next)) open.push(next);
        }
      }
    }
    return null;
  }

  reconstruct(cameFrom: Int32Array, index: number): Tile[] {
    const path: Tile[] = [];
    for (let i = index; i !== -1; i = cameFrom[i]) {
      path.unshift({ x: i % this.width, z: Math.floor(i / this.width) });
    }
    return path;
  }
}
