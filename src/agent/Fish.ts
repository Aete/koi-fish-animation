import { Physics } from '../world/Physics';
import { Segment } from './Segment';
import type { QualitySettings } from '../types/QualitySettings';
import {
  FIN_INK_ALPHA, FIN_ACCENT_ALPHA, FIN_LENGTH, FIN_WIDTH, FIN_ROUNDNESS,
  FIN_OSC_SPEED, FIN_OSC_AMPLITUDE, FIN_PHASE_OFFSET,
  PECTORAL_POSITION, FIN_BASE_ANGLE,
} from '../gui/FinParams';
import type { Ripple } from '../effects/Ripple';
import type p5 from 'p5';

// Streamlined koi profile (seg7→seg0 order) - leaf-shaped koi silhouette
const KOI_PROFILE = [0.35, 0.55, 0.75, 0.95, 1.0, 1.08, 1.0, 0.8] as const;

// Catmull-Rom spline interpolation (module-level to avoid closure re-creation)
function interpolateSpline(pts: {x: number, y: number}[], subdivisions: number): {x: number, y: number}[] {
  const result: {x: number, y: number}[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let t = 0; t < subdivisions; t++) {
      const f = t / subdivisions;
      const f2 = f * f;
      const f3 = f2 * f;
      const x = 0.5 * ((2 * p1.x) +
        (-p0.x + p2.x) * f +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f3);
      const y = 0.5 * ((2 * p1.y) +
        (-p0.y + p2.y) * f +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f3);
      result.push({ x, y });
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

// Pseudo-noise hash (GLSL fract pattern)
function fastNoise(seed: number): number {
  const raw = Math.sin(seed * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
}

/**
 * Fish - Autonomous fish agent class
 * IK-based movement with ink wash style rendering
 */
export class Fish {
  position: p5.Vector; // Head position
  velocity: p5.Vector;
  acceleration: p5.Vector;

  // Physical properties
  maxSpeed: number;
  maxForce: number;
  size: number;

  // Behavior parameters
  wanderTheta: number;

  // Visual properties
  brushType: string;
  color: p5.Color;
  opacity: number;

  // IK skeleton system
  segments: Segment[];
  segmentCount: number;
  segmentLength: number;

  // Swim animation
  swimOffset: number;

  // Rendering noise seed (stable across frames)
  noiseSeed: number;

  // Spot pattern (body length ratio 0~1, width ratio 0~1, size)
  spotPattern: { along: number; across: number; size: number }[];

  // Spot/tail accent color (vermilion or blue)
  accentRGB: [number, number, number];

  // Movement direction (actual velocity vector angle)
  movementAngle: number;

  // Base speed for recovery after scatter boost
  baseMaxSpeed: number;

  // Reusable vectors (avoid per-frame allocation)
  private _steerVec!: p5.Vector;
  private _wanderCircle!: p5.Vector;
  private _wanderOffset!: p5.Vector;
  private _wanderTarget!: p5.Vector;

  constructor(x: number, y: number) {
    const p = (window as any).p5Instance;

    this.position = p.createVector(x, y);
    this.velocity = p.constructor.Vector.random2D();
    this.velocity.mult(p.random(0.8, 1.5));
    this.acceleration = p.createVector(0, 0);

    // Size variation
    this.size = p.random(210, 360);

    // Speed scales inversely with size (larger fish are slower and more graceful)
    const sizeRatio = p.map(this.size, 173, 302, 1.15, 0.75);
    this.maxSpeed = p.random(1.5, 2.5) * sizeRatio;
    this.baseMaxSpeed = this.maxSpeed;
    this.maxForce = 0.15;

    this.wanderTheta = 0;
    this.swimOffset = 0;
    this.noiseSeed = p.random(10000);
    this.movementAngle = 0;

    // Random accent color (vermilion or blue)
    this.accentRGB = p.random() < 0.5
      ? [220, 100, 30]   // vermilion
      : [30, 80, 180];   // blue

    // Generate spot pattern (2~4 spots, distributed evenly)
    const spotCount = Math.floor(p.random(2, 5));
    this.spotPattern = [];
    // Divide body into spotCount sections, place one spot per section
    for (let i = 0; i < spotCount; i++) {
      const sectionStart = 0.15 + (0.7 / spotCount) * i;
      const sectionEnd = 0.15 + (0.7 / spotCount) * (i + 1);
      this.spotPattern.push({
        along: p.random(sectionStart, sectionEnd),
        across: p.random(0.1, 0.9),
        size: p.random(0.25, 0.5),
      });
    }

    // Minimal design: dark body + cyan or pink accent
    const accentColorChoices = [
      p.color(0, 200, 200),      // cyan
      p.color(255, 80, 150),     // magenta/pink
    ];

    this.color = p.random(accentColorChoices);
    this.opacity = 255;
    this.brushType = 'marker';

    // Initialize reusable vectors
    this._steerVec = p.createVector(0, 0);
    this._wanderCircle = p.createVector(0, 0);
    this._wanderOffset = p.createVector(0, 0);
    this._wanderTarget = p.createVector(0, 0);

    // Initialize IK skeleton system (proportional to size)
    this.segmentCount = 8;
    this.segmentLength = this.size * 0.06;
    this.segments = [];
    this.swimOffset = 0;

    // Create segments (head to tail)
    // Each segment connects properly: segment[i].b = segment[i+1].a
    for (let i = 0; i < this.segmentCount; i++) {
      let segX, segY, angle;

      if (i === 0) {
        // First segment: starts at head position
        segX = x;
        segY = y;
        angle = Math.PI; // backward direction
      } else {
        // Remaining segments: start at previous segment's end point
        segX = this.segments[i - 1].b.x;
        segY = this.segments[i - 1].b.y;
        angle = Math.PI;
      }

      const segment = new Segment(segX, segY, this.segmentLength, angle);
      this.segments.push(segment);
    }

  }

  /**
   * Update fish behavior (autonomous wandering)
   */
  update(_physics: Physics, _time: number): void {
    const p = (window as any).p5Instance;

    // Store previous position
    const prevX = this.position.x;
    const prevY = this.position.y;

    // Wander behavior (autonomous roaming)
    const wanderForce = this.wander();
    this.applyForce(wanderForce);

    // Screen boundary handling (wraparound - appear on opposite side)
    const margin = this.size * 0.2;
    if (this.position.x < -margin) {
      this.position.x = p.width + margin;
      this.resetSegments();
    } else if (this.position.x > p.width + margin) {
      this.position.x = -margin;
      this.resetSegments();
    }
    if (this.position.y < -margin) {
      this.position.y = p.height + margin;
      this.resetSegments();
    } else if (this.position.y > p.height + margin) {
      this.position.y = -margin;
      this.resetSegments();
    }

    // Gradually restore maxSpeed (boost → base speed)
    if (this.maxSpeed > this.baseMaxSpeed) {
      this.maxSpeed += (this.baseMaxSpeed - this.maxSpeed) * 0.05;
      if (this.maxSpeed - this.baseMaxSpeed < 0.01) {
        this.maxSpeed = this.baseMaxSpeed;
      }
    }

    // Physics update
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);

    // Calculate actual movement speed
    const dx = this.position.x - prevX;
    const dy = this.position.y - prevY;
    const speed = Math.sqrt(dx * dx + dy * dy);

    // Update movement direction (actual moving direction)
    if (speed > 0.1) {
      const targetAngle = Math.atan2(dy, dx);
      // Smooth rotation (angle lerp)
      const angleDiff = targetAngle - this.movementAngle;
      // Normalize angle difference to -PI ~ PI range
      const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      const maxTurn = (20 * Math.PI) / 180; // Max 20 degrees per frame
      const turnAmount = Math.max(-maxTurn, Math.min(maxTurn, normalizedDiff * 0.2));
      this.movementAngle += turnAmount;
    }

    // Swim animation (proportional to speed)
    this.swimOffset += speed * 0.15;

    // Update IK skeleton
    this.updateSkeleton();
  }

  /**
   * Update IK skeleton system (swim effect with sine wave)
   */
  updateSkeleton(): void {
    // First segment (head) follows target position, facing backward
    // Head also sways side to side (~8 degrees)
    const headSwingAmplitude = Math.PI / 22;
    const headSwingAngle = Math.sin(this.swimOffset) * headSwingAmplitude;

    this.segments[0].a.set(this.position.x, this.position.y);
    this.segments[0].angle = this.movementAngle + Math.PI + headSwingAngle;
    this.segments[0].calculateB();

    // Remaining segments follow the previous segment's end point (b)
    // Swim effect: sine wave angle oscillation
    for (let i = 1; i < this.segments.length; i++) {
      // Swim effect: amplitude increases toward the tail
      const t = i / this.segments.length;
      const swimAngleAmplitude = t * t * t * 0.8; // Cubic curve: body barely moves, tail swings strongly
      const swimFrequency = 0.7; // Phase offset for wave propagation
      const angleOffset = Math.sin(this.swimOffset + i * swimFrequency) * swimAngleAmplitude;

      const prevAngle = this.segments[i - 1].angle;

      // Align segment start to previous segment's end
      this.segments[i].a.set(this.segments[i - 1].b.x, this.segments[i - 1].b.y);
      this.segments[i].angle = prevAngle + angleOffset;
      this.segments[i].calculateB();
    }
  }

  /**
   * Reposition segments relative to head on wraparound
   */
  resetSegments(): void {
    for (let i = 0; i < this.segments.length; i++) {
      if (i === 0) {
        this.segments[i].a.set(this.position.x, this.position.y);
      } else {
        this.segments[i].a.set(this.segments[i - 1].b.x, this.segments[i - 1].b.y);
      }
      this.segments[i].angle = this.movementAngle + Math.PI;
      this.segments[i].calculateB();
    }
  }

  /**
   * Apply force
   */
  applyForce(force: p5.Vector): void {
    this.acceleration.add(force);
  }

  /**
   * Apply scatter force from ripples
   */
  applyScatterForce(ripples: Ripple[]): void {
    for (const ripple of ripples) {
      const { fx, fy } = ripple.getScatterForce(this.position.x, this.position.y);
      if (fx !== 0 || fy !== 0) {
        this._steerVec.set(fx, fy);
        this._steerVec.limit(this.maxForce * 8);
        this.applyForce(this._steerVec);

        // Speed boost on scatter (up to 3x baseMaxSpeed)
        const forceMag = Math.sqrt(fx * fx + fy * fy);
        const boost = Math.min(forceMag * 0.3, this.baseMaxSpeed * 2);
        const boostedSpeed = this.baseMaxSpeed + boost;
        if (boostedSpeed > this.maxSpeed) {
          this.maxSpeed = boostedSpeed;
        }
      }
    }
  }

  /**
   * Wander behavior (autonomous roaming)
   */
  wander(): p5.Vector {
    const p = (window as any).p5Instance;
    const wanderRadius = 50;
    const wanderDistance = 80;
    const wanderChange = 0.3;

    this.wanderTheta += p.random(-wanderChange, wanderChange);

    // Reuse vectors: set + normalize + mult instead of copy()
    this._wanderCircle.set(this.velocity.x, this.velocity.y);
    this._wanderCircle.normalize();
    this._wanderCircle.mult(wanderDistance);

    this._wanderOffset.set(
      wanderRadius * Math.cos(this.wanderTheta),
      wanderRadius * Math.sin(this.wanderTheta)
    );

    this._wanderTarget.set(
      this._wanderCircle.x + this._wanderOffset.x,
      this._wanderCircle.y + this._wanderOffset.y
    );
    this._wanderTarget.setMag(this.maxForce);

    return this._wanderTarget;
  }

  /**
   * Render fish (streamlined koi style)
   */
  display(quality: QualitySettings, renderer?: p5.Graphics, ripples?: Ripple[]): void {
    const p = (window as any).p5Instance;
    // Draw to renderer buffer if provided, otherwise draw on main canvas
    const r: p5 | p5.Graphics = renderer || p;

    // Ripple distortion offset helper
    const getRippleOffset = (x: number, y: number): { dx: number; dy: number } => {
      if (!ripples || ripples.length === 0) return { dx: 0, dy: 0 };
      let totalDx = 0, totalDy = 0;
      for (const ripple of ripples) {
        const d = ripple.getDisplacement(x, y);
        totalDx += d.dx;
        totalDy += d.dy;
      }
      return { dx: totalDx, dy: totalDy };
    };

    // Size scale (relative to base size 120)
    const sizeScale = this.size / 120;

    const circleRadius = 9.5 * sizeScale;
    const tailSeg = this.segments[this.segmentCount - 1];
    const tailBaseAngle = tailSeg.angle;

    // Offset tail toward head (proportional to size)
    const tailOffset = 7 * sizeScale;
    const hingeX = tailSeg.b.x - Math.cos(tailBaseAngle) * tailOffset;
    const hingeY = tailSeg.b.y - Math.sin(tailBaseAngle) * tailOffset;

    // Tail settings (proportional to size)
    const tailLength = 18 * sizeScale;
    const tailSpread = Math.PI / 4;
    const maxTailSwing = Math.PI / 6;
    const tailSwingAngle = Math.sin(this.swimOffset) * maxTailSwing;

    const upperTailAngle = tailBaseAngle + tailSpread / 2 + tailSwingAngle;
    const upperTailTip = {
      x: hingeX + Math.cos(upperTailAngle) * tailLength,
      y: hingeY + Math.sin(upperTailAngle) * tailLength
    };

    const lowerTailAngle = tailBaseAngle - tailSpread / 2 + tailSwingAngle;
    const lowerTailTip = {
      x: hingeX + Math.cos(lowerTailAngle) * tailLength,
      y: hingeY + Math.sin(lowerTailAngle) * tailLength
    };

    // Calculate segment midpoints (body)
    // Streamlined koi profile: narrow head tip, widest in middle, tapers to tail
    const lastIdx = this.segmentCount - 1;
    const bodyPoints = [];
    for (let i = lastIdx; i >= 0; i--) {
      const seg = this.segments[i];
      const midX = (seg.a.x + seg.b.x) / 2;
      const midY = (seg.a.y + seg.b.y) / 2;
      const angle = seg.angle;
      const thickness = circleRadius * KOI_PROFILE[lastIdx - i];
      bodyPoints.push({ x: midX, y: midY, angle, thickness });
    }

    // Head tip: narrow streamlined finish
    bodyPoints.push({
      x: this.position.x,
      y: this.position.y,
      angle: this.segments[0].angle,
      thickness: circleRadius * 0.45
    });

    // Calculate outline points - smooth with spline interpolation
    const rawUpperPoints = [];
    const rawLowerPoints = [];

    const HALF_PI = Math.PI / 2;
    for (let i = 0; i < bodyPoints.length; i++) {
      const pt = bodyPoints[i];
      const upperX = pt.x + Math.cos(pt.angle + HALF_PI) * pt.thickness;
      const upperY = pt.y + Math.sin(pt.angle + HALF_PI) * pt.thickness;
      const lowerX = pt.x + Math.cos(pt.angle - HALF_PI) * pt.thickness;
      const lowerY = pt.y + Math.sin(pt.angle - HALF_PI) * pt.thickness;
      rawUpperPoints.push({ x: upperX, y: upperY });
      rawLowerPoints.push({ x: lowerX, y: lowerY });
    }

    const subdivs = quality.subdivisions;
    const upperPoints = interpolateSpline(rawUpperPoints, subdivs);
    const lowerPoints = interpolateSpline(rawLowerPoints, subdivs);

    const head = bodyPoints[bodyPoints.length - 1];
    const headAngle = head.angle;

    const ctx = (r as any).drawingContext as CanvasRenderingContext2D;

    // Ink wash tonal gradient - continuous stripes at fixed ratios
    const stripeSpacing = 0.3 * sizeScale * quality.stripeSpacing;
    const baseThickness = 4 * sizeScale;
    let noiseVal = this.noiseSeed;

    // Determine global stripe count based on max width
    let maxWidthSq = 0;
    for (let i = 0; i < upperPoints.length; i++) {
      const dx = upperPoints[i].x - lowerPoints[i].x;
      const dy = upperPoints[i].y - lowerPoints[i].y;
      const wSq = dx * dx + dy * dy;
      if (wSq > maxWidthSq) maxWidthSq = wSq;
    }
    const maxWidth = Math.sqrt(maxWidthSq);
    const globalStripes = Math.max(Math.floor(maxWidth / stripeSpacing), 2);

    // Width cache: pre-compute distances between upper/lower points
    const widths = new Float32Array(upperPoints.length);
    for (let i = 0; i < upperPoints.length; i++) {
      const dx = upperPoints[i].x - lowerPoints[i].x;
      const dy = upperPoints[i].y - lowerPoints[i].y;
      widths[i] = Math.sqrt(dx * dx + dy * dy);
    }

    const invMaxWidth = maxWidth > 0 ? 1 / maxWidth : 1;
    const step = 1.2 * sizeScale * quality.stepSize;

    // Draw each stripe continuously across all segments
    for (let s = 0; s < globalStripes; s++) {
      const ratio = (s + 0.5) / globalStripes;
      noiseVal += 0.3;

      // Width-direction gradient
      const widthCenter = 1 - Math.abs(ratio - 0.5) * 2;
      const alpha = 0.01 + widthCenter * widthCenter * 0.012;
      ctx.fillStyle = `rgba(30, 25, 20, ${alpha})`;

      const totalPts = upperPoints.length;
      for (let i = 0; i < totalPts - 1; i++) {
        const localRatioLimit1 = widths[i] * invMaxWidth;
        const localRatioLimit2 = widths[i + 1] * invMaxWidth;
        const margin = (1 - Math.min(localRatioLimit1, localRatioLimit2)) * 0.5;

        if (ratio < margin || ratio > 1 - margin) continue;

        // Head fade: reduce density near head
        const lengthPos = i / totalPts;
        const headFade = lengthPos > 0.7 ? 1 - (lengthPos - 0.7) / 0.3 : 1;
        ctx.fillStyle = `rgba(30, 25, 20, ${alpha * headFade})`;

        const ux1 = upperPoints[i].x, uy1 = upperPoints[i].y;
        const lx1 = lowerPoints[i].x, ly1 = lowerPoints[i].y;
        const ux2 = upperPoints[i + 1].x, uy2 = upperPoints[i + 1].y;
        const lx2 = lowerPoints[i + 1].x, ly2 = lowerPoints[i + 1].y;

        const x1 = ux1 + (lx1 - ux1) * ratio;
        const y1 = uy1 + (ly1 - uy1) * ratio;
        const x2 = ux2 + (lx2 - ux2) * ratio;
        const y2 = uy2 + (ly2 - uy2) * ratio;

        const sdx = x2 - x1, sdy = y2 - y1;
        const segDist = Math.sqrt(sdx * sdx + sdy * sdy);
        const steps = Math.max(Math.floor(segDist / step), 1);
        const invSteps = 1 / steps;

        for (let t = 0; t <= steps; t++) {
          const frac = t * invSteps;
          let x = x1 + sdx * frac;
          let y = y1 + sdy * frac;

          // Apply ripple distortion
          const off = getRippleOffset(x, y);
          x += off.dx; y += off.dy;

          noiseVal += 0.02;
          const w = fastNoise(noiseVal) * baseThickness;

          const half = w * 0.5;
          ctx.fillRect(x - half, y - half, w, w);
        }
      }
    }

    // === Accent spots ===
    for (const spot of this.spotPattern) {
      const idx = Math.floor(spot.along * (upperPoints.length - 1));
      const nextIdx = Math.min(idx + 1, upperPoints.length - 1);
      const localFrac = spot.along * (upperPoints.length - 1) - idx;

      // Interpolated position
      const ux = upperPoints[idx].x + (upperPoints[nextIdx].x - upperPoints[idx].x) * localFrac;
      const uy = upperPoints[idx].y + (upperPoints[nextIdx].y - upperPoints[idx].y) * localFrac;
      const lx = lowerPoints[idx].x + (lowerPoints[nextIdx].x - lowerPoints[idx].x) * localFrac;
      const ly = lowerPoints[idx].y + (lowerPoints[nextIdx].y - lowerPoints[idx].y) * localFrac;

      const cx = ux + (lx - ux) * spot.across;
      const cy = uy + (ly - uy) * spot.across;
      const localWidth = Math.sqrt((ux - lx) * (ux - lx) + (uy - ly) * (uy - ly));
      const spotRadius = localWidth * spot.size;

      // Render accent spots softly with multiple layers
      const spotSteps = Math.max(Math.floor(spotRadius / (0.8 * sizeScale * quality.spotStep)), 4);
      for (let si = 0; si < spotSteps; si++) {
        for (let sj = 0; sj < spotSteps; sj++) {
          let sx = cx + (si / spotSteps - 0.5) * spotRadius * 2;
          let sy = cy + (sj / spotSteps - 0.5) * spotRadius * 2;
          const dist = Math.sqrt((sx - cx) * (sx - cx) + (sy - cy) * (sy - cy));
          if (dist > spotRadius) continue;

          // Apply ripple distortion
          const sOff = getRippleOffset(sx, sy);
          sx += sOff.dx; sy += sOff.dy;

          const falloff = 1 - (dist / spotRadius);
          noiseVal += 0.01;
          const w = fastNoise(noiseVal) * baseThickness * 0.6;
          const half = w * 0.5;
          ctx.fillStyle = `rgba(${this.accentRGB[0]}, ${this.accentRGB[1]}, ${this.accentRGB[2]}, ${0.12 * falloff})`;
          ctx.fillRect(sx - half, sy - half, w, w);
        }
      }
    }

    // === Tail fin ===
    const tailStripes = 6;
    const tailThickness = 2.5 * sizeScale;
    const tailStep = 1.8 * sizeScale;
    // Per-fish tail accent probability (based on noiseSeed)
    const tailHasRed = fastNoise(this.noiseSeed + 99) > 0.4;

    let tailNoiseVal = this.noiseSeed + 500; // Tail-specific fixed noise seed
    for (let s = 0; s < tailStripes; s++) {
      const ratio = (s + 0.5) / tailStripes;
      const tipX = upperTailTip.x + (lowerTailTip.x - upperTailTip.x) * ratio;
      const tipY = upperTailTip.y + (lowerTailTip.y - upperTailTip.y) * ratio;

      const tdx = tipX - hingeX, tdy = tipY - hingeY;
      const segDist = Math.sqrt(tdx * tdx + tdy * tdy);
      const steps = Math.max(Math.floor(segDist / tailStep), 1);
      const invSteps = 1 / steps;

      for (let t = 0; t <= steps; t++) {
        const frac = t * invSteps;
        let x = hingeX + tdx * frac;
        let y = hingeY + tdy * frac;

        // Apply ripple distortion
        const tOff = getRippleOffset(x, y);
        x += tOff.dx; y += tOff.dy;

        tailNoiseVal += 0.02;
        const w = fastNoise(tailNoiseVal) * tailThickness;
        const half = w * 0.5;
        // Base ink color
        ctx.fillStyle = `rgba(30, 25, 20, 0.037)`;
        ctx.fillRect(x - half, y - half, w, w);
        // Accent color random points
        if (tailHasRed && fastNoise(tailNoiseVal + 7.77) > 0.35) {
          const accentAlpha = 0.05 * (1 - frac * 0.7);
          ctx.fillStyle = `rgba(${this.accentRGB[0]}, ${this.accentRGB[1]}, ${this.accentRGB[2]}, ${accentAlpha})`;
          ctx.fillRect(x - half * 1.3, y - half * 1.3, w * 1.3, w * 1.3);
        }
      }
    }

    // === Pectoral fins (rounded triangle style) ===
    const finBaseAngleRad = (FIN_BASE_ANGLE * Math.PI) / 180;
    const finOscAmpRad = (FIN_OSC_AMPLITUDE * Math.PI) / 180;

    const fcR = this.accentRGB[0];
    const fcG = this.accentRGB[1];
    const fcB = this.accentRGB[2];

    // Fin oscillation (sine wave rotation)
    const finOscUpper = Math.sin(this.swimOffset * FIN_OSC_SPEED) * finOscAmpRad;
    const finOscLower = Math.sin(this.swimOffset * FIN_OSC_SPEED + FIN_PHASE_OFFSET) * finOscAmpRad;

    const finLength = 22 * sizeScale * FIN_LENGTH;
    const finWidth = 12 * sizeScale * FIN_WIDTH;
    const finThickness = 2 * sizeScale;
    const finStep = 1.5 * sizeScale;

    /**
     * Draw rounded triangle fin
     * Triangle from base to tip with rounded vertices
     */
    const drawRoundedTriangleFin = (
      baseX: number, baseY: number,
      angle: number, length: number, width: number,
      isAccented: boolean
    ) => {
      ctx.save();
      ctx.translate(baseX, baseY);
      ctx.rotate(angle);

      // Triangle vertices: base left/right + tip
      const tipX = length;
      const tipY = 0;
      const baseTopX = 0;
      const baseTopY = -width / 2;
      const baseBotX = 0;
      const baseBotY = width / 2;

      // Corner radius (FIN_ROUNDNESS 0~1)
      const cornerR = FIN_ROUNDNESS * Math.min(width * 0.4, length * 0.2);

      // Ink wash style: multiple thin fill passes
      const passes = 8;
      for (let pass = 0; pass < passes; pass++) {
        const shrink = pass * 0.3;
        const alpha = FIN_INK_ALPHA * (1 - pass * 0.08);
        if (alpha <= 0) break;

        ctx.beginPath();
        const sx = baseTopX + shrink;
        const sy = baseTopY + shrink;
        const ex = baseBotX + shrink;
        const ey = baseBotY - shrink;
        const tx = tipX - shrink * 2;
        const ty = tipY;

        if (cornerR > 0.5) {
          ctx.moveTo(sx + cornerR, sy);
          ctx.arcTo(tx, ty, ex, ey, cornerR * 1.5);
          ctx.arcTo(ex, ey, sx, sy, cornerR * 0.8);
          ctx.arcTo(sx, sy, tx, ty, cornerR * 0.8);
        } else {
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.lineTo(ex, ey);
        }
        ctx.closePath();

        ctx.fillStyle = `rgba(30, 25, 20, ${alpha})`;
        ctx.fill();
      }

      // Accent color layer
      if (isAccented) {
        for (let pass = 0; pass < 5; pass++) {
          const shrink = pass * 0.8 + 1;
          const alpha = FIN_ACCENT_ALPHA * (1 - pass * 0.12);
          if (alpha <= 0) break;

          ctx.beginPath();
          const sx = baseTopX + shrink;
          const sy = baseTopY + shrink * 0.8;
          const ex = baseBotX + shrink;
          const ey = baseBotY - shrink * 0.8;
          const tx = tipX - shrink * 2.5;
          const ty = tipY;

          if (cornerR > 0.5) {
            ctx.moveTo(sx + cornerR, sy);
            ctx.arcTo(tx, ty, ex, ey, cornerR * 1.2);
            ctx.arcTo(ex, ey, sx, sy, cornerR * 0.6);
            ctx.arcTo(sx, sy, tx, ty, cornerR * 0.6);
          } else {
            ctx.moveTo(sx, sy);
            ctx.lineTo(tx, ty);
            ctx.lineTo(ex, ey);
          }
          ctx.closePath();

          ctx.fillStyle = `rgba(${fcR}, ${fcG}, ${fcB}, ${alpha})`;
          ctx.fill();
        }
      }

      // Ink particle stripes (texture)
      const stripes = 5;
      for (let s = 0; s < stripes; s++) {
        const ratio = (s + 0.5) / stripes;
        const startY = (-width / 2 + width * ratio);
        const endX = length * (1 - Math.abs(ratio - 0.5) * 0.8);

        const fdx = endX;
        const fdy = startY * (1 - endX / length);
        const segDist = Math.sqrt(fdx * fdx + fdy * fdy);
        const steps = Math.max(Math.floor(segDist / finStep), 1);
        const invSteps = 1 / steps;

        for (let t = 0; t <= steps; t++) {
          const frac = t * invSteps;
          const x = fdx * frac;
          const y = startY * (1 - frac);
          noiseVal += 0.02;
          const w = fastNoise(noiseVal) * finThickness * (1 - frac * 0.5);
          const half = w * 0.5;
          ctx.fillStyle = `rgba(30, 25, 20, ${FIN_INK_ALPHA * 0.6})`;
          ctx.fillRect(x - half, y - half, w, w);
        }
      }

      ctx.restore();
    };

    // Pectoral fins (position based on parameter)
    const maxBodyIdx = bodyPoints.length - 1;
    const pectoralBodyIdx = Math.round(PECTORAL_POSITION * maxBodyIdx);
    const pectoralSplineIdx = Math.round(PECTORAL_POSITION * (upperPoints.length - 1));
    const pectoralAngle = bodyPoints[pectoralBodyIdx]?.angle || this.segments[3].angle;
    const hasFinAccent = fastNoise(this.noiseSeed + 50) > 0.4;

    if (upperPoints[pectoralSplineIdx]) {
      drawRoundedTriangleFin(
        upperPoints[pectoralSplineIdx].x, upperPoints[pectoralSplineIdx].y,
        pectoralAngle - HALF_PI - finBaseAngleRad + finOscUpper,
        finLength, finWidth, hasFinAccent
      );
    }
    if (lowerPoints[pectoralSplineIdx]) {
      drawRoundedTriangleFin(
        lowerPoints[pectoralSplineIdx].x, lowerPoints[pectoralSplineIdx].y,
        pectoralAngle + HALF_PI + finBaseAngleRad + finOscLower,
        finLength, finWidth, hasFinAccent
      );
    }

    // Barbels (whiskers)
    const barbelBaseX = this.position.x + Math.cos(headAngle) * circleRadius * 0.9;
    const barbelBaseY = this.position.y + Math.sin(headAngle) * circleRadius * 0.9;

    r.stroke(30, 25, 20, 40);
    r.strokeWeight(1 * sizeScale);
    r.noFill();

    r.beginShape();
    r.vertex(barbelBaseX, barbelBaseY);
    r.quadraticVertex(
      barbelBaseX + Math.cos(headAngle + 0.4) * 10 * sizeScale,
      barbelBaseY + Math.sin(headAngle + 0.4) * 10 * sizeScale,
      barbelBaseX + Math.cos(headAngle + 0.6) * 15 * sizeScale,
      barbelBaseY + Math.sin(headAngle + 0.6) * 15 * sizeScale
    );
    r.endShape();

    r.beginShape();
    r.vertex(barbelBaseX, barbelBaseY);
    r.quadraticVertex(
      barbelBaseX + Math.cos(headAngle - 0.4) * 10 * sizeScale,
      barbelBaseY + Math.sin(headAngle - 0.4) * 10 * sizeScale,
      barbelBaseX + Math.cos(headAngle - 0.6) * 15 * sizeScale,
      barbelBaseY + Math.sin(headAngle - 0.6) * 15 * sizeScale
    );
    r.endShape();
  }
}
