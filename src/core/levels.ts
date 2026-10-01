export interface Level {
  readonly id: LevelId;
  readonly label: string;
  readonly cols: number;
  readonly rows: number;
  readonly mines: number;
}

export type LevelId = 'easy' | 'medium' | 'expert' | 'daily';

export const LEVELS = {
  easy: { id: 'easy', label: 'Easy', cols: 9, rows: 9, mines: 10 },
  medium: { id: 'medium', label: 'Medium', cols: 16, rows: 16, mines: 40 },
  expert: { id: 'expert', label: 'Expert', cols: 30, rows: 16, mines: 99 },
  daily: { id: 'daily', label: 'Daily', cols: 16, rows: 16, mines: 40 },
} as const satisfies Record<LevelId, Level>;

export const isLevelId = (v: unknown): v is LevelId => typeof v === 'string' && v in LEVELS;

/** Wide boards stand upright on portrait screens instead of scrolling sideways. */
export const orient = (level: Level, portrait: boolean): Level =>
  portrait && level.cols > level.rows ? { ...level, cols: level.rows, rows: level.cols } : level;

const EPOCH = Date.UTC(2026, 9, 1);

/** Local calendar date as YYYY-MM-DD, so the daily rolls over at the player's midnight. */
export function todayKey(d = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function dailyNumber(key: string): number {
  const [y = 0, m = 1, d = 1] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86_400_000) + 1;
}
