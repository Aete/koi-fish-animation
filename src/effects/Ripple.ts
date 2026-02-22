import { RippleParams } from '../gui/RippleParams';

/**
 * Ripple - Water surface ripple effect
 * Concentric circles expand on click, applying scatter force and distortion to fish
 */
export class Ripple {
  cx: number;
  cy: number;
  radius: number;
  amplitude: number;
  alive: boolean;
  // Snapshot of initial amplitude at creation
  private _initAmplitude: number;
  private _maxRadius: number;
  private _sr: number; private _sg: number; private _sb: number;
  private _fr: number; private _fg: number; private _fb: number;

  constructor(x: number, y: number) {
    this.cx = x;
    this.cy = y;
    this.radius = 0;
    this._initAmplitude = RippleParams.amplitude;
    this.amplitude = this._initAmplitude;
    this._maxRadius = RippleParams.maxRadiusMin + Math.random() * (RippleParams.maxRadiusMax - RippleParams.maxRadiusMin);
    this.alive = true;
    // Parse hex colors once at construction instead of every frame
    const sc = RippleParams.strokeColor;
    this._sr = parseInt(sc.slice(1, 3), 16);
    this._sg = parseInt(sc.slice(3, 5), 16);
    this._sb = parseInt(sc.slice(5, 7), 16);
    const fc = RippleParams.fillColor;
    this._fr = parseInt(fc.slice(1, 3), 16);
    this._fg = parseInt(fc.slice(3, 5), 16);
    this._fb = parseInt(fc.slice(5, 7), 16);
  }

  update(): void {
    this.radius += RippleParams.speed;
    // Amplitude decay: weakens as radius grows
    this.amplitude = this._initAmplitude * (1 - this.radius / this._maxRadius);
    if (this.radius > this._maxRadius) {
      this.alive = false;
    }
  }

  /**
   * Return displacement vector for a given coordinate
   * Only active near the wavefront
   */
  getDisplacement(x: number, y: number): { dx: number; dy: number } {
    const ddx = x - this.cx;
    const ddy = y - this.cy;
    const distSq = ddx * ddx + ddy * ddy;
    const dist = Math.sqrt(distSq);

    const waveWidth = RippleParams.waveWidth;
    // Early return: outside wave range
    const diff = dist - this.radius;
    if (Math.abs(diff) > waveWidth) {
      return { dx: 0, dy: 0 };
    }

    // Gaussian envelope * sin wave
    const halfWidth = waveWidth * 0.5;
    const envelope = Math.exp(-(diff * diff) / (2 * halfWidth * halfWidth));
    const wave = Math.sin((diff / waveWidth) * Math.PI * 2);
    const displacement = this.amplitude * envelope * wave;

    // Push outward from center
    if (dist < 0.1) return { dx: 0, dy: 0 };
    const invDist = 1 / dist;
    return {
      dx: ddx * invDist * displacement,
      dy: ddy * invDist * displacement,
    };
  }

  /**
   * Render concentric circle visual effect on trail layer
   */
  display(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) return;

    const progress = this.radius / this._maxRadius;
    const baseAlpha = RippleParams.strokeAlpha * (1 - progress);
    if (baseAlpha <= 0) return;

    const { fillAlpha, ringCount, ringGap, lineWidth } = RippleParams;
    const sr = this._sr, sg = this._sg, sb = this._sb;
    const fr = this._fr, fg = this._fg, fb = this._fb;

    ctx.save();
    ctx.lineWidth = lineWidth;

    for (let i = 0; i < ringCount; i++) {
      const r = this.radius - i * ringGap;
      if (r <= 0) continue;
      const alpha = baseAlpha * (1 - i * (0.9 / ringCount));
      if (alpha <= 0) continue;

      ctx.beginPath();
      ctx.arc(this.cx, this.cy, r, 0, Math.PI * 2);

      // Fill
      const fa = fillAlpha * (1 - progress);
      if (fa > 0) {
        ctx.fillStyle = `rgba(${fr}, ${fg}, ${fb}, ${fa})`;
        ctx.fill();
      }

      // Stroke
      ctx.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, ${alpha})`;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Scatter force away from ripple center
   */
  getScatterForce(fishX: number, fishY: number): { fx: number; fy: number } {
    const { scatterWindow, scatterStrength } = RippleParams;
    const scatterRange = Math.min(window.innerWidth * 0.3, 300);
    const progress = this.radius / this._maxRadius;
    if (progress > scatterWindow) return { fx: 0, fy: 0 };

    const ddx = fishX - this.cx;
    const ddy = fishY - this.cy;
    const distSq = ddx * ddx + ddy * ddy;
    const dist = Math.sqrt(distSq);

    if (dist < 1) return { fx: 0, fy: 0 };
    if (dist > scatterRange) return { fx: 0, fy: 0 };

    const distRatio = 1 - dist / scatterRange;
    // Proximity boost: closer fish get stronger force
    const proximityBoost = 1 + RippleParams.distanceFactor * distRatio;
    const strength = scatterStrength * distRatio * proximityBoost * (1 - progress / scatterWindow);
    const invDist = 1 / dist;

    return {
      fx: ddx * invDist * strength,
      fy: ddy * invDist * strength,
    };
  }
}
