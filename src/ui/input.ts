import type { BoardView } from './board-view';

export interface InputHandlers {
  primary(i: number): void;
  flag(i: number): void;
}

const LONG_PRESS_MS = 360;

/**
 * Pointer and keyboard input for the board.
 * Mouse: left digs, right flags. Touch: tap digs, long-press flags. Keys: arrows, Space/Enter, F.
 */
export function bindBoardInput(view: BoardView, h: InputHandlers): void {
  const el = view.el;
  let press: { i: number; fired: boolean; timer: number } | null = null;
  const cellIndex = (e: Event): number | null => {
    const t = (e.target as Element | null)?.closest<HTMLElement>('.cell');
    return t?.dataset.i === undefined ? null : Number(t.dataset.i);
  };
  const cancel = () => {
    if (press) clearTimeout(press.timer);
    press = null;
  };

  el.addEventListener('contextmenu', (e) => e.preventDefault());
  // Keep the roving focus index in sync however a tile gets focus (Tab, screen reader, script).
  el.addEventListener('focusin', (e) => {
    const i = cellIndex(e);
    if (i !== null) view.moveFocus(i, false);
  });
  el.addEventListener('pointerdown', (e) => {
    const i = cellIndex(e);
    if (i === null) return;
    view.moveFocus(i, false);
    if (e.button === 2) {
      cancel();
      h.flag(i);
      return;
    }
    if (e.button !== 0) return;
    const p = { i, fired: false, timer: 0 };
    if (e.pointerType !== 'mouse') {
      p.timer = window.setTimeout(() => {
        p.fired = true;
        h.flag(i);
      }, LONG_PRESS_MS);
    }
    press = p;
  });
  el.addEventListener('pointerup', (e) => {
    if (!press || e.button !== 0) return;
    const { i, fired, timer } = press;
    clearTimeout(timer);
    press = null;
    if (!fired && cellIndex(e) === i) h.primary(i);
  });
  el.addEventListener('pointercancel', cancel);

  el.addEventListener('keydown', (e) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      view.step(...m);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      h.primary(view.focusIdx);
    } else if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      h.flag(view.focusIdx);
    }
  });
}
