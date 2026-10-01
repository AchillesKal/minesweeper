import { describe, expect, it } from 'vitest';
import { generate, plan } from '../../src/core/generate';
import { neighbourTable } from '../../src/core/grid';
import { seeded } from '../../src/core/rng';
import { isSolvable } from '../../src/core/solver';

const medium = { cols: 16, rows: 16, mines: 40 };

describe('generate', () => {
  it('keeps the start and its neighbours clear', () => {
    const start = 40;
    const clear = new Set([start, ...(neighbourTable({ cols: 9, rows: 9 })[start] ?? [])]);
    for (let s = 0; s < 50; s++) {
      const { mines } = generate({
        cols: 9,
        rows: 9,
        mines: 10,
        start,
        rng: seeded(`t${s}`),
        noGuess: false,
      });
      expect(mines.some((m) => clear.has(m))).toBe(false);
      expect(new Set(mines).size).toBe(10);
    }
  });

  it('falls back to a single safe tile when the board is too crowded', () => {
    const { mines } = generate({ cols: 3, rows: 3, mines: 7, start: 4, rng: seeded('x'), noGuess: false });
    expect(mines).not.toContain(4);
    expect(mines).toHaveLength(7);
  });

  it('no-guess boards pass the solver', () => {
    for (let s = 0; s < 10; s++) {
      const { mines, solvable } = generate({ ...medium, start: 136, rng: seeded(`ng${s}`), noGuess: true });
      expect(solvable).toBe(true);
      const grid = new Uint8Array(256);
      for (const m of mines) grid[m] = 1;
      expect(isSolvable(medium, grid, 136)).toBe(true);
    }
  });

  it('reports failure after the attempt budget', () => {
    const r = generate({
      cols: 4,
      rows: 2,
      mines: 1,
      start: 0,
      rng: () => 0.999,
      noGuess: true,
      maxAttempts: 3,
    });
    expect(r.solvable).toBe(false);
    expect(r.attempts).toBe(3);
  });
});

describe('plan', () => {
  it('is deterministic for a seed, which the daily relies on', () => {
    expect(plan({ ...medium, noGuess: true, seed: 'daily:2026-10-01' })).toEqual(
      plan({ ...medium, noGuess: true, seed: 'daily:2026-10-01' }),
    );
    expect(plan({ ...medium, noGuess: true, seed: 'a' })).not.toEqual(
      plan({ ...medium, noGuess: true, seed: 'b' }),
    );
  });

  it('picks a seeded start away from the edges', () => {
    for (let s = 0; s < 30; s++) {
      const { start } = plan({ ...medium, noGuess: false, seed: `s${s}` });
      const r = Math.floor(start / 16);
      const c = start % 16;
      expect(r >= 4 && r < 12 && c >= 4 && c < 12).toBe(true);
    }
  });

  it('uses the given start for unseeded boards', () => {
    expect(plan({ ...medium, noGuess: false, start: 7 }).start).toBe(7);
  });
});

describe('isSolvable', () => {
  it('rejects a 50/50', () => {
    const grid = new Uint8Array(8);
    grid[3] = 1; // last two tiles of a 4×2 strip are indistinguishable
    expect(isSolvable({ cols: 4, rows: 2 }, grid, 0)).toBe(false);
  });

  it('finishes with the global mine count', () => {
    const grid = new Uint8Array(9);
    grid[8] = 1;
    expect(isSolvable({ cols: 3, rows: 3 }, grid, 0)).toBe(true);
  });

  it('starting on a mine is never solvable', () => {
    const grid = new Uint8Array(9);
    grid[0] = 1;
    expect(isSolvable({ cols: 3, rows: 3 }, grid, 0)).toBe(false);
  });
});
