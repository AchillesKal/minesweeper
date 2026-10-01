import { Board, type Opened } from './board';
import type { Plan, PlanRequest } from './generate';
import type { Level } from './levels';

export type GameEvent =
  | { readonly type: 'opened'; readonly cells: readonly Opened[]; readonly chord: boolean }
  | { readonly type: 'flagged'; readonly i: number; readonly on: boolean }
  | { readonly type: 'denied'; readonly i: number; readonly reason: 'flagged' | 'not-ready' | 'chord' }
  | { readonly type: 'hinted'; readonly i: number; readonly penalty: number }
  | { readonly type: 'started' }
  | {
      readonly type: 'exploded';
      readonly hit: number;
      readonly mines: readonly number[];
      readonly wrongFlags: readonly number[];
    }
  | { readonly type: 'won'; readonly time: number };

export type Planner = (req: PlanRequest) => Promise<Plan>;
export type Listener = (e: GameEvent) => void;

export interface GameOptions {
  readonly level: Level;
  readonly noGuess: boolean;
  readonly planner: Planner;
  readonly seed?: string;
  readonly clock?: () => number;
  readonly random?: () => number;
}

export const HINT_PENALTY = 10;

/**
 * One round of play: owns the board, the clock and hints, and reports what happened as events.
 * The UI renders events; it never mutates game state directly.
 */
export class Game {
  readonly board: Board;
  readonly level: Level;
  readonly seed: string | undefined;
  /** Seeded boards open with this tile already revealed. */
  start: number | null = null;
  hints = 0;
  private startedAt: number | null = null;
  private stoppedAt: number | null = null;
  private busy = false;
  private readonly listeners = new Set<Listener>();
  private readonly clock: () => number;
  private readonly random: () => number;
  private readonly noGuess: boolean;
  private readonly planner: Planner;

  private constructor(opts: GameOptions) {
    this.level = opts.level;
    this.seed = opts.seed;
    this.noGuess = opts.seed !== undefined || opts.noGuess;
    this.planner = opts.planner;
    this.clock = opts.clock ?? (() => performance.now());
    this.random = opts.random ?? Math.random;
    this.board = new Board(opts.level);
  }

  /** Seeded games are generated up front so the opening can be shown immediately. */
  static async create(opts: GameOptions): Promise<Game> {
    const g = new Game(opts);
    if (g.seed !== undefined) {
      const p = await g.planner({ ...g.dims, noGuess: true, seed: g.seed });
      g.board.lay(p.mines);
      g.board.reveal(p.start);
      g.start = p.start;
    }
    return g;
  }

  get dims() {
    const { cols, rows, mines } = this.level;
    return { cols, rows, mines };
  }
  get started(): boolean {
    return this.startedAt !== null;
  }
  get noGuessBoard(): boolean {
    return this.noGuess;
  }
  /** Seconds, including hint penalties. */
  get elapsed(): number {
    if (this.startedAt === null) return 0;
    const end = this.stoppedAt ?? this.clock();
    return (end - this.startedAt) / 1000 + this.hints * HINT_PENALTY;
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async dig(i: number): Promise<void> {
    const b = this.board;
    if (b.over || this.busy) return;
    const c = b.cell(i);
    if (c.flag) {
      this.emit({ type: 'denied', i, reason: 'flagged' });
      return;
    }
    if (c.open && !b.canChord(i)) {
      if (c.adj > 0) this.emit({ type: 'denied', i, reason: 'chord' });
      return;
    }
    await this.arm(i);
    const chord = c.open;
    this.apply(chord ? b.chord(i) : b.reveal(i), chord);
  }

  flag(i: number): void {
    const b = this.board;
    if (b.status === 'ready') {
      this.emit({ type: 'denied', i, reason: 'not-ready' });
      return;
    }
    if (b.over || this.busy) return;
    if (b.cell(i).open) {
      void this.dig(i);
      return;
    }
    if (!b.toggleFlag(i)) return;
    this.begin();
    this.emit({ type: 'flagged', i, on: b.cell(i).flag });
  }

  /** Open a random safe tile next to the cleared area, for a time penalty. */
  async hint(fallback: number): Promise<number | null> {
    const b = this.board;
    if (b.over || this.busy) return null;
    if (b.status === 'ready') {
      await this.dig(fallback);
      return fallback;
    }
    const hidden = (i: number) => {
      const c = b.cell(i);
      return !c.open && !c.mine && !c.flag;
    };
    const all = b.cells.map((_, i) => i).filter(hidden);
    const frontier = all.filter((i) => b.neighbours(i).some((j) => b.cell(j).open));
    const pool = frontier.length > 0 ? frontier : all;
    const i = pool[Math.floor(this.random() * pool.length)];
    if (i === undefined) return null;
    this.begin();
    this.hints++;
    this.emit({ type: 'hinted', i, penalty: HINT_PENALTY });
    this.apply(b.reveal(i), false);
    return i;
  }

  private async arm(at: number): Promise<void> {
    if (this.board.status === 'ready') {
      this.busy = true;
      try {
        const p = await this.planner({ ...this.dims, noGuess: this.noGuess, start: at });
        this.board.lay(p.mines);
      } finally {
        this.busy = false;
      }
    }
    this.begin();
  }

  private begin(): void {
    if (this.startedAt !== null) return;
    this.startedAt = this.clock();
    this.emit({ type: 'started' });
  }

  private apply(res: { opened: readonly Opened[]; hit: number | null }, chord: boolean): void {
    const b = this.board;
    if (res.hit !== null) {
      this.stoppedAt = this.clock();
      const mines: number[] = [];
      const wrongFlags: number[] = [];
      b.cells.forEach((c, i) => {
        if (i === res.hit) return;
        if (c.mine && !c.flag) mines.push(i);
        else if (c.flag && !c.mine) wrongFlags.push(i);
      });
      this.emit({ type: 'exploded', hit: res.hit, mines, wrongFlags });
      return;
    }
    if (res.opened.length > 0) this.emit({ type: 'opened', cells: res.opened, chord });
    if (b.status === 'won') {
      this.stoppedAt = this.clock();
      this.emit({ type: 'won', time: this.elapsed });
    }
  }

  private emit(e: GameEvent): void {
    for (const fn of this.listeners) fn(e);
  }
}
