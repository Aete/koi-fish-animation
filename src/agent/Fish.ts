import { Physics } from '../world/Physics';
import { Segment } from './Segment';
import type p5 from 'p5';

/**
 * Fish - 물고기 에이전트 클래스
 * 자율적인 행동과 수묵화 스타일 렌더링 (IK 기반)
 */
export class Fish {
  position: p5.Vector; // 머리 위치
  velocity: p5.Vector;
  acceleration: p5.Vector;

  // 물고기의 물리적 속성
  maxSpeed: number;
  maxForce: number;
  size: number;

  // 행동 파라미터
  wanderTheta: number;

  // 시각적 속성
  brushType: string;
  color: p5.Color;
  opacity: number;

  // IK 골격 시스템
  segments: Segment[];
  segmentCount: number;
  segmentLength: number;

  // 헤엄치기 애니메이션
  swimOffset: number;

  // 이동 방향 (실제 속도 벡터의 각도)
  movementAngle: number;

  constructor(x: number, y: number) {
    const p = (window as any).p5Instance;

    this.position = p.createVector(x, y);
    this.velocity = p.constructor.Vector.random2D();
    this.velocity.mult(p.random(0.8, 1.5));
    this.acceleration = p.createVector(0, 0);

    // 크기 베리에이션 추가 (80 ~ 140)
    this.size = p.random(120, 210);

    // 크기에 따라 속도도 약간 조정 (작은 물고기가 약간 더 빠름)
    const sizeRatio = p.map(this.size, 80, 140, 1.2, 0.9);
    this.maxSpeed = p.random(1.5, 2.5) * sizeRatio;
    this.maxForce = 0.15;

    this.wanderTheta = 0;
    this.swimOffset = 0;
    this.movementAngle = 0; // 초기 방향

    // 미니멀 디자인: 검은색 몸통 + 청록색 또는 분홍색 포인트
    const accentColorChoices = [
      p.color(0, 200, 200),      // 청록색 (cyan)
      p.color(255, 80, 150),     // 분홍색 (magenta/pink)
    ];

    this.color = p.random(accentColorChoices); // 포인트 컬러
    this.opacity = 255;
    this.brushType = 'marker'; // p5.brush의 브러시 타입

    // IK 골격 시스템 초기화 (크기에 비례)
    this.segmentCount = 6; // 물고기 몸통 세그먼트 개수
    this.segmentLength = this.size * 0.11; // 세그먼트 길이 (크기에 비례)
    this.segments = [];
    this.swimOffset = 0;

    // 세그먼트 생성 (머리에서 꼬리로)
    // 각 세그먼트가 올바르게 연결되도록: segment[i].b = segment[i+1].a
    for (let i = 0; i < this.segmentCount; i++) {
      let segX, segY, angle;

      if (i === 0) {
        // 첫 번째 세그먼트: 머리 위치에서 시작
        segX = x;
        segY = y;
        angle = Math.PI; // 왼쪽 방향 (뒤로)
      } else {
        // 나머지 세그먼트: 이전 세그먼트의 끝점에서 시작
        segX = this.segments[i - 1].b.x;
        segY = this.segments[i - 1].b.y;
        angle = Math.PI; // 왼쪽 방향 (뒤로)
      }

      const segment = new Segment(segX, segY, this.segmentLength, angle);
      this.segments.push(segment);
    }

  }

  /**
   * 물고기의 행동 업데이트 (자율 배회)
   */
  update(physics: Physics, time: number): void {
    const p = (window as any).p5Instance;

    // 이전 위치 저장
    const prevX = this.position.x;
    const prevY = this.position.y;

    // Wander 행동 (자율 배회)
    const wanderForce = this.wander();
    this.applyForce(wanderForce);

    // 화면 경계 처리 (부드럽게 튕김)
    const margin = 50;
    if (this.position.x < margin) {
      const steer = p.createVector(this.maxForce, 0);
      this.applyForce(steer);
    }
    if (this.position.x > p.width - margin) {
      const steer = p.createVector(-this.maxForce, 0);
      this.applyForce(steer);
    }
    if (this.position.y < margin) {
      const steer = p.createVector(0, this.maxForce);
      this.applyForce(steer);
    }
    if (this.position.y > p.height - margin) {
      const steer = p.createVector(0, -this.maxForce);
      this.applyForce(steer);
    }

    // 물리 업데이트
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);

