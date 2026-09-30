import type { SeededRng } from '../core/rng';
import { compressionDuration } from '../physiology/CardiovascularModel';
import { CPR } from '../physiology/parameters';
import { approach } from '../physiology/shapes';
import type { CPRState, CprQualityPreset } from '../state/CPRState';
import type { CompressionEvent, CompressionKinematics } from '../types/events';
import type { GuidelineSet } from '../types/guidelines';
import { AutoCompressor, type CompressionSource } from './compressionSources';
import { assessCprQuality, CPR_PRESETS } from './cprQuality';

const METRIC_WINDOW = 6;

/**
 * Runs CPR: pulls compressions from the active source, keeps the measured metrics, updates the priming
 * factor and answers "where is the chest right now?" for the physiology, the signals and the scene.
 */
export class CPREngine {
  private source: CompressionSource = new AutoCompressor();
  private recent: CompressionEvent[] = [];
  private current: CompressionEvent | null = null;

  constructor(private readonly guidelines: GuidelineSet) {}

  reset(cpr: CPRState): void {
    this.source.stop();
    this.recent = [];
    this.current = null;
    cpr.active = false;
    cpr.rate = null;
    cpr.depth = null;
    cpr.recoil = null;
    cpr.compressionCount = 0;
    cpr.totalCompressions = 0;
    cpr.lastCompressionTime = null;
    cpr.primingFactor = 0;
    cpr.quality = null;
    cpr.source = this.source.id;
  }

  start(cpr: CPRState, t: number): void {
    if (cpr.active) return;
    cpr.active = true;
    cpr.compressionCount = 0;
    this.recent = [];
    this.source.start(t);
  }

  stop(cpr: CPRState): void {
    if (!cpr.active) return;
    cpr.active = false;
    this.source.stop();
  }

  setPreset(cpr: CPRState, preset: CprQualityPreset): void {
    cpr.preset = preset;
    cpr.target = { ...CPR_PRESETS[preset] };
  }

  /** Fast step: compressions that start in (previous call, t]. */
  poll(t: number, cpr: CPRState, rng: SeededRng): CompressionEvent[] {
    if (!cpr.active) return [];
    return this.source.poll(t, cpr.target, rng);
  }

  /** Register a compression: metrics + priming. Call before the physiology consumes it. */
  onCompression(ev: CompressionEvent, cpr: CPRState): void {
    this.current = ev;
    this.recent.push(ev);
    if (this.recent.length > METRIC_WINDOW) this.recent.shift();
    cpr.compressionCount += 1;
    cpr.totalCompressions += 1;
    cpr.lastCompressionTime = ev.t;
    // Priming moves a fixed fraction of the way to 1 with every compression.
    cpr.primingFactor += (1 - cpr.primingFactor) * CPR.primingGainPerCompression;

    if (this.recent.length >= 2) {
      const first = this.recent[0];
      const last = this.recent[this.recent.length - 1];
      if (first && last && last.t > first.t) {
        cpr.rate = Math.round((60 * (this.recent.length - 1)) / (last.t - first.t));
      }
    }
    const n = this.recent.length;
    cpr.depth = Math.round((this.recent.reduce((s, e) => s + e.depthCm, 0) / n) * 10) / 10;
    cpr.recoil = this.recent.reduce((s, e) => s + e.recoil, 0) / n;
    if (cpr.rate !== null) {
      cpr.quality = assessCprQuality(cpr.rate, cpr.depth, cpr.recoil, this.guidelines);
    }
  }

  /** Slow step: priming decays once a compression is overdue; metrics clear when CPR stops. */
  slowUpdate(cpr: CPRState, t: number, dt: number): void {
    const interval = 60 / cpr.target.rate;
    const last = cpr.lastCompressionTime;
    const overdue = last === null || t - last > CPR.primingGraceIntervals * interval;
    if (overdue) {
      cpr.primingFactor = approach(cpr.primingFactor, 0, dt, CPR.primingDecayTauS);
    }
    if (!cpr.active) {
      cpr.rate = null;
      cpr.depth = null;
      cpr.recoil = null;
      cpr.quality = null;
    }
  }

  /** Where the chest is at time t (null when no compression cycle is in progress). */
  kinematics(t: number): CompressionKinematics | null {
    const ev = this.current;
    if (!ev) return null;
    const dur = compressionDuration(ev.intervalS);
    const elapsed = t - ev.t;
    if (elapsed < 0) return null;
    if (elapsed < dur) {
      return {
        phase: 'compression',
        u: elapsed / dur,
        depthCm: ev.depthCm,
        recoil: ev.recoil,
        compressionDurationS: dur,
      };
    }
    const releaseDur = Math.max(0.05, ev.intervalS - dur);
    const u = (elapsed - dur) / releaseDur;
    if (u >= 1.5) return null; // CPR stopped: no further cycle
    return {
      phase: 'release',
      u: Math.min(1, u),
      depthCm: ev.depthCm,
      recoil: ev.recoil,
      compressionDurationS: dur,
    };
  }
}
