import { Game, type GameEvent, type Planner } from '../core/game';
import { dailyNumber, LEVELS, type Level, type LevelId, orient, todayKey } from '../core/levels';
import type { Sound } from '../ui/audio';
import type { BoardView } from '../ui/board-view';
import { byId, cssVar, h, icon } from '../ui/dom';
import { bindBoardInput } from '../ui/input';
import type { Particles } from '../ui/particles';
import { type Settings, saveSettings, type UrlOverrides } from './settings';
import { StatsBook } from './stats';
import type { KV } from './storage';

export interface AppDeps {
  readonly view: BoardView;
  readonly planner: Planner;
  readonly sound: Sound;
  readonly particles: Particles;
  readonly kv: KV;
  readonly settings: Settings;
  readonly url: UrlOverrides;
}

type Mode =
  | { readonly kind: 'level'; readonly id: Exclude<LevelId, 'daily'> }
  | { readonly kind: 'daily' }
  | { readonly kind: 'shared'; readonly id: LevelId; readonly seed: string };

const MAX_DIG_SOUNDS = 11;

/** Wires a Game to the page: renders its events, runs the clock, and handles the controls. */
export class App {
  private game: Game | null = null;
  private generation = 0;
  private timer = 0;
  private flagMode = false;
  private mode: Mode;
  private readonly stats: StatsBook;
  private readonly status = byId('status');
  private readonly modes = byId('modes');

  constructor(private readonly d: AppDeps) {
    this.stats = new StatsBook(d.kv);
    this.mode = d.url.seed
      ? { kind: 'shared', id: d.url.level ?? d.settings.level, seed: d.url.seed }
      : modeFor(d.url.level ?? d.settings.level);
  }

  async start(): Promise<void> {
    this.renderModes();
    bindBoardInput(this.d.view, {
      primary: (i) => this.primary(i),
      flag: (i) => this.game?.flag(i),
    });
    byId('flagMode').addEventListener('click', () => this.setFlagMode(!this.flagMode));
    byId('hint').addEventListener('click', () => void this.hint());
    byId('newGame').addEventListener('click', () => void this.newGame());
    byId('mute').addEventListener('click', () => this.toggleMute());
    byId<HTMLInputElement>('noGuess').addEventListener('change', (e) => {
      this.d.settings.noGuess = (e.target as HTMLInputElement).checked;
      this.persist();
      if (!this.game?.started) void this.newGame();
    });
    document.addEventListener('keydown', (e) => this.shortcut(e));
    addEventListener('resize', () => this.d.view.fit());
    document.addEventListener('visibilitychange', () => this.tick());
    this.syncMute();
    await this.newGame();
  }

  async newGame(): Promise<void> {
    const gen = ++this.generation;
    clearInterval(this.timer);
    const base = this.baseLevel();
    const level = orient(base, innerWidth < 700 && innerHeight > innerWidth);
    const seed =
      this.mode.kind === 'daily'
        ? `daily:${todayKey()}`
        : this.mode.kind === 'shared'
          ? this.mode.seed
          : undefined;

    this.renderModes();
    const noGuessBox = byId<HTMLInputElement>('noGuess');
    noGuessBox.disabled = seed !== undefined;
    noGuessBox.checked = seed !== undefined || this.d.settings.noGuess;
    this.say(seed ? 'Setting up the board.' : '');

    const game = await Game.create({
      level,
      noGuess: this.d.settings.noGuess,
      planner: this.d.planner,
      ...(seed ? { seed } : {}),
    });
    if (gen !== this.generation) return; // a newer game was requested while this one generated
    this.game = game;
    game.on((e) => this.onEvent(game, e));
    this.d.view.mount(game.board, level, game.start);
    this.tick();
    this.renderStats();
    this.intro();
  }

