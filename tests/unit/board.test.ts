import { describe, expect, it } from 'vitest';
import { Board } from '../../src/core/board';

// 4×3, mines at 3 and 11:
// . . . *
// . . . .
// . . . *
const make = () => {
  const b = new Board({ cols: 4, rows: 3, mines: 2 });
  b.lay([3, 11]);
  return b;
};

describe('Board', () => {
  it('computes adjacency counts', () => {
    expect(make().cells.map((c) => c.adj)).toEqual([0, 0, 1, 0, 0, 0, 2, 2, 0, 0, 1, 0]);
  });

  it('flood-fills from a zero and reports ring depth', () => {
    const { opened } = make().reveal(0);
    expect(opened.map((o) => o.i).sort((a, b) => a - b)).toEqual([0, 1, 2, 4, 5, 6, 8, 9, 10]);
    expect(opened.find((o) => o.i === 0)?.depth).toBe(0);
    expect(opened.find((o) => o.i === 10)?.depth).toBe(2);
  });

  it('wins when every safe tile is open, without needing flags', () => {
    const b = make();
    b.reveal(0);
    b.reveal(7);
    expect(b.status).toBe('won');
    expect(b.flags).toBe(2);
    expect(b.over).toBe(true);
  });

  it('loses on a mine and ignores further moves', () => {
    const b = make();
    expect(b.reveal(3).hit).toBe(3);
    expect(b.status).toBe('lost');
    expect(b.exploded).toBe(3);
    expect(b.reveal(0).opened).toEqual([]);
    expect(b.toggleFlag(0)).toBe(false);
  });

  it('chords only when the flag count matches', () => {
    const b = make();
    b.reveal(0);
    expect(b.canChord(6)).toBe(false);
    expect(b.reveal(6).opened).toEqual([]);
    b.toggleFlag(3);
    b.toggleFlag(11);
    expect(b.canChord(6)).toBe(true);
    b.reveal(6);
    expect(b.status).toBe('won');
  });

  it('chording onto a wrong flag explodes', () => {
    const b = make();
    b.reveal(0);
    b.toggleFlag(7);
    b.toggleFlag(11);
    expect(b.reveal(6).hit).toBe(3);
  });

  it('guards misuse', () => {
    const b = make();
    expect(() => b.lay([0, 1])).toThrow(/already armed/);
    expect(() => new Board({ cols: 2, rows: 2, mines: 4 })).toThrow(RangeError);
    expect(() => new Board({ cols: 2, rows: 2, mines: 1 }).lay([0, 0])).toThrow(/Duplicate/);
    expect(() => new Board({ cols: 2, rows: 2, mines: 1 }).lay([0, 1])).toThrow(/Expected 1/);
    expect(() => b.cell(99)).toThrow(RangeError);
  });

  it('does nothing before it is armed, and flags toggle back', () => {
    const fresh = new Board({ cols: 3, rows: 3, mines: 1 });
    expect(fresh.reveal(0).opened).toEqual([]);
    const b = make();
    expect(b.toggleFlag(0)).toBe(true);
    expect(b.reveal(0).opened).toEqual([]);
    expect(b.toggleFlag(0)).toBe(true);
    expect(b.flags).toBe(0);
    expect(b.minesLeft).toBe(2);
  });
});
