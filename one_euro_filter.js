/**
 * 1€ (One-Euro) Filter for Real-Time Human Motion Smoothing
 * Filters high-frequency jitter when stationary, minimizes latency when moving fast.
 * Ref: Casiez, G., Roussel, N. and Vogel, D. (2012)
 */

class LowPassFilter {
  constructor(alpha, initVal = 0) {
    this.alpha = alpha;
    this.s = initVal;
    this.initialized = false;
  }

  filter(val, alpha) {
    if (alpha !== undefined) this.alpha = alpha;
    if (!this.initialized) {
      this.s = val;
      this.initialized = true;
      return val;
    }
    this.s = this.alpha * val + (1.0 - this.alpha) * this.s;
    return this.s;
  }
}

export class OneEuroFilter {
  constructor(freq = 60, minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPassFilter(this.alpha(minCutoff));
    this.dx = new LowPassFilter(this.alpha(dCutoff));
    this.lastTime = null;
  }

  alpha(cutoff) {
    const te = 1.0 / this.freq;
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  filter(val, timestamp) {
    if (this.lastTime !== null && timestamp !== undefined) {
      this.freq = Math.max(1.0 / ((timestamp - this.lastTime) / 1000.0), 1.0);
    }
    this.lastTime = timestamp || performance.now();

    const prevX = this.x.s;
    const dxVal = !this.x.initialized ? 0 : (val - prevX) * this.freq;
    const edx = this.dx.filter(dxVal, this.alpha(this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(val, this.alpha(cutoff));
  }
}

export class MultiPointFilter {
  constructor(pointCount = 75, freq = 60, minCutoff = 1.0, beta = 0.007) {
    this.filtersX = Array.from({ length: pointCount }, () => new OneEuroFilter(freq, minCutoff, beta));
    this.filtersY = Array.from({ length: pointCount }, () => new OneEuroFilter(freq, minCutoff, beta));
    this.filtersZ = Array.from({ length: pointCount }, () => new OneEuroFilter(freq, minCutoff, beta));
  }

  filterLandmarks(landmarks, timestamp) {
    if (!landmarks) return null;
    return landmarks.map((pt, idx) => {
      if (!pt) return pt;
      const fx = this.filtersX[idx] ? this.filtersX[idx].filter(pt.x, timestamp) : pt.x;
      const fy = this.filtersY[idx] ? this.filtersY[idx].filter(pt.y, timestamp) : pt.y;
      const fz = this.filtersZ[idx] && pt.z !== undefined ? this.filtersZ[idx].filter(pt.z, timestamp) : pt.z;
      return {
        ...pt,
        x: fx,
        y: fy,
        z: fz
      };
    });
  }
}