  // ---------- events ----------
  private onEvent(game: Game, e: GameEvent): void {
    if (game !== this.game) return;
    const { view, sound } = this.d;
    switch (e.type) {
      case 'started':
        this.say('');
        this.timer = window.setInterval(() => this.tick(), 250);
        break;
      case 'opened': {
        if (e.chord) sound.chord();
        const rings = new Set<number>();
        for (const { i, depth } of e.cells) {
          view.paint(i, 'dig', Math.min(depth * 30, 700));
          if (!rings.has(depth) && rings.size < MAX_DIG_SOUNDS) {
            rings.add(depth);
            sound.dig(depth, Math.min(depth * 0.03, 0.7));
          }
        }
        break;
      }
      case 'flagged':
        sound.flag(e.on);
        view.paint(e.i, e.on ? 'plant' : undefined);
        if (e.on) navigator.vibrate?.(10);
        break;
      case 'denied':
        sound.denied();
        if (e.reason === 'chord') view.peek(e.i);
        if (e.reason === 'not-ready')
          this.say('Dig a tile first. You can place flags once the board is set.');
        break;
      case 'hinted':
        sound.hint();
        view.markHinted(e.i);
        view.moveFocus(e.i);
        this.say(`Hint used. That tile was safe, and ${e.penalty} seconds went on the clock.`);
        break;
      case 'exploded':
        this.explode(game, e.hit, e.mines, e.wrongFlags);
        break;
      case 'won':
        this.win(game, e.time);
        break;
    }
    this.tick();
  }

  private explode(game: Game, hit: number, mines: readonly number[], wrong: readonly number[]): void {
    const { view, sound, particles } = this.d;
    clearInterval(this.timer);
    const cols = game.level.cols;
    const dist = (i: number) =>
      Math.hypot(Math.floor(i / cols) - Math.floor(hit / cols), (i % cols) - (hit % cols));
    view.showMine(hit, 'boom');
    view.setOutcome('lost');
    sound.boom(true);
    const c = view.centre(hit);
    particles.burst(c.x, c.y, [cssVar('--flag'), cssVar('--accent'), cssVar('--mine-c'), '#fff'], 70, 640);

    // The rest go off outward from the hit; the nearest few get their own bang.
    let bangs = 0;
    for (const i of [...mines].sort((a, b) => dist(a) - dist(b))) {
      const delay = Math.min(150 + dist(i) * 45, 1400);
      view.showMine(i, 'mine', delay);
      if (bangs < 6 && dist(i) < 8) {
        bangs++;
        sound.boom(false, delay / 1000);
        window.setTimeout(() => {
          const p = view.centre(i);
          particles.burst(p.x, p.y, [cssVar('--mine-c'), cssVar('--flag')], 12, 260);
        }, delay);
      }
    }
    for (const i of wrong) view.showMine(i, 'wrong');

    this.record(game, false);
    const b = game.board;
    this.say(
      h('strong', null, 'Boom.'),
      ` You cleared ${b.opened} of ${b.safeTotal} tiles.`,
      game.noGuessBoard ? ' This board was solvable, so there was a safe move.' : '',
      ' Press New game or ',
      h('kbd', null, 'N'),
      ' to go again.',
    );
  }

  private win(game: Game, time: number): void {
    const { view, sound, particles } = this.d;
    clearInterval(this.timer);
    game.board.cells.forEach((c, i) => {
      if (c.mine) view.paint(i, 'plant', 300 + Math.random() * 500);
    });
    view.setOutcome('won');
    sound.win();
    particles.confetti([cssVar('--accent'), cssVar('--flag'), cssVar('--n1'), cssVar('--n2'), '#ffffff']);
    const best = this.record(game, true);
    this.say(
      h('strong', null, `Cleared in ${time.toFixed(1)} seconds.`),
      game.hints > 0 ? ` That includes ${game.hints * 10} seconds of hints.` : '',
      best ? ' ' : '',
      best ? h('span', { class: 'best' }, 'New personal best.') : '',
    );
  }

  // ---------- actions ----------
  private primary(i: number): void {
    const g = this.game;
    if (!g) return;
    if (this.flagMode && !g.board.cell(i).open) g.flag(i);
    else void g.dig(i);
  }

  private async hint(): Promise<void> {
    await this.game?.hint(this.d.view.focusIdx);
  }

