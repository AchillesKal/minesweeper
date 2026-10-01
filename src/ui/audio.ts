/** Synthesized sound kit: oscillators and filtered noise, no audio files. */
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const note = (semi: number, base = 523.25) => base * 2 ** (semi / 12);

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  at?: number;
  to?: number;
}

export class Sound {
  muted: boolean;
  private ctx: AudioContext | null = null;

  constructor(muted = false) {
    this.muted = muted;
  }

  dig(ring: number, at = 0): void {
    const semi = PENTATONIC[Math.min(ring, PENTATONIC.length - 1)] ?? 0;
    this.tone(note(semi), 0.09, { type: 'triangle', gain: 0.07, at });
  }
  flag(on: boolean): void {
    if (on) {
      this.tone(660, 0.06, { type: 'square', gain: 0.04 });
      this.tone(990, 0.08, { type: 'square', gain: 0.04, at: 0.05 });
    } else {
      this.tone(500, 0.08, { type: 'square', gain: 0.035, to: 300 });
    }
  }
  chord(): void {
    this.tone(392, 0.06, { type: 'triangle', gain: 0.08 });
  }
  denied(): void {
    this.tone(180, 0.09, { type: 'sawtooth', gain: 0.03 });
  }
  hint(): void {
    for (const [k, s] of [0, 4, 7].entries()) this.tone(note(s + 12), 0.14, { gain: 0.06, at: k * 0.05 });
  }
  boom(big = true, at = 0): void {
    this.noise(big ? 0.9 : 0.35, big ? 0.5 : 0.18, at, big ? 2600 : 1800);
    this.tone(big ? 110 : 160, big ? 0.6 : 0.25, { gain: big ? 0.35 : 0.12, at, to: 35 });
  }
  win(): void {
    for (const [k, s] of [0, 4, 7, 12, 16, 19, 24].entries()) {
      this.tone(note(s), 0.22, { type: 'triangle', gain: 0.09, at: k * 0.075 });
    }
  }

  private context(): AudioContext | null {
    if (this.muted) return null;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(
    freq: number,
    dur: number,
    { type = 'sine', gain = 0.12, at = 0, to = 0 }: ToneOpts = {},
  ): void {
    const a = this.context();
    if (!a) return;
    const t = a.currentTime + at;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, at: number, from: number): void {
    const a = this.context();
    if (!a) return;
    const t = a.currentTime + at;
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const src = a.createBufferSource();
    const f = a.createBiquadFilter();
    const g = a.createGain();
    src.buffer = buf;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(160, t + dur);
    g.gain.setValueAtTime(gain, t);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }
}
