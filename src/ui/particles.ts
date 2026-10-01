interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  readonly max: number;
  readonly size: number;
  readonly color: string;
  rot: number;
  readonly vr: number;
  readonly rect: boolean;
  readonly drag: number;
}

const GRAVITY = 900;

/** Full-screen canvas for explosions and confetti. Created on first use, idle when empty. */
export class Particles {
  private canvas: HTMLCanvasElement | null = null;
  private g: CanvasRenderingContext2D | null = null;
  private ps: Particle[] = [];
  private raf = 0;
  private last = 0;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');

  burst(x: number, y: number, colors: readonly string[], count = 40, power = 520): void {
    if (!this.ready()) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = power * (0.25 + Math.random() * 0.75);
      this.ps.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - power * 0.35,
        life: 0,
        max: 0.6 + Math.random() * 0.7,
        size: 3 + Math.random() * 6,
        color: colors[i % colors.length] ?? '#fff',
        rot: a,
        vr: (Math.random() - 0.5) * 20,
        rect: Math.random() < 0.4,
        drag: 0.985,
      });
    }
    this.kick();
  }

  confetti(colors: readonly string[]): void {
    if (!this.ready()) return;
    for (let i = 0; i < 160; i++) {
      const left = i % 2 === 0;
      this.ps.push({
        x: left ? -10 : innerWidth + 10,
        y: innerHeight * (0.55 + Math.random() * 0.3),
        vx: (left ? 1 : -1) * (300 + Math.random() * 600),
        vy: -(600 + Math.random() * 700),
        life: 0,
        max: 2.2 + Math.random(),
        size: 7 + Math.random() * 7,
        color: colors[i % colors.length] ?? '#fff',
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 16,
        rect: true,
        drag: 0.975,
      });
    }
    this.kick();
  }

  private ready(): boolean {
    if (this.reduced.matches) return false;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'fx';
      this.canvas.setAttribute('aria-hidden', 'true');
      document.body.append(this.canvas);
      this.g = this.canvas.getContext('2d');
      this.resize();
      addEventListener('resize', () => this.resize());
    }
    return this.g !== null;
  }

  private resize(): void {
    if (!this.canvas || !this.g) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private kick(): void {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (t: number): void => {
    const g = this.g;
    if (!g) return;
    const dt = Math.min(0.033, (t - this.last) / 1000 || 0.016);
    this.last = t;
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of this.ps) p.life += dt;
    this.ps = this.ps.filter((p) => p.life < p.max);
    for (const p of this.ps) {
      p.vy += GRAVITY * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      g.globalAlpha = Math.max(0, 1 - (p.life / p.max) ** 3);
      g.fillStyle = p.color;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      if (p.rect) g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else {
        g.beginPath();
        g.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    g.globalAlpha = 1;
    this.raf = this.ps.length > 0 ? requestAnimationFrame(this.frame) : 0;
  };
}
