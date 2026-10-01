import { describe, expect, it } from 'vitest';
import { Game, type GameEvent, HINT_PENALTY, type Planner } from '../../src/core/game';
import { plan } from '../../src/core/generate';
import type { Level } from '../../src/core/levels';

// 4×3 with mines at 3 and 11 (see board.test.ts).
const level: Level = { id: 'easy', label: 'Test', cols: 4, rows: 3, mines: 2 };
const fixed: Planner = async (req) => ({
  start: req.start ?? 0,
  mines: [3, 11],
  solvable: true,
  attempts: 1,
});

function setup(opts: Partial<Parameters<typeof Game.create>[0]> = {}) {
  let now = 1000;
  const clock = { advance: (ms: number) => (now += ms) };
  const events: GameEvent[] = [];
  const ready = Game.create({
    level,
    noGuess: false,
    planner: fixed,
    clock: () => now,
    random: () => 0,
    ...opts,
  }).then((g) => {
    g.on((e) => events.push(e));
    return g;
  });
  return { ready, clock, events, types: () => events.map((e) => e.type) };
}

describe('Game', () => {
  it('arms on first dig, starts the clock and emits the opening', async () => {
    const { ready, types, clock } = setup();
    const g = await ready;
    expect(g.board.status).toBe('ready');
    await g.dig(0);
    expect(types()).toEqual(['started', 'opened']);
    clock.advance(2500);
    expect(g.elapsed).toBe(2.5);
  });

  it('refuses flags before the board exists', async () => {
    const { ready, events } = setup();
    (await ready).flag(5);
    expect(events).toEqual([{ type: 'denied', i: 5, reason: 'not-ready' }]);
  });

  it('wins, stops the clock and reports the time', async () => {
    const { ready, events, clock } = setup();
    const g = await ready;
    await g.dig(0);
    clock.advance(4000);
    await g.dig(7);
    expect(events.at(-1)).toEqual({ type: 'won', time: 4 });
    clock.advance(9000);
    expect(g.elapsed).toBe(4);
  });

  it('explodes with the remaining mines and wrong flags', async () => {
    const { ready, events } = setup();
    const g = await ready;
    await g.dig(0);
    g.flag(7);
    await g.dig(11);
    expect(events.at(-1)).toEqual({ type: 'exploded', hit: 11, mines: [3], wrongFlags: [7] });
    await g.dig(5);
    expect(events.at(-1)?.type).toBe('exploded');
  });

  it('denies digging a flag and nudges an unready chord', async () => {
    const { ready, events } = setup();
    const g = await ready;
    await g.dig(0);
    g.flag(7);
    await g.dig(7);
    await g.dig(6);
    expect(events.slice(-2)).toEqual([
      { type: 'denied', i: 7, reason: 'flagged' },
      { type: 'denied', i: 6, reason: 'chord' },
    ]);
  });

  it('chords through the game and flags an open number by digging', async () => {
    const { ready, events } = setup();
    const g = await ready;
    await g.dig(0);
    g.flag(3);
    g.flag(11);
    g.flag(6); // open number: treated as a dig, which chords
    await Promise.resolve();
    expect(events.find((e) => e.type === 'opened' && e.chord)).toBeTruthy();
    expect(g.board.status).toBe('won');
  });

  it('hints open a safe frontier tile and add the penalty', async () => {
    const { ready, events } = setup();
    const g = await ready;
    await g.dig(0);
    const i = await g.hint(0);
    expect(i).toBe(7);
    expect(events).toContainEqual({ type: 'hinted', i: 7, penalty: HINT_PENALTY });
    expect(g.hints).toBe(1);
    expect(g.elapsed).toBe(HINT_PENALTY);
  });

  it('a hint before the first dig digs at the fallback tile', async () => {
    const { ready, types } = setup();
    const g = await ready;
    expect(await g.hint(0)).toBe(0);
    expect(types()).toEqual(['started', 'opened']);
  });

  it('seeded games are generated and opened up front', async () => {
    const g = await Game.create({
      level: { ...level, cols: 9, rows: 9, mines: 10 },
      noGuess: false,
      planner: async (r) => plan(r),
      seed: 'x',
    });
    expect(g.board.status).toBe('playing');
    expect(g.start).not.toBeNull();
    expect(g.noGuessBoard).toBe(true);
    expect(g.started).toBe(false);
  });

  it('ignores input while the board is being generated', async () => {
    let release: () => void = () => {};
    const slow: Planner = (req) =>
      new Promise(
        (r) => (release = () => r({ start: req.start ?? 0, mines: [3, 11], solvable: true, attempts: 1 })),
      );
    const g = await Game.create({ level, noGuess: false, planner: slow });
    const first = g.dig(0);
    await g.dig(7);
    g.flag(1);
    expect(await g.hint(0)).toBeNull();
    release();
    await first;
    expect(g.board.opened).toBe(9);
  });

  it('unsubscribes listeners', async () => {
    const g = await Game.create({ level, noGuess: false, planner: fixed });
    const seen: GameEvent[] = [];
    const off = g.on((e) => seen.push(e));
    off();
    await g.dig(0);
    expect(seen).toEqual([]);
  });
});
