import type p5 from 'p5';

/**
 * Segment - IK 체인의 개별 세그먼트
 */
export class Segment {
  a: p5.Vector; // 시작점
  b: p5.Vector; // 끝점
  length: number;
  angle: number;
  damping: number; // 각도 변화 댐핑 (0.0 ~ 1.0, 낮을수록 부드러움)

  constructor(x: number, y: number, length: number, angle: number = 0) {
    const p = (window as any).p5Instance;
    this.length = length;
    this.angle = angle;
    this.damping = 0.3; // 기본 댐핑 값 (부드러운 움직임)
    this.a = p.createVector(x, y);
    this.b = p.createVector();
    this.calculateB();
  }

  /**
   * 각도에 따라 끝점 계산
   */
  calculateB(): void {
    const dx = this.length * Math.cos(this.angle);
    const dy = this.length * Math.sin(this.angle);
    this.b.set(this.a.x + dx, this.a.y + dy);
  }

  /**
   * 세그먼트의 시작점 설정
   */
  setA(pos: p5.Vector): void {
    this.a = pos.copy();
    this.calculateB();
  }

  /**
   * 타겟을 향해 세그먼트 방향 조정 (IK)
   */
  follow(targetX: number, targetY: number): void {
    const p = (window as any).p5Instance;
    const target = p.createVector(targetX, targetY);
    const dir = p.constructor.Vector.sub(target, this.a);
    this.angle = dir.heading();
    dir.setMag(this.length);
    dir.mult(-1);
    this.a = p.constructor.Vector.add(target, dir);
    this.calculateB(); // b 위치 업데이트
  }

  /**
   * 다른 세그먼트를 따라가도록 설정
   */
  followSegment(parent: Segment): void {
    const target = parent.a;
    this.follow(target.x, target.y);
  }
}