    // 실제 이동 속도 계산
    const dx = this.position.x - prevX;
    const dy = this.position.y - prevY;
    const speed = Math.sqrt(dx * dx + dy * dy);

    // 이동 방향 업데이트 (실제 움직이는 방향)
    if (speed > 0.1) { // 충분히 움직일 때만 방향 업데이트
      const targetAngle = Math.atan2(dy, dx);
      // 부드럽게 회전 (lerp로 각도 보간)
      const angleDiff = targetAngle - this.movementAngle;
      // 각도 차이를 -PI ~ PI 범위로 정규화
      const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      this.movementAngle += normalizedDiff * 0.2; // 부드럽게 회전
    }

    // 헤엄치기 애니메이션 (속도에 비례, 부드럽게)
    this.swimOffset += speed * 0.08; // 속도에 비례, 더 부드럽게

    // IK 골격 업데이트
    this.updateSkeleton();
  }

  /**
   * IK 골격 시스템 업데이트 (샘플 코드 방식 + 헤엄치기 효과)
   */
  updateSkeleton(): void {
    // 첫 번째 세그먼트(머리)가 목표 위치를 따라가며 뒤쪽을 향함
    // + 머리도 좌우로 흔들림 (±10도)
    const headSwingAmplitude = Math.PI / 18; // 10도
    const headSwingAngle = Math.sin(this.swimOffset) * headSwingAmplitude;

    this.segments[0].a.set(this.position.x, this.position.y);
    this.segments[0].angle = this.movementAngle + Math.PI + headSwingAngle; // 진행방향의 반대 + 흔들림
    this.segments[0].calculateB();

    // 나머지 세그먼트들이 연쇄적으로 앞 세그먼트의 끝점(b)을 따라감
    // + 헤엄치기 효과: sine wave로 각도만 흔들림
    for (let i = 1; i < this.segments.length; i++) {
      // 헤엄치기 효과: 꼬리로 갈수록 더 크게 각도 변화
      const swimAngleAmplitude = (i / this.segments.length) * 0.25; // 각도 흔들림 크기 (라디안)
      const swimFrequency = 0.15; // 흔들림 속도
      const angleOffset = Math.sin(this.swimOffset + i * swimFrequency) * swimAngleAmplitude;

      // 이전 세그먼트의 각도를 따라가되, 약간의 각도 offset 추가
      const prevAngle = this.segments[i - 1].angle;

      // 세그먼트의 시작점을 이전 세그먼트의 끝점에 정확히 맞춤
      this.segments[i].a.set(this.segments[i - 1].b.x, this.segments[i - 1].b.y);
      this.segments[i].angle = prevAngle + angleOffset;
      this.segments[i].calculateB();
    }
  }

  /**
   * 힘 적용
   */
  applyForce(force: p5.Vector): void {
    this.acceleration.add(force);
  }

  /**
   * Wander 행동 (자율적인 배회)
   */
  wander(): p5.Vector {
    const p = (window as any).p5Instance;
    const wanderRadius = 50;
    const wanderDistance = 80;
    const wanderChange = 0.3;

    this.wanderTheta += p.random(-wanderChange, wanderChange);

    const circlePos = this.velocity.copy();
    circlePos.normalize();
    circlePos.mult(wanderDistance);

    const circleOffset = p.createVector(
      wanderRadius * Math.cos(this.wanderTheta),
      wanderRadius * Math.sin(this.wanderTheta)
    );

    const target = p.constructor.Vector.add(circlePos, circleOffset);
    target.setMag(this.maxForce);

    return target;
  }

  /**
   * 물고기 렌더링 (유선형 잉어 스타일)
   */
  display(): void {
    const p = (window as any).p5Instance;

    // 크기 스케일 (기준 크기 120 대비)
    const sizeScale = this.size / 120;

    const circleRadius = 7 * sizeScale;  // 몸통 크기 (크기에 비례)
    const seg5 = this.segments[5];
    const tailBaseAngle = seg5.angle;

    // 꼬리를 머리 쪽으로 이동 (크기에 비례)
    const tailOffset = 7 * sizeScale;
    const hingeX = seg5.b.x - Math.cos(tailBaseAngle) * tailOffset;
    const hingeY = seg5.b.y - Math.sin(tailBaseAngle) * tailOffset;

    // 꼬리 설정 (크기에 비례)
    const tailLength = 25 * sizeScale;
    const tailSpread = Math.PI / 4;
    const maxTailSwing = Math.PI / 15;
    const tailSwingAngle = Math.sin(this.swimOffset * 0.25) * maxTailSwing;

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

    // 세그먼트 중심점들 계산 (몸통)
    const bodyPoints = [];
    for (let i = 5; i >= 0; i--) {
      const seg = this.segments[i];
      const midX = (seg.a.x + seg.b.x) / 2;
      const midY = (seg.a.y + seg.b.y) / 2;
      const angle = seg.angle;
      // 잉어처럼 중간이 불룩한 형태
      let thickness;
      if (i >= 3) {
        // 꼬리 쪽: 점점 가늘어짐
        thickness = circleRadius * (0.4 + (5 - i) * 0.25);
      } else {
        // 머리 쪽: 점점 두꺼워짐
        thickness = circleRadius * (1.15 + (3 - i) * 0.15);
      }
      bodyPoints.push({ x: midX, y: midY, angle, thickness });
    }

    // 머리 추가
    bodyPoints.push({
      x: this.position.x,
      y: this.position.y,
      angle: this.segments[0].angle,
      thickness: circleRadius * 1.4
    });

    // 윤곽선 점들 계산 - 스플라인 보간으로 부드럽게
    const rawUpperPoints = [];
    const rawLowerPoints = [];

    for (let i = 0; i < bodyPoints.length; i++) {
      const pt = bodyPoints[i];
      const upperX = pt.x + Math.cos(pt.angle + p.HALF_PI) * pt.thickness;
      const upperY = pt.y + Math.sin(pt.angle + p.HALF_PI) * pt.thickness;
      const lowerX = pt.x + Math.cos(pt.angle - p.HALF_PI) * pt.thickness;
      const lowerY = pt.y + Math.sin(pt.angle - p.HALF_PI) * pt.thickness;
      rawUpperPoints.push({ x: upperX, y: upperY });
      rawLowerPoints.push({ x: lowerX, y: lowerY });
    }

    // Catmull-Rom 스플라인 보간으로 부드러운 윤곽선 생성
    const interpolateSpline = (pts: {x: number, y: number}[], subdivisions: number) => {
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
      // 마지막 점 추가
      result.push(pts[pts.length - 1]);
      return result;
    };

    const subdivs = 5; // 각 세그먼트를 5등분 → 7개 점이 31개로
    const upperPoints = interpolateSpline(rawUpperPoints, subdivs);
    const lowerPoints = interpolateSpline(rawLowerPoints, subdivs);

    const head = bodyPoints[bodyPoints.length - 1];
    const headAngle = head.angle;

    // 몸통 채우기 제거 - ctx 스트라이프가 몸통 형태를 만듦

    const ctx = p.drawingContext as CanvasRenderingContext2D;

    // 농담(濃淡) 효과 - 고정 ratio 연속 스트라이프 (세그먼트 경계 없음)
    const stripeSpacing = 0.3 * sizeScale;
    const baseThickness = 8 * sizeScale;
    let noiseVal = this.swimOffset * 0.1;

    ctx.lineCap = "round";

    // 가장 넓은 폭 기준으로 글로벌 줄 수 결정
    let maxWidth = 0;
    for (let i = 0; i < upperPoints.length; i++) {
      const w = Math.sqrt(
        (upperPoints[i].x - lowerPoints[i].x) ** 2 +
        (upperPoints[i].y - lowerPoints[i].y) ** 2
      );
      if (w > maxWidth) maxWidth = w;
    }
    const globalStripes = Math.max(Math.floor(maxWidth / stripeSpacing), 2);

    // 각 스트라이프를 모든 세그먼트에 걸쳐 연속으로 그림
    for (let s = 0; s < globalStripes; s++) {
      const ratio = (s + 0.5) / globalStripes;
      noiseVal += 0.3;

      // 폭 방향 그라데이션
      const widthCenter = 1 - Math.abs(ratio - 0.5) * 2;
      const alpha = 0.015 + widthCenter * widthCenter * 0.02;
      ctx.strokeStyle = `rgba(30, 25, 20, ${alpha})`;

      for (let i = 0; i < upperPoints.length - 1; i++) {
        // 이 세그먼트의 로컬 폭 체크 - ratio가 범위 밖이면 스킵
        const w1 = Math.sqrt(
          (upperPoints[i].x - lowerPoints[i].x) ** 2 +
          (upperPoints[i].y - lowerPoints[i].y) ** 2
        );
        const w2 = Math.sqrt(
          (upperPoints[i + 1].x - lowerPoints[i + 1].x) ** 2 +
          (upperPoints[i + 1].y - lowerPoints[i + 1].y) ** 2
        );
        const localRatioLimit1 = maxWidth > 0 ? w1 / maxWidth : 1;
        const localRatioLimit2 = maxWidth > 0 ? w2 / maxWidth : 1;
        const margin = (1 - Math.min(localRatioLimit1, localRatioLimit2)) / 2;

        // 이 줄이 현재 세그먼트의 폭을 넘으면 스킵
        if (ratio < margin || ratio > 1 - margin) continue;

        const x1 = p.lerp(upperPoints[i].x, lowerPoints[i].x, ratio);
        const y1 = p.lerp(upperPoints[i].y, lowerPoints[i].y, ratio);
        const x2 = p.lerp(upperPoints[i + 1].x, lowerPoints[i + 1].x, ratio);
        const y2 = p.lerp(upperPoints[i + 1].y, lowerPoints[i + 1].y, ratio);

        const segDist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const step = 1.5 * sizeScale;
        const steps = Math.max(Math.floor(segDist / step), 2);

        for (let t = 0; t <= steps; t++) {
          const frac = t / steps;
          const x = p.lerp(x1, x2, frac);
          const y = p.lerp(y1, y2, frac);

          noiseVal += 0.02;
          const w = p.noise(noiseVal) * baseThickness;

          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
    }

    // === 꼬리 지느러미 - ctx 세로선 스타일 ===
    const tailStripes = 8;
    ctx.strokeStyle = `rgba(30, 25, 20, 0.05)`;
    const tailThickness = 4 * sizeScale;

    for (let s = 0; s < tailStripes; s++) {
      const ratio = (s + 0.5) / tailStripes;
      // hinge에서 upper/lower tip 사이를 ratio로 보간한 끝점
      const tipX = p.lerp(upperTailTip.x, lowerTailTip.x, ratio);
      const tipY = p.lerp(upperTailTip.y, lowerTailTip.y, ratio);

      const segDist = Math.sqrt((tipX - hingeX) ** 2 + (tipY - hingeY) ** 2);
      const step = 1.5 * sizeScale;
      const steps = Math.max(Math.floor(segDist / step), 2);

      for (let t = 0; t <= steps; t++) {
        const frac = t / steps;
        const x = p.lerp(hingeX, tipX, frac);
        const y = p.lerp(hingeY, tipY, frac);
        noiseVal += 0.02;
        ctx.lineWidth = p.noise(noiseVal) * tailThickness;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }

    // === 지느러미 - ctx 세로선 스타일 ===
    const finFlapSpeed = 1;
    const finFlapAmount = 0.5;
    const finFlap = Math.sin(this.swimOffset * finFlapSpeed) * finFlapAmount;
    const finThickness = 3 * sizeScale;
    const finLength = 22 * sizeScale;
    const finStripes = 5;
    ctx.strokeStyle = `rgba(30, 25, 20, 0.04)`;

    // 가슴지느러미 헬퍼
    const drawFin = (baseX: number, baseY: number, angle: number, length: number, stripes: number) => {
      for (let s = 0; s < stripes; s++) {
        const spread = ((s - (stripes - 1) / 2) / stripes) * 0.4; // 부채꼴 펼침
        const finAngle = angle + spread;
        const tipX = baseX + Math.cos(finAngle) * length;
        const tipY = baseY + Math.sin(finAngle) * length;

        const segDist = Math.sqrt((tipX - baseX) ** 2 + (tipY - baseY) ** 2);
        const step = 1.5 * sizeScale;
        const steps = Math.max(Math.floor(segDist / step), 2);

        for (let t = 0; t <= steps; t++) {
          const frac = t / steps;
          const x = p.lerp(baseX, tipX, frac);
          const y = p.lerp(baseY, tipY, frac);
          noiseVal += 0.02;
          ctx.lineWidth = p.noise(noiseVal) * finThickness * (1 - frac * 0.5); // 끝으로 갈수록 가늘어짐
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
    };

    // 가슴지느러미
    const pectoralIdx = 3;
    const pectoralAngle = bodyPoints[pectoralIdx]?.angle || this.segments[2].angle;

    if (upperPoints[pectoralIdx]) {
      drawFin(upperPoints[pectoralIdx].x, upperPoints[pectoralIdx].y,
        pectoralAngle - p.HALF_PI - finFlap, finLength, finStripes);
    }
    if (lowerPoints[pectoralIdx]) {
      drawFin(lowerPoints[pectoralIdx].x, lowerPoints[pectoralIdx].y,
        pectoralAngle + p.HALF_PI + finFlap, finLength, finStripes);
    }

    // 배지느러미
    const ventralIdx = 1;
    const ventralAngle = bodyPoints[ventralIdx]?.angle || this.segments[4].angle;
    const ventralFlap = Math.sin(this.swimOffset * finFlapSpeed + Math.PI * 0.5) * finFlapAmount * 0.7;
    const ventralLength = 14 * sizeScale;

    if (upperPoints[ventralIdx]) {
      drawFin(upperPoints[ventralIdx].x, upperPoints[ventralIdx].y,
        ventralAngle - p.HALF_PI - ventralFlap, ventralLength, 3);
    }
    if (lowerPoints[ventralIdx]) {
      drawFin(lowerPoints[ventralIdx].x, lowerPoints[ventralIdx].y,
        ventralAngle + p.HALF_PI + ventralFlap, ventralLength, 3);
    }

    // 눈
    const eyeOffset = circleRadius * 0.8;
    const eyeRX = this.position.x + Math.cos(headAngle + p.HALF_PI) * eyeOffset;
    const eyeRY = this.position.y + Math.sin(headAngle + p.HALF_PI) * eyeOffset;
    const eyeLX = this.position.x + Math.cos(headAngle - p.HALF_PI) * eyeOffset;
    const eyeLY = this.position.y + Math.sin(headAngle - p.HALF_PI) * eyeOffset;

    p.fill(20, 15, 10, 50);
    p.noStroke();
    p.circle(eyeRX, eyeRY, 4 * sizeScale);
    p.circle(eyeLX, eyeLY, 4 * sizeScale);

    // 수염
    const barbelBaseX = this.position.x + Math.cos(headAngle) * circleRadius * 1.3;
    const barbelBaseY = this.position.y + Math.sin(headAngle) * circleRadius * 1.3;

    p.stroke(30, 25, 20, 40);
    p.strokeWeight(1 * sizeScale);
    p.noFill();

    p.beginShape();
    p.vertex(barbelBaseX, barbelBaseY);
    p.quadraticVertex(
      barbelBaseX + Math.cos(headAngle + 0.4) * 10 * sizeScale,
      barbelBaseY + Math.sin(headAngle + 0.4) * 10 * sizeScale,
      barbelBaseX + Math.cos(headAngle + 0.6) * 15 * sizeScale,
      barbelBaseY + Math.sin(headAngle + 0.6) * 15 * sizeScale
    );
    p.endShape();

    p.beginShape();
    p.vertex(barbelBaseX, barbelBaseY);
    p.quadraticVertex(
      barbelBaseX + Math.cos(headAngle - 0.4) * 10 * sizeScale,
      barbelBaseY + Math.sin(headAngle - 0.4) * 10 * sizeScale,
      barbelBaseX + Math.cos(headAngle - 0.6) * 15 * sizeScale,
      barbelBaseY + Math.sin(headAngle - 0.6) * 15 * sizeScale
    );
    p.endShape();
  }
}
