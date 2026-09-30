/**
 * In-place iterative radix-2 FFT (length must be a power of two). Used by the processed-EEG device.
 * @param re real parts (overwritten) @param im imaginary parts (overwritten)
 */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i] ?? 0;
      re[i] = re[j] ?? 0;
      re[j] = tr;
      const ti = im[i] ?? 0;
      im[i] = im[j] ?? 0;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = (re[b] ?? 0) * cr - (im[b] ?? 0) * ci;
        const xi = (re[b] ?? 0) * ci + (im[b] ?? 0) * cr;
        re[b] = (re[a] ?? 0) - xr;
        im[b] = (im[a] ?? 0) - xi;
        re[a] = (re[a] ?? 0) + xr;
        im[a] = (im[a] ?? 0) + xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/**
 * One-sided power spectral density (µV²/Hz) of a Hann-windowed segment.
 * @param x samples (µV) @param fs Hz
 */
export function powerSpectrum(x: Float32Array, fs: number): { psd: Float64Array; df: number } {
  const n = x.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i] ?? 0;
  mean /= n;
  let wsum = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    re[i] = ((x[i] ?? 0) - mean) * w;
    wsum += w * w;
  }
  fft(re, im);
  const half = n / 2;
  const psd = new Float64Array(half + 1);
  const scale = 1 / (fs * wsum);
  for (let k = 0; k <= half; k++) {
    const p = ((re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2) * scale;
    psd[k] = k === 0 || k === half ? p : 2 * p;
  }
  return { psd, df: fs / n };
}

/** Power (µV²) between f1 and f2 Hz. */
export function bandPower(psd: Float64Array, df: number, f1: number, f2: number): number {
  let p = 0;
  const k1 = Math.max(0, Math.ceil(f1 / df));
  const k2 = Math.min(psd.length - 1, Math.floor(f2 / df));
  for (let k = k1; k <= k2; k++) p += psd[k] ?? 0;
  return p * df;
}

/** Spectral edge frequency: below it lies `fraction` of the power between f1 and f2. */
export function spectralEdge(
  psd: Float64Array,
  df: number,
  f1: number,
  f2: number,
  fraction: number,
): number {
  const total = bandPower(psd, df, f1, f2);
  if (total <= 0) return f1;
  let acc = 0;
  const k1 = Math.max(0, Math.ceil(f1 / df));
  const k2 = Math.min(psd.length - 1, Math.floor(f2 / df));
  for (let k = k1; k <= k2; k++) {
    acc += (psd[k] ?? 0) * df;
    if (acc >= fraction * total) return k * df;
  }
  return f2;
}
