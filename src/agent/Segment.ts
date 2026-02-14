import type p5 from 'p5';

/**
 * Segment - Individual segment of an IK chain
 */
export class Segment {
  a: p5.Vector; // start point
  b: p5.Vector; // end point
  length: number;
  angle: number;
  damping: number; // angle change damping (0.0~1.0, lower = smoother)

  constructor(x: number, y: number, length: number, angle: number = 0) {
    const p = (window as any).p5Instance;
    this.length = length;
    this.angle = angle;
    this.damping = 0.3;
    this.a = p.createVector(x, y);
    this.b = p.createVector();
    this.calculateB();
  }

  /**
   * Calculate end point based on angle
   */
  calculateB(): void {
    const dx = this.length * Math.cos(this.angle);
    const dy = this.length * Math.sin(this.angle);
    this.b.set(this.a.x + dx, this.a.y + dy);
  }

  /**
   * Set segment start point
   */
  setA(pos: p5.Vector): void {
    this.a = pos.copy();
    this.calculateB();
  }

  /**
   * Orient segment toward target (IK)
   */
  follow(targetX: number, targetY: number): void {
    const p = (window as any).p5Instance;
    const target = p.createVector(targetX, targetY);
    const dir = p.constructor.Vector.sub(target, this.a);
    this.angle = dir.heading();
    dir.setMag(this.length);
    dir.mult(-1);
    this.a = p.constructor.Vector.add(target, dir);
    this.calculateB();
  }

  /**
   * Follow another segment
   */
  followSegment(parent: Segment): void {
    const target = parent.a;
    this.follow(target.x, target.y);
  }
}
