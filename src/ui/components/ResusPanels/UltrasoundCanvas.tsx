import { useEffect, useRef } from 'react';
import type { CardiacUltrasound, LungUltrasound } from '../../adapters/resusViewModel';
import { useDisplay, useEngine } from '../../hooks/EngineContext';
import styles from './ResusPanels.module.css';

const W = 400;
const H = 300;

/** Cheap deterministic hash noise (decoration only — no simulation randomness here). */
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function speckle(
  ctx: CanvasRenderingContext2D,
  seed: number,
  density: number,
  alpha: number,
): void {
  for (let i = 0; i < density; i++) {
    const x = hash(i, seed) * W;
    const y = hash(seed, i) * H;
    const v = 120 + hash(i, i + seed) * 135;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(x, y, 2, 1.5);
  }
}

/** Sector (fan) clip, apex at the top centre. */
function sector(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(W / 2, 8);
  ctx.arc(W / 2, 8, H - 14, Math.PI * 0.25, Math.PI * 0.75);
  ctx.closePath();
}

/** Contraction phase 0..1 (1 = end-systole) for a heart rate. */
function systole(t: number, rate: number): number {
  if (rate <= 0) return 0;
  const u = (t * rate) / 60;
  const f = u - Math.floor(u);
  return f < 0.35 ? Math.sin((f / 0.35) * Math.PI) : 0;
}

