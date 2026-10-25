/**
 * Velocity-Adaptive 1€ (One-Euro) Filter for Real-Time Human Motion Smoothing
 * Filters high-frequency jitter when stationary, minimizes latency when moving fast.
 * Ref: Casiez, G., Roussel, N. and Vogel, D. (2012)
 */

export class LowPassFilter {
  alpha: number;
  s: number;
  initialized: boolean;

  constructor(alpha: number, initVal = 0) {
    this.alpha = alpha;
    this.s = initVal;
    this.initialized = false;
  }

  filter(val: number, alpha?: number): number {
    if (alpha !== undefined) this.alpha = alpha;
    if (!this.initialized) {
      this.s = val;
      this.initialized = true;
      return val;
    }
    this.s = this.alpha * val + (1.0 - this.alpha) * this.s;
    return this.s;
  }

  reset() {
    this.initialized = false;
    this.s = 0;
  }
}

export class OneEuroFilter {
  freq: number;
  minCutoff: number;
  beta: number;
  dCutoff: number;
  x: LowPassFilter;
  dx: LowPassFilter;
  lastTime: number | null;

  constructor(freq = 60, minCutoff = 1.1, beta = 0.015, dCutoff = 1.0) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPassFilter(this.alpha(minCutoff));
    this.dx = new LowPassFilter(this.alpha(dCutoff));
    this.lastTime = null;
  }

  alpha(cutoff: number): number {
    const te = 1.0 / Math.max(this.freq, 1.0);
    const tau = 1.0 / (2 * Math.PI * Math.max(cutoff, 0.001));
    return 1.0 / (1.0 + tau / te);
  }

  setParams(minCutoff: number, beta: number, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  filter(val: number, timestamp?: number): number {
    if (this.lastTime !== null && timestamp !== undefined && timestamp > this.lastTime) {
      const dt = (timestamp - this.lastTime) / 1000.0;
      if (dt > 0.0005 && dt < 1.0) {
        this.freq = 1.0 / dt;
      }
    }
    this.lastTime = timestamp ?? performance.now();

    const prevX = this.x.s;
    const dxVal = !this.x.initialized ? 0 : (val - prevX) * this.freq;
    const edx = this.dx.filter(dxVal, this.alpha(this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(val, this.alpha(cutoff));
  }

  reset() {
    this.x.reset();
    this.dx.reset();
    this.lastTime = null;
  }
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export class MultiPointFilter {
  filtersX: OneEuroFilter[];
  filtersY: OneEuroFilter[];
  filtersZ: OneEuroFilter[];
  outputBuffer: LandmarkPoint[];

  constructor(pointCount = 75, freq = 60, minCutoff = 1.1, beta = 0.015) {
    this.filtersX = Array.from({ length: pointCount }, () => new OneEuroFilter(freq, minCutoff, beta));
    this.filtersY = Array.from({ length: pointCount }, () => new OneEuroFilter(freq, minCutoff, beta));
    this.filtersZ = Array.from({ length: pointCount }, () => new OneEuroFilter(freq, minCutoff, beta));
    this.outputBuffer = Array.from({ length: pointCount }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  }

  updateParams(minCutoff: number, beta: number) {
    for (let i = 0; i < this.filtersX.length; i++) {
      this.filtersX[i].setParams(minCutoff, beta);
      this.filtersY[i].setParams(minCutoff, beta);
      this.filtersZ[i].setParams(minCutoff, beta);
    }
  }

  filterLandmarks(landmarks: LandmarkPoint[] | null | undefined, timestamp?: number): LandmarkPoint[] | null {
    if (!landmarks || landmarks.length === 0) return null;
    const len = Math.min(landmarks.length, this.filtersX.length);
    for (let idx = 0; idx < len; idx++) {
      const pt = landmarks[idx];
      const out = this.outputBuffer[idx];
      if (!pt) continue;
      out.x = this.filtersX[idx].filter(pt.x, timestamp);
      out.y = this.filtersY[idx].filter(pt.y, timestamp);
      out.z = pt.z !== undefined ? this.filtersZ[idx].filter(pt.z, timestamp) : 0;
      out.visibility = pt.visibility ?? 1.0;
    }
    return this.outputBuffer;
  }

  reset() {
    for (let i = 0; i < this.filtersX.length; i++) {
      this.filtersX[i].reset();
      this.filtersY[i].reset();
      this.filtersZ[i].reset();
    }
  }
}
