import type { KV } from './storage';

export interface Stats {
  readonly played: number;
  readonly won: number;
  readonly best: number | null;
}

const EMPTY: Stats = { played: 0, won: 0, best: null };

export class StatsBook {
  constructor(private readonly kv: KV) {}

  get(id: string): Stats {
    return this.kv.get(`stats.${id}`, EMPTY);
  }

  /** Record a finished game. Returns true when it set a new best time. */
  record(id: string, won: boolean, time: number): boolean {
    const s = this.get(id);
    const isBest = won && (s.best === null || time < s.best);
    this.kv.set(`stats.${id}`, {
      played: s.played + 1,
      won: s.won + (won ? 1 : 0),
      best: isBest ? time : s.best,
    } satisfies Stats);
    return isBest;
  }
}
