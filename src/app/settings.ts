import { isLevelId, type LevelId } from '../core/levels';
import type { KV } from './storage';

export interface Settings {
  level: LevelId;
  noGuess: boolean;
  muted: boolean;
}

export interface UrlOverrides {
  readonly level?: LevelId;
  readonly seed?: string;
}

const DEFAULTS: Settings = { level: 'easy', noGuess: true, muted: false };

export function loadSettings(kv: KV): Settings {
  const s = kv.get<Partial<Settings>>('settings', {});
  return {
    level: isLevelId(s.level) ? s.level : DEFAULTS.level,
    noGuess: typeof s.noGuess === 'boolean' ? s.noGuess : DEFAULTS.noGuess,
    muted: typeof s.muted === 'boolean' ? s.muted : DEFAULTS.muted,
  };
}

export const saveSettings = (kv: KV, s: Settings): void => kv.set('settings', s);

/** `?level=expert&seed=abc` loads a specific shareable board. */
export function readUrl(search: string): UrlOverrides {
  const p = new URLSearchParams(search);
  const level = p.get('level');
  const seed = p.get('seed')?.trim().slice(0, 64);
  return {
    ...(isLevelId(level) ? { level } : {}),
    ...(seed ? { seed } : {}),
  };
}
