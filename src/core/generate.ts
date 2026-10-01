import { at, type Dims, neighbourTable } from './grid';
import { type Rng, seeded } from './rng';
import { isSolvable } from './solver';

export interface GenOptions extends Dims {
  readonly mines: number;
  readonly start: number;
  readonly rng: Rng;
  readonly noGuess: boolean;
  readonly maxAttempts?: number;
}
export interface GenResult {
  readonly mines: readonly number[];
  readonly solvable: boolean;
  readonly attempts: number;
}

/**
 * Place mines so `start` and its neighbours are clear (an opening, not just a safe tile).
 * In no-guess mode, retry until the solver can finish. Bounded by attempts rather than time,
 * so a seeded run yields the same board on every device.
 */
export function generate({
  cols,
  rows,
  mines,
  start,
  rng,
  noGuess,
  maxAttempts = 4000,
}: GenOptions): GenResult {
  const n = cols * rows;
  const nbrs = neighbourTable({ cols, rows });
  let banned = new Set([start, ...at(nbrs, start)]);
  if (n - banned.size < mines) banned = new Set([start]);
  const pool: number[] = [];
  for (let i = 0; i < n; i++) if (!banned.has(i)) pool.push(i);

  const shuffleHead = (): number[] => {
    for (let k = 0; k < mines; k++) {
      const j = k + Math.floor(rng() * (pool.length - k));
      [pool[k], pool[j]] = [at(pool, j), at(pool, k)];
    }
    return pool.slice(0, mines);
  };

  if (!noGuess) return { mines: shuffleHead(), solvable: false, attempts: 1 };

  const grid = new Uint8Array(n);
  let last: number[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = shuffleHead();
    grid.fill(0);
    for (const m of last) grid[m] = 1;
    if (isSolvable({ cols, rows }, grid, start, nbrs))
      return { mines: last, solvable: true, attempts: attempt };
  }
  return { mines: last, solvable: false, attempts: maxAttempts };
}

export interface PlanRequest extends Dims {
  readonly mines: number;
  readonly noGuess: boolean;
  /** Seeded boards choose their own start so everyone gets the same opening. */
  readonly seed?: string;
  /** Unseeded boards start where the player first digs. */
  readonly start?: number;
}
export interface Plan extends GenResult {
  readonly start: number;
}

/** Everything needed to arm a board. Runs in the worker or, as a fallback, on the main thread. */
export function plan(req: PlanRequest): Plan {
  const rng = req.seed === undefined ? Math.random : seeded(req.seed);
  let start = req.start;
  if (start === undefined) {
    const margin = (len: number) => Math.min(4, Math.floor(len / 4));
    const mr = margin(req.rows);
    const mc = margin(req.cols);
    const r = mr + Math.floor(rng() * (req.rows - 2 * mr));
    const c = mc + Math.floor(rng() * (req.cols - 2 * mc));
    start = r * req.cols + c;
  }
  return { start, ...generate({ ...req, start, rng }) };
}
