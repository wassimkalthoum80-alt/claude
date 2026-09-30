/**
 * Monitor sounds via WebAudio (P1). Created lazily after a user gesture (browser autoplay policy).
 * - Pulse tone per pleth pulse whose pitch falls with SpO2 (variable-pitch pulse oximetry tone).
 * - Alarm bursts by priority (IEC 60601-1-8-like patterns, simplified).
 * - Optional soft click per compression (CPR metronome feel).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  /** Must be called from a user gesture handler the first time. */
  resume(): void {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.18;
        this.master.connect(this.ctx.destination);
      }
      void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /**
   * Pulse beep: short "bip" (fundamental + soft 2nd harmonic, 4 ms attack, ~110 ms decay) at the pitch
   * given by the SpO2 (see tones.ts).
   */
  pulse(frequency: number): void {
    this.tone(frequency, 0.11, 0.85, 'sine');
    this.tone(frequency * 2, 0.07, 0.16, 'sine');
  }

  compressionClick(): void {
    this.tone(1800, 0.018, 0.25, 'square');
  }

  alarm(priority: 'high' | 'medium'): void {
    if (priority === 'high') {
      // 3 + 2 pulse burst
      const notes = [880, 988, 1175, 0, 880, 988];
      notes.forEach((f, i) => f > 0 && this.tone(f, 0.12, 0.7, 'triangle', i * 0.15));
    } else {
      [740, 660, 587].forEach((f, i) => this.tone(f, 0.16, 0.55, 'triangle', i * 0.22));
    }
  }

  private tone(
    freq: number,
    dur: number,
    level: number,
    type: OscillatorType = 'sine',
    delay = 0,
  ): void {
    if (!this.ctx || !this.master || this.ctx.state !== 'running') return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(level, t0 + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
}
