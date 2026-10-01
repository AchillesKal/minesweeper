import { at, type Dims, type Neighbours, neighbourTable } from './grid';

export interface Cell {
  mine: boolean;
  adj: number;
  open: boolean;
  flag: boolean;
}
export type Status = 'ready' | 'playing' | 'won' | 'lost';
/** A revealed cell and its ring distance from where the reveal started (drives animation). */
export interface Opened {
  readonly i: number;
  readonly depth: number;
}
export interface MoveResult {
  readonly opened: readonly Opened[];
  readonly hit: number | null;
}

const NOTHING: MoveResult = { opened: [], hit: null };

/** Pure Minesweeper rules. No DOM, no timers, no randomness. */
export class Board implements Dims {
  readonly cols: number;
  readonly rows: number;
  readonly mines: number;
  readonly cells: readonly Cell[];
  readonly nbrs: Neighbours;
  status: Status = 'ready';
  opened = 0;
  flags = 0;
  exploded: number | null = null;

  constructor({ cols, rows, mines }: Dims & { mines: number }) {
    if (mines < 1 || mines >= cols * rows)
      throw new RangeError('Mine count must leave at least one safe tile');
    this.cols = cols;
    this.rows = rows;
    this.mines = mines;
    this.cells = Array.from({ length: cols * rows }, () => ({
      mine: false,
      adj: 0,
      open: false,
      flag: false,
    }));
    this.nbrs = neighbourTable(this);
  }

  get size(): number {
    return this.cols * this.rows;
  }
  get safeTotal(): number {
    return this.size - this.mines;
  }
  get minesLeft(): number {
    return this.mines - this.flags;
  }
  get over(): boolean {
    return this.status === 'won' || this.status === 'lost';
  }

  cell(i: number): Cell {
    return at(this.cells, i);
  }
  neighbours(i: number): readonly number[] {
    return at(this.nbrs, i);
  }

  /** Arm the board. Called exactly once, before the first reveal. */
  lay(positions: Iterable<number>): void {
    if (this.status !== 'ready') throw new Error('Board already armed');
    const list = [...positions];
    const set = new Set(list);
    if (set.size !== list.length) throw new Error('Duplicate mine positions');
    if (set.size !== this.mines) throw new Error(`Expected ${this.mines} mines, got ${set.size}`);
    for (const p of set) this.cell(p).mine = true;
    this.cells.forEach((c, i) => {
      c.adj = this.neighbours(i).filter((j) => this.cell(j).mine).length;
    });
    this.status = 'playing';
  }

  reveal(i: number): MoveResult {
    const c = this.cell(i);
    if (this.status !== 'playing' || c.flag) return NOTHING;
    if (c.open) return this.chord(i);
    if (c.mine) return this.lose(i);
    return this.flood([i], 0);
  }

  /** Open every unflagged neighbour of a number whose flags are all placed. */
  chord(i: number): MoveResult {
    if (this.status !== 'playing' || !this.canChord(i)) return NOTHING;
    const targets = this.neighbours(i).filter((j) => !this.cell(j).open && !this.cell(j).flag);
    const hit = targets.find((j) => this.cell(j).mine);
    if (hit !== undefined) return this.lose(hit);
    return this.flood(targets, 1);
  }

  canChord(i: number): boolean {
    const c = this.cell(i);
    if (!c.open || c.adj === 0) return false;
    const ns = this.neighbours(i);
    return (
      ns.some((j) => !this.cell(j).open && !this.cell(j).flag) &&
      ns.filter((j) => this.cell(j).flag).length === c.adj
    );
  }

  toggleFlag(i: number): boolean {
    const c = this.cell(i);
    if (this.status !== 'playing' || c.open) return false;
    c.flag = !c.flag;
    this.flags += c.flag ? 1 : -1;
    return true;
  }

  private flood(seeds: readonly number[], depth0: number): MoveResult {
    const opened: Opened[] = [];
    const queue: Opened[] = seeds.map((i) => ({ i, depth: depth0 }));
    const seen = new Set(seeds);
    for (const { i, depth } of queue) {
      const c = this.cell(i);
      if (c.open || c.flag || c.mine) continue;
      c.open = true;
      this.opened++;
      opened.push({ i, depth });
      if (c.adj === 0) {
        for (const j of this.neighbours(i)) {
          if (!seen.has(j)) {
            seen.add(j);
            queue.push({ i: j, depth: depth + 1 });
          }
        }
      }
    }
    if (this.opened === this.safeTotal) this.win();
    return { opened, hit: null };
  }

  private win(): void {
    this.status = 'won';
    for (const c of this.cells) {
      if (c.mine && !c.flag) {
        c.flag = true;
        this.flags++;
      }
    }
  }

  private lose(i: number): MoveResult {
    this.status = 'lost';
    this.exploded = i;
    return { opened: [], hit: i };
  }
}