  private shortcut(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    if ((e.target as Element | null)?.closest('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'f') this.setFlagMode(!this.flagMode);
    else if (k === 'h') void this.hint();
    else if (k === 'n') void this.newGame();
    else if (k === 'm') this.toggleMute();
    else return;
    e.preventDefault();
  }

  private setFlagMode(on: boolean): void {
    this.flagMode = on;
    byId('flagMode').setAttribute('aria-pressed', String(on));
  }

  private toggleMute(): void {
    this.d.sound.muted = !this.d.sound.muted;
    this.d.settings.muted = this.d.sound.muted;
    this.persist();
    this.syncMute();
  }

  private syncMute(): void {
    const muted = this.d.sound.muted;
    const b = byId('mute');
    b.setAttribute('aria-pressed', String(!muted));
    b.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
    b.title = `${muted ? 'Turn sound on' : 'Turn sound off'} (M)`;
    b.replaceChildren(icon(muted ? 'mute' : 'sound'));
  }

  private selectMode(m: Mode): void {
    this.mode = m;
    if (m.kind === 'level') this.d.settings.level = m.id;
    this.persist();
    if (location.search) history.replaceState(null, '', location.pathname);
    void this.newGame();
  }

  // ---------- rendering ----------
  private renderModes(): void {
    const day = todayKey();
    const active = this.mode.kind === 'level' ? this.mode.id : this.mode.kind === 'daily' ? 'daily' : null;
    const buttons = (['easy', 'medium', 'expert', 'daily'] as const).map((id) => {
      const l = LEVELS[id];
      const b = h(
        'button',
        {
          type: 'button',
          title: `${l.cols} × ${l.rows}, ${l.mines} mines`,
          'aria-pressed': String(active === id),
        },
        id === 'daily' ? `Daily #${dailyNumber(day)}` : l.label,
      );
      b.addEventListener('click', () => this.selectMode(modeFor(id)));
      return b;
    });
    if (this.mode.kind === 'shared') {
      buttons.push(
        h(
          'button',
          { type: 'button', 'aria-pressed': 'true', title: `Board code ${this.mode.seed}` },
          'Shared board',
        ),
      );
    }
    this.modes.replaceChildren(...buttons);
  }

  private tick(): void {
    const g = this.game;
    if (!g) return;
    byId('mines').textContent = String(g.board.minesLeft);
    const s = Math.floor(g.elapsed);
    byId('time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  private intro(): void {
    const g = this.game;
    if (!g) return;
    if (this.mode.kind === 'daily') {
      this.say(
        `Daily #${dailyNumber(todayKey())}. Everyone plays this board today, and it can be solved without guessing. The clock starts on your first move.`,
      );
    } else if (this.mode.kind === 'shared') {
      this.say(
        'Shared board. Anyone with this link gets the same board and opening. The clock starts on your first move.',
      );
    } else {
      this.say(
        `Dig anywhere to start. Your first dig always opens an area${g.noGuessBoard ? ', and the board can be cleared by logic alone' : ''}.`,
      );
    }
  }

  private statsId(): string | null {
    if (this.mode.kind === 'daily') return `daily.${todayKey()}`;
    if (this.mode.kind === 'level') return this.mode.id;
    return null;
  }

  private record(game: Game, won: boolean): boolean {
    const id = this.statsId();
    if (!id) return false;
    const best = this.stats.record(id, won, game.elapsed);
    this.renderStats();
    return best;
  }

  private renderStats(): void {
    const id = this.statsId();
    const el = byId('stats');
    if (!id) {
      el.textContent = 'Shared boards are not counted in your stats.';
      return;
    }
    const s = this.stats.get(id);
    const name = this.mode.kind === 'daily' ? "Today's daily" : this.baseLevel().label;
    el.textContent =
      s.played === 0
        ? `${name}: no games yet.`
        : `${name}: won ${s.won} of ${s.played}${s.best === null ? '' : `, best ${s.best.toFixed(1)} s`}.`;
  }

  private say(...parts: (Node | string)[]): void {
    this.status.replaceChildren(...parts);
  }

  private baseLevel(): Level {
    return this.mode.kind === 'daily' ? LEVELS.daily : LEVELS[this.mode.id];
  }

  private persist(): void {
    saveSettings(this.d.kv, this.d.settings);
  }
}

function modeFor(id: LevelId): Mode {
  return id === 'daily' ? { kind: 'daily' } : { kind: 'level', id };
}