function drawCardiac(ctx: CanvasRenderingContext2D, v: CardiacUltrasound, t: number): void {
  ctx.save();
  sector(ctx);
  ctx.clip();
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, 0, W, H);
  const shake = v.motion === 'compressionArtefact' ? Math.sin(t * 2 * Math.PI * 1.8) * 18 : 0;
  ctx.translate(0, shake);
  speckle(ctx, v.motion === 'compressionArtefact' ? Math.floor(t * 20) : 1, 2600, 0.35);
  // Liver (near field).
  ctx.fillStyle = 'rgba(150,150,150,0.25)';
  ctx.beginPath();
  ctx.ellipse(W * 0.4, 70, 150, 55, -0.2, 0, Math.PI * 2);
  ctx.fill();

  const s =
    v.motion === 'fibrillating'
      ? 0.05 * Math.sin(t * 38) + 0.03 * Math.sin(t * 51)
      : systole(t, v.rate) * v.amplitude * 0.28;
  const fill = v.underfilled ? 0.7 : 1;
  const cx = W / 2 + 10;
  const cy = 185;
  // Pericardial effusion: echo-free rim.
  if (v.effusionMm > 2) {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 118 + v.effusionMm * 2, 78 + v.effusionMm * 1.6, -0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  // Myocardium / pericardium (bright).
  ctx.fillStyle = 'rgba(210,210,210,0.55)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 116, 76, -0.35, 0, Math.PI * 2);
  ctx.fill();
  speckle(ctx, 7, 500, 0.25);
  // Chambers: RV (near), LV, RA, LA — blood is black.
  const diastolicRv = v.rvCollapse ? 0.45 + 0.4 * systole(t + 0.3, Math.max(40, v.rate)) : 1;
  const chambers: [number, number, number, number, number][] = [
    [-38, -18, 34 * diastolicRv, 20 * diastolicRv, 1],
    [30, -8, 36, 26, 1],
    [-44, 38, 26, 18, 0.6],
    [30, 42, 26, 18, 0.6],
  ];
  ctx.fillStyle = '#020202';
  for (const [dx, dy, rx, ry, k] of chambers) {
    const c = 1 - s * k;
    ctx.beginPath();
    ctx.ellipse(
      cx + dx,
      cy + dy,
      Math.max(2, rx * c * fill),
      Math.max(2, ry * c * fill),
      -0.35,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  sector(ctx);
  ctx.stroke();
}

function drawLung(ctx: CanvasRenderingContext2D, v: LungUltrasound, t: number, rate: number): void {
  const split = W * 0.58;
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, 0, W, H);
  const pleura = 95;
  // Soft tissue above the pleura (static).
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, split, H);
  ctx.clip();
  speckle(ctx, 3, 900, 0.3);
  // Ribs and their acoustic shadows.
  for (const rx of [split * 0.12, split * 0.88]) {
    ctx.fillStyle = 'rgba(230,230,230,0.8)';
    ctx.beginPath();
    ctx.ellipse(rx, pleura - 18, 26, 8, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillRect(rx - 26, pleura - 18, 52, H);
  }
  // Pleural line; sliding = shimmer, lung point = sliding in part of the cycle.
  const slidingNow = v.sliding || (v.lungPoint && Math.sin(t * 1.3) > 0.3);
  const shimmer = slidingNow ? Math.sin(t * 2 * Math.PI * 0.25) * 6 : 0;
  const pulse = v.lungPulse ? systole(t, rate) * 2 : 0;
  ctx.fillStyle = 'rgba(245,245,245,0.9)';
  ctx.fillRect(split * 0.2, pleura + pulse, split * 0.6, 3);
  ctx.save();
  ctx.translate(shimmer, 0);
  ctx.beginPath();
  ctx.rect(split * 0.2 - 10, pleura + 4, split * 0.6 + 20, H);
  ctx.clip();
  if (v.bLines > 0) {
    for (let i = 0; i < v.bLines; i++) {
      const x = split * 0.25 + (i + 0.5) * ((split * 0.5) / v.bLines);
      const g = ctx.createLinearGradient(0, pleura, 0, H);
      g.addColorStop(0, 'rgba(240,240,240,0.7)');
      g.addColorStop(1, 'rgba(240,240,240,0.15)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 3, pleura + 3, 6, H);
    }
  } else {
    // A-lines: reverberations of the pleural line.
    for (const k of [2, 3]) {
      ctx.fillStyle = `rgba(200,200,200,${0.45 / k})`;
      ctx.fillRect(split * 0.2, pleura * k - 8 * (k - 1), split * 0.6, 3);
    }
  }
  speckle(ctx, slidingNow ? Math.floor(t * 8) : 11, 700, 0.22);
  ctx.restore();
  ctx.restore();

  // M-mode strip: seashore (sliding) vs barcode/stratosphere (no sliding).
  ctx.fillStyle = '#050505';
  ctx.fillRect(split + 4, 0, W - split - 4, H);
  for (let y = 0; y < pleura; y += 4) {
    const v2 = 60 + hash(y, 1) * 120;
    ctx.fillStyle = `rgba(${v2},${v2},${v2},0.8)`;
    ctx.fillRect(split + 4, y, W - split - 4, 1.5);
  }
  ctx.fillStyle = 'rgba(245,245,245,0.9)';
  ctx.fillRect(split + 4, pleura, W - split - 4, 3);
  const cols = Math.floor(W - split - 4);
  for (let x = 0; x < cols; x += 2) {
    const col = x + Math.floor(t * 30);
    const seashore = v.sliding || (v.lungPoint && Math.sin((col / 30) * 1.3) > 0.3);
    for (let y = pleura + 4; y < H; y += 3) {
      const n = seashore ? hash(col, y) : hash(0, y);
      const g = 40 + n * 150;
      ctx.fillStyle = `rgba(${g},${g},${g},0.7)`;
      ctx.fillRect(split + 4 + x, y, 2, seashore ? 2 : 1);
    }
  }
}

/** Animated schematic ultrasound image drawn from a finding (view model), in its own rAF loop. */
export function UltrasoundCanvas(props: {
  view: 'cardiac' | 'lung';
  cardiac: CardiacUltrasound;
  lung: LungUltrasound;
}) {
  const engine = useEngine();
  const display = useDisplay();
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const draw = () => {
      const p = latest.current;
      // Display clock: the probe image moves in real time at every simulation speed.
      const t = display.time;
      if (p.view === 'cardiac') drawCardiac(ctx, p.cardiac, t);
      else
        drawLung(ctx, p.lung, t, p.cardiac.rate || engine.getSnapshot().patient.cardio.heartRate);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine, display]);

  return (
    <canvas ref={ref} width={W} height={H} className={styles.canvas} data-testid="us-canvas" />
  );
}
