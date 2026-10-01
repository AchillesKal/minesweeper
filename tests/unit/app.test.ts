import { describe, expect, it } from 'vitest';
import { loadSettings, readUrl, saveSettings } from '../../src/app/settings';
import { StatsBook } from '../../src/app/stats';
import { createStorage } from '../../src/app/storage';
import { dailyNumber, isLevelId, LEVELS, orient, todayKey } from '../../src/core/levels';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('storage', () => {
  it('round-trips JSON and survives broken backends', () => {
    const kv = createStorage(memory());
    kv.set('a', { x: 1 });
    expect(kv.get('a', null)).toEqual({ x: 1 });
    const broken = createStorage({
      getItem: () => '{nope',
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(broken.get('a', 5)).toBe(5);
    expect(() => broken.set('a', 1)).not.toThrow();
    expect(createStorage(null).get('a', 'd')).toBe('d');
  });
});

describe('stats', () => {
  it('tracks played, won and best time', () => {
    const s = new StatsBook(createStorage(memory()));
    expect(s.record('easy', false, 50)).toBe(false);
    expect(s.record('easy', true, 40)).toBe(true);
    expect(s.record('easy', true, 45)).toBe(false);
    expect(s.record('easy', true, 30)).toBe(true);
    expect(s.get('easy')).toEqual({ played: 4, won: 3, best: 30 });
  });
});

describe('settings', () => {
  it('validates stored values and falls back to defaults', () => {
    const mem = memory();
    const kv = createStorage(mem);
    expect(loadSettings(kv)).toEqual({ level: 'easy', noGuess: true, muted: false });
    saveSettings(kv, { level: 'expert', noGuess: false, muted: true });
    expect(loadSettings(kv)).toEqual({ level: 'expert', noGuess: false, muted: true });
    mem.setItem('ms2.settings', JSON.stringify({ level: 'nightmare', noGuess: 'yes' }));
    expect(loadSettings(kv)).toEqual({ level: 'easy', noGuess: true, muted: false });
  });

  it('reads level and seed from the URL', () => {
    expect(readUrl('?level=expert&seed=abc')).toEqual({ level: 'expert', seed: 'abc' });
    expect(readUrl('?level=huge&seed=%20')).toEqual({});
    expect(readUrl(`?seed=${'x'.repeat(100)}`).seed).toHaveLength(64);
  });
});

describe('levels', () => {
  it('turns wide boards upright on portrait screens only', () => {
    expect(orient(LEVELS.expert, true)).toMatchObject({ cols: 16, rows: 30 });
    expect(orient(LEVELS.expert, false)).toBe(LEVELS.expert);
    expect(orient(LEVELS.medium, true)).toBe(LEVELS.medium);
  });

  it('numbers dailies from launch day using the local date', () => {
    expect(dailyNumber('2026-10-01')).toBe(1);
    expect(dailyNumber('2027-10-01')).toBe(366);
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(isLevelId('daily')).toBe(true);
    expect(isLevelId(3)).toBe(false);
  });
});
