import type { Board } from '../core/board';
import { at } from '../core/grid';
import type { Level } from '../core/levels';
import { icon } from './dom';

export type Anim = 'dig' | 'plant' | 'reveal';

/** Renders a Board into a grid of buttons and owns focus within it. */
export class BoardView {
  focusIdx = 0;
  private cells: HTMLButtonElement[] = [];
  private board: Board | null = null;
  private level: Level | null = null;
  private start: number | null = null;

  constructor(
    readonly el: HTMLElement,
    private readonly tray: HTMLElement,
    private readonly scroller: HTMLElement,
  ) {
    tray.addEventListener('animationend', (e) => {
      if (e.animationName === 'shake') tray.classList.remove('shake');
    });
  }

  mount(board: Board, level: Level, start: number | null): void {
    this.board = board;
    this.level = level;
    this.start = start;
    this.tray.className = 'tray';
    this.el.style.setProperty('--cols', String(level.cols));
    this.cells = Array.from({ length: board.size }, (_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell';
      b.dataset.i = String(i);
      b.tabIndex = -1;
      return b;
    });
    this.el.replaceChildren(...this.cells);
    this.focusIdx = start ?? Math.floor(level.rows / 2) * level.cols + Math.floor(level.cols / 2);
    this.cell(this.focusIdx).tabIndex = 0;
    for (let i = 0; i < board.size; i++) this.paint(i);
    this.fit();
  }

  cell(i: number): HTMLButtonElement {
    return at(this.cells, i);
  }

  paint(i: number, anim?: Anim, delay = 0): void {
    const board = this.board;
    if (!board) return;
    const c = board.cell(i);
    const el = this.cell(i);
    const cols = board.cols;
    const classes = ['cell'];
    let label = 'hidden';
    el.replaceChildren();
    if (c.open) {
      classes.push('open');
      if (c.adj > 0) {
        classes.push(`n${c.adj}`);
        el.append(String(c.adj));
        label = `${c.adj} mine${c.adj > 1 ? 's' : ''} nearby`;
      } else label = 'clear';
    } else if (c.flag) {
      classes.push('flag');
      el.append(icon('flag'));
      label = 'flagged';
    }
    if (anim) {
      classes.push(anim);
      el.style.setProperty('--d', `${delay}ms`);
    }
    if (el.classList.contains('hinted')) classes.push('hinted');
    if (i === this.start) classes.push('start');
    el.className = classes.join(' ');
    el.setAttribute('aria-label', `Row ${Math.floor(i / cols) + 1}, column ${(i % cols) + 1}, ${label}`);
  }

  showMine(i: number, kind: 'boom' | 'mine' | 'wrong', delay = 0): void {
    const el = this.cell(i);
    el.replaceChildren(icon(kind === 'wrong' ? 'flag' : 'mine'));
    el.className = `cell open ${kind === 'mine' ? 'mine reveal' : kind}`;
    el.style.setProperty('--d', `${delay}ms`);
    el.setAttribute('aria-label', kind === 'wrong' ? 'wrong flag' : 'mine');
  }

  /** Briefly outline the hidden tiles around a number that can't be opened yet. */
  peek(i: number): void {
    const board = this.board;
    if (!board) return;
    for (const j of board.neighbours(i)) {
      if (board.cell(j).open) continue;
      const el = this.cell(j);
      el.classList.remove('peek');
      void el.offsetWidth;
      el.classList.add('peek');
    }
  }

  markHinted(i: number): void {
    this.cell(i).classList.add('hinted');
  }

  setOutcome(outcome: 'won' | 'lost'): void {
    this.tray.classList.add(outcome);
    if (outcome === 'lost') this.tray.classList.add('shake');
  }

  centre(i: number): { x: number; y: number } {
    const r = this.cell(i).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  moveFocus(i: number, focus = true): void {
    if (i === this.focusIdx && !focus) return;
    this.cells[this.focusIdx]?.setAttribute('tabindex', '-1');
    this.focusIdx = i;
    const el = this.cell(i);
    el.tabIndex = 0;
    if (focus) el.focus();
  }

  step(dr: number, dc: number): void {
    const level = this.level;
    if (!level) return;
    const r = Math.max(0, Math.min(level.rows - 1, Math.floor(this.focusIdx / level.cols) + dr));
    const c = Math.max(0, Math.min(level.cols - 1, (this.focusIdx % level.cols) + dc));
    this.moveFocus(r * level.cols + c);
  }

  fit(): void {
    const level = this.level;
    if (!level) return;
    const narrow = innerWidth < 520;
    const gap = narrow ? 2 : 3;
    const pad = narrow ? 8 : 12;
    const avail = this.scroller.clientWidth - 8 - pad * 2 - gap * (level.cols - 1);
    const size = Math.max(20, Math.min(44, Math.floor(avail / level.cols)));
    this.el.style.setProperty('--cell', `${size}px`);
    this.el.style.setProperty('--gap', `${gap}px`);
    this.tray.style.setProperty('--pad', `${pad}px`);
  }
}
