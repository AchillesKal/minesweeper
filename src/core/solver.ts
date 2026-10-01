import { at, type Dims, type Neighbours, neighbourTable } from './grid';

const UNKNOWN = 0;
const OPEN = 1;
const MINE = 2;

interface Constraint {
  readonly cells: readonly number[];
  readonly need: number;
}

/**
 * Can a player clear this board from `start` with logic alone?
 * Uses single-cell rules, pairwise overlap rules and the global mine count, but no exhaustive
 * search. "Solvable" means "solvable by deductions a good human makes", which is what no-guess wants.
 */
export function isSolvable(
  dims: Dims,
  mine: Uint8Array,
  start: number,
  nbrs: Neighbours = neighbourTable(dims),
): boolean {
  const n = dims.cols * dims.rows;
  const N = (i: number) => at(nbrs, i);
  const totalMines = mine.reduce((a, b) => a + b, 0);
  const adj = new Uint8Array(n);
  for (let i = 0; i < n; i++) for (const j of N(i)) adj[i] = (adj[i] ?? 0) + (mine[j] ?? 0);
  const st = new Uint8Array(n);
  let opened = 0;
  let flagged = 0;

  const open = (i: number): void => {
    const stack = [i];
    for (let k = stack.pop(); k !== undefined; k = stack.pop()) {
      if (st[k] !== UNKNOWN) continue;
      if (mine[k]) throw new Error('Solver opened a mine');
      st[k] = OPEN;
      opened++;
      if (adj[k] === 0) for (const j of N(k)) if (st[j] === UNKNOWN) stack.push(j);
    }
  };
  const mark = (i: number): void => {
    if (st[i] === UNKNOWN) {
      st[i] = MINE;
      flagged++;
    }
  };

  if (mine[start]) return false;
  open(start);
  const goal = n - totalMines;

  while (opened < goal) {
    if (applySingles() || applyPairs()) continue;
    if (applyCount()) continue;
    return false;
  }
  return true;

  function constraints(): { list: Constraint[]; byCell: Map<number, Constraint[]>; progressed: boolean } {
    const list: Constraint[] = [];
    const byCell = new Map<number, Constraint[]>();
    let progressed = false;
    for (let i = 0; i < n; i++) {
      if (st[i] !== OPEN || adj[i] === 0) continue;
      const cells: number[] = [];
      let known = 0;
      for (const j of N(i)) {
        if (st[j] === UNKNOWN) cells.push(j);
        else if (st[j] === MINE) known++;
      }
      if (cells.length === 0) continue;
      const need = (adj[i] ?? 0) - known;
      if (need === 0) {
        cells.forEach(open);
        progressed = true;
      } else if (need === cells.length) {
        cells.forEach(mark);
        progressed = true;
      } else {
        const c = { cells, need };
        list.push(c);
        for (const j of cells) {
          const arr = byCell.get(j);
          if (arr) arr.push(c);
          else byCell.set(j, [c]);
        }
      }
    }
    return { list, byCell, progressed };
  }

  function applySingles(): boolean {
    return constraints().progressed;
  }

  function applyPairs(): boolean {
    const { list, byCell } = constraints();
    for (const a of list) {
      const aSet = new Set(a.cells);
      const partners = new Set<Constraint>();
      for (const j of a.cells) for (const b of byCell.get(j) ?? []) if (b !== a) partners.add(b);
      for (const b of partners) {
        const bSet = new Set(b.cells);
        const onlyB = b.cells.filter((j) => !aSet.has(j));
        const onlyA = a.cells.filter((j) => !bSet.has(j));
        const diff = b.need - a.need;
        if (onlyB.length > 0 && diff === onlyB.length) {
          onlyB.forEach(mark);
          onlyA.forEach(open);
          return true;
        }
        if (onlyA.length === 0 && onlyB.length > 0 && diff === 0) {
          onlyB.forEach(open);
          return true;
        }
      }
    }
    return false;
  }

  function applyCount(): boolean {
    const unknown: number[] = [];
    for (let i = 0; i < n; i++) if (st[i] === UNKNOWN) unknown.push(i);
    const left = totalMines - flagged;
    if (left === 0) unknown.forEach(open);
    else if (left === unknown.length) unknown.forEach(mark);
    else return false;
    return true;
  }
}
