export interface Dims {
  readonly cols: number;
  readonly rows: number;
}

export type Neighbours = readonly (readonly number[])[];

/** Precomputed 8-neighbourhoods, indexed row-major. */
export function neighbourTable({ cols, rows }: Dims): Neighbours {
  const out: number[][] = [];
  for (let i = 0; i < cols * rows; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const ns: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) ns.push(rr * cols + cc);
      }
    }
    out.push(ns);
  }
  return out;
}

/** Indexed read that fails loudly instead of returning undefined. */
export function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new RangeError(`Index ${i} out of bounds (${arr.length})`);
  return v;
}
