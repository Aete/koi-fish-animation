import { Physics } from '../world/Physics';
import { Segment } from './Segment';
import type p5 from 'p5';

// 유선형 잉어 프로파일 (seg5→seg0 순서) - 매 프레임 재생성 방지
// 8세그먼트 유선형 프로파일 (seg7→seg0 순서) - 잎사귀형 잉어 실루엣
const KOI_PROFILE = [0.35, 0.55, 0.75, 0.95, 1.0, 1.08, 1.0, 0.8] as const;

// Catmull-Rom 스플라인 보간 (모듈 레벨로 이동하여 클로저 재생성 방지)
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

// pseudo-noise 해시 (GLSL fract 패턴)
function fastNoise(seed: number): number {
  const raw = Math.sin(seed * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
}

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

  // 렌더링 노이즈 시드 (프레임 간 안정적)
  noiseSeed: number;

  // 반점 패턴 (body 길이 비율 0~1, 폭 비율 0~1, 크기)
  spotPattern: { along: number; across: number; size: number }[];

  // 반점/꼬리 색상 (다홍색 or 푸른색)
  accentRGB: [number, number, number];

  // 이동 방향 (실제 속도 벡터의 각도)
  movementAngle: number;

  // 재사용 벡터 (매 프레임 할당 방지)
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

    // 크기 베리에이션 추가 (80 ~ 140)
    this.size = p.random(210, 360);

    // 크기에 따라 속도 조정 (큰 물고기는 느리고 우아하게, 작은 물고기는 빠르게)
    const sizeRatio = p.map(this.size, 173, 302, 1.15, 0.75);
    this.maxSpeed = p.random(1.5, 2.5) * sizeRatio;
    this.maxForce = 0.15;

    this.wanderTheta = 0;
    this.swimOffset = 0;
    this.noiseSeed = p.random(10000);
    this.movementAngle = 0; // 초기 방향

    // 반점 색상 랜덤 결정 (다홍색 or 푸른색)
    this.accentRGB = p.random() < 0.5
      ? [220, 100, 30]   // 다홍색
      : [30, 80, 180];   // 푸른색

    // 반점 패턴 생성 (2~4개, 겹치지 않게 분산)
    const spotCount = Math.floor(p.random(2, 5));
    this.spotPattern = [];
    // 몸통을 spotCount 구간으로 나누어 각 구간에 1개씩 배치
    for (let i = 0; i < spotCount; i++) {
      const sectionStart = 0.15 + (0.7 / spotCount) * i;
      const sectionEnd = 0.15 + (0.7 / spotCount) * (i + 1);
      this.spotPattern.push({
        along: p.random(sectionStart, sectionEnd),  // 구간별 분산 배치
        across: p.random(0.1, 0.9),                 // 폭 방향 더 넓게
        size: p.random(0.25, 0.5),                   // 반점 크기
      });
    }

    // 미니멀 디자인: 검은색 몸통 + 청록색 또는 분홍색 포인트
    const accentColorChoices = [
      p.color(0, 200, 200),      // 청록색 (cyan)
      p.color(255, 80, 150),     // 분홍색 (magenta/pink)
    ];

    this.color = p.random(accentColorChoices); // 포인트 컬러
    this.opacity = 255;
    this.brushType = 'marker'; // p5.brush의 브러시 타입

    // 재사용 벡터 초기화
    this._steerVec = p.createVector(0, 0);
    this._wanderCircle = p.createVector(0, 0);
    this._wanderOffset = p.createVector(0, 0);
    this._wanderTarget = p.createVector(0, 0);

    // IK 골격 시스템 초기화 (크기에 비례)
    this.segmentCount = 8; // 세그먼트 증가 (6→8, 더 부드러운 곡선)
    this.segmentLength = this.size * 0.06; // 세그먼트 길이 감소 (0.07→0.06)
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

    // 화면 경계 처리 (부드럽게 튕김) - 벡터 재사용
    const margin = 50;
    if (this.position.x < margin) {
      this._steerVec.set(this.maxForce, 0);
      this.applyForce(this._steerVec);
    }
    if (this.position.x > p.width - margin) {
      this._steerVec.set(-this.maxForce, 0);
      this.applyForce(this._steerVec);
    }
    if (this.position.y < margin) {
      this._steerVec.set(0, this.maxForce);
      this.applyForce(this._steerVec);
    }
    if (this.position.y > p.height - margin) {
      this._steerVec.set(0, -this.maxForce);
      this.applyForce(this._steerVec);
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
      const maxTurn = (20 * Math.PI) / 180; // 한 프레임당 최대 20도
      const turnAmount = Math.max(-maxTurn, Math.min(maxTurn, normalizedDiff * 0.2));
      this.movementAngle += turnAmount; // 부드럽게 회전 (최대 20도 제한)
    }

    // 헤엄치기 애니메이션 (속도에 비례, 부드럽게)
    this.swimOffset += speed * 0.15; // 속도에 비례, 빠른 주기

    // IK 골격 업데이트
    this.updateSkeleton();
  }

  /**
   * IK 골격 시스템 업데이트 (샘플 코드 방식 + 헤엄치기 효과)
   */
  updateSkeleton(): void {
    // 첫 번째 세그먼트(머리)가 목표 위치를 따라가며 뒤쪽을 향함
    // + 머리도 좌우로 흔들림 (±10도)
    const headSwingAmplitude = Math.PI / 22; // 약 8도 (머리는 안정적으로)
    const headSwingAngle = Math.sin(this.swimOffset) * headSwingAmplitude;

    this.segments[0].a.set(this.position.x, this.position.y);
    this.segments[0].angle = this.movementAngle + Math.PI + headSwingAngle; // 진행방향의 반대 + 흔들림
    this.segments[0].calculateB();

    // 나머지 세그먼트들이 연쇄적으로 앞 세그먼트의 끝점(b)을 따라감
    // + 헤엄치기 효과: sine wave로 각도만 흔들림
    for (let i = 1; i < this.segments.length; i++) {
      // 헤엄치기 효과: 꼬리로 갈수록 더 크게 각도 변화
      const t = i / this.segments.length;
      const swimAngleAmplitude = t * t * t * 0.8; // 세제곱 커브: 몸통은 거의 안 움직이고 꼬리만 강하게
      const swimFrequency = 0.7; // 위상 차 증가 (0.15→0.7, 파동 전파)
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

    // 벡터 재사용: copy() 대신 set + normalize + mult
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
   * 물고기 렌더링 (유선형 잉어 스타일)
   */
  display(): void {
    const p = (window as any).p5Instance;

    // 크기 스케일 (기준 크기 120 대비)
    const sizeScale = this.size / 120;

    const circleRadius = 9.5 * sizeScale;  // 몸통 폭 축소 (11→9.5)
    const tailSeg = this.segments[this.segmentCount - 1];
    const tailBaseAngle = tailSeg.angle;

    // 꼬리를 머리 쪽으로 이동 (크기에 비례)
    const tailOffset = 7 * sizeScale;
    const hingeX = tailSeg.b.x - Math.cos(tailBaseAngle) * tailOffset;
    const hingeY = tailSeg.b.y - Math.sin(tailBaseAngle) * tailOffset;

    // 꼬리 설정 (크기에 비례)
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

    // 세그먼트 중심점들 계산 (몸통)
    // 유선형 잉어 프로파일: 머리 끝은 좁고, 중간이 가장 불룩, 꼬리로 가늘어짐
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

    // 머리 끝: 유선형으로 좁게 마무리
    bodyPoints.push({
      x: this.position.x,
      y: this.position.y,
      angle: this.segments[0].angle,
      thickness: circleRadius * 0.45
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

    const subdivs = 4; // 보간 증가 (3→4, 더 부드러운 윤곽)
    const upperPoints = interpolateSpline(rawUpperPoints, subdivs);
    const lowerPoints = interpolateSpline(rawLowerPoints, subdivs);

    const head = bodyPoints[bodyPoints.length - 1];
    const headAngle = head.angle;

    // 몸통 채우기 제거 - ctx 스트라이프가 몸통 형태를 만듦

    const ctx = p.drawingContext as CanvasRenderingContext2D;

    // 농담(濃淡) 효과 - 고정 ratio 연속 스트라이프
    const stripeSpacing = 0.3 * sizeScale;
    const baseThickness = 4 * sizeScale;
    let noiseVal = this.noiseSeed;

    // 가장 넓은 폭 기준으로 글로벌 줄 수 결정
    let maxWidthSq = 0;
    for (let i = 0; i < upperPoints.length; i++) {
      const dx = upperPoints[i].x - lowerPoints[i].x;
      const dy = upperPoints[i].y - lowerPoints[i].y;
      const wSq = dx * dx + dy * dy;
      if (wSq > maxWidthSq) maxWidthSq = wSq;
    }
    const maxWidth = Math.sqrt(maxWidthSq);
    const globalStripes = Math.max(Math.floor(maxWidth / stripeSpacing), 2);

    // 폭 캐시: upperPoints/lowerPoints 간 거리를 미리 계산
    const widths = new Float32Array(upperPoints.length);
    for (let i = 0; i < upperPoints.length; i++) {
      const dx = upperPoints[i].x - lowerPoints[i].x;
      const dy = upperPoints[i].y - lowerPoints[i].y;
      widths[i] = Math.sqrt(dx * dx + dy * dy);
    }

    const invMaxWidth = maxWidth > 0 ? 1 / maxWidth : 1;
    const step = 1.2 * sizeScale;

    // 각 스트라이프를 모든 세그먼트에 걸쳐 연속으로 그림
    for (let s = 0; s < globalStripes; s++) {
      const ratio = (s + 0.5) / globalStripes;
      noiseVal += 0.3;

      // 폭 방향 그라데이션
      const widthCenter = 1 - Math.abs(ratio - 0.5) * 2;
      const alpha = 0.01 + widthCenter * widthCenter * 0.012;
      ctx.fillStyle = `rgba(30, 25, 20, ${alpha})`;

      const totalPts = upperPoints.length;
      for (let i = 0; i < totalPts - 1; i++) {
        const localRatioLimit1 = widths[i] * invMaxWidth;
        const localRatioLimit2 = widths[i + 1] * invMaxWidth;
        const margin = (1 - Math.min(localRatioLimit1, localRatioLimit2)) * 0.5;

        if (ratio < margin || ratio > 1 - margin) continue;

        // 머리 쪽(i가 클수록 머리) 농도 감쇠
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
          const x = x1 + sdx * frac;
          const y = y1 + sdy * frac;

          noiseVal += 0.02;
          const w = fastNoise(noiseVal) * baseThickness;

          const half = w * 0.5;
          ctx.fillRect(x - half, y - half, w, w);
        }
      }
    }

    // === 주황색 반점 ===
    for (const spot of this.spotPattern) {
      const idx = Math.floor(spot.along * (upperPoints.length - 1));
      const nextIdx = Math.min(idx + 1, upperPoints.length - 1);
      const localFrac = spot.along * (upperPoints.length - 1) - idx;

      // 보간된 위치 계산
      const ux = upperPoints[idx].x + (upperPoints[nextIdx].x - upperPoints[idx].x) * localFrac;
      const uy = upperPoints[idx].y + (upperPoints[nextIdx].y - upperPoints[idx].y) * localFrac;
      const lx = lowerPoints[idx].x + (lowerPoints[nextIdx].x - lowerPoints[idx].x) * localFrac;
      const ly = lowerPoints[idx].y + (lowerPoints[nextIdx].y - lowerPoints[idx].y) * localFrac;

      const cx = ux + (lx - ux) * spot.across;
      const cy = uy + (ly - uy) * spot.across;
      const localWidth = Math.sqrt((ux - lx) * (ux - lx) + (uy - ly) * (uy - ly));
      const spotRadius = localWidth * spot.size;

      // 주황색 점을 부드럽게 여러 겹으로 렌더링
      const spotSteps = Math.max(Math.floor(spotRadius / (0.8 * sizeScale)), 4);
      for (let si = 0; si < spotSteps; si++) {
        for (let sj = 0; sj < spotSteps; sj++) {
          const sx = cx + (si / spotSteps - 0.5) * spotRadius * 2;
          const sy = cy + (sj / spotSteps - 0.5) * spotRadius * 2;
          const dist = Math.sqrt((sx - cx) * (sx - cx) + (sy - cy) * (sy - cy));
          if (dist > spotRadius) continue;
          const falloff = 1 - (dist / spotRadius);
          noiseVal += 0.01;
          const w = fastNoise(noiseVal) * baseThickness * 0.6;
          const half = w * 0.5;
          ctx.fillStyle = `rgba(${this.accentRGB[0]}, ${this.accentRGB[1]}, ${this.accentRGB[2]}, ${0.12 * falloff})`;
          ctx.fillRect(sx - half, sy - half, w, w);
        }
      }
    }

    // === 꼬리 지느러미 ===
    const tailStripes = 6;
    const tailThickness = 2.5 * sizeScale;
    const tailStep = 1.8 * sizeScale;
    // 물고기마다 꼬리 다홍색 확률 결정 (noiseSeed 기반)
    const tailHasRed = fastNoise(this.noiseSeed + 99) > 0.4;

    let tailNoiseVal = this.noiseSeed + 500; // 꼬리 전용 고정 노이즈 시드
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
        const x = hingeX + tdx * frac;
        const y = hingeY + tdy * frac;
        tailNoiseVal += 0.02;
        const w = fastNoise(tailNoiseVal) * tailThickness;
        const half = w * 0.5;
        // 먹색 기본 (투명도 10% 증가)
        ctx.fillStyle = `rgba(30, 25, 20, 0.037)`;
        ctx.fillRect(x - half, y - half, w, w);
        // 다홍색 랜덤 포인트
        if (tailHasRed && fastNoise(tailNoiseVal + 7.77) > 0.35) {
          const accentAlpha = 0.05 * (1 - frac * 0.7);
          ctx.fillStyle = `rgba(${this.accentRGB[0]}, ${this.accentRGB[1]}, ${this.accentRGB[2]}, ${accentAlpha})`;
          ctx.fillRect(x - half * 1.3, y - half * 1.3, w * 1.3, w * 1.3);
        }
      }
    }

    // === 지느러미 ===
    const finFlap = Math.sin(this.swimOffset) * 0.5;
    const finThickness = 2 * sizeScale;
    const finLength = 22 * sizeScale;
    const finStripes = 5;
    ctx.fillStyle = `rgba(30, 25, 20, 0.04)`;
    const finStep = 3 * sizeScale;

    // 가슴지느러미 헬퍼
    const drawFin = (baseX: number, baseY: number, angle: number, length: number, stripes: number) => {
      for (let s = 0; s < stripes; s++) {
        const spread = ((s - (stripes - 1) / 2) / stripes) * 0.4;
        const finAngle = angle + spread;
        const cosA = Math.cos(finAngle), sinA = Math.sin(finAngle);
        const tipX = baseX + cosA * length;
        const tipY = baseY + sinA * length;

        const fdx = tipX - baseX, fdy = tipY - baseY;
        const segDist = Math.sqrt(fdx * fdx + fdy * fdy);
        const steps = Math.max(Math.floor(segDist / finStep), 1);
        const invSteps = 1 / steps;

        for (let t = 0; t <= steps; t++) {
          const frac = t * invSteps;
          const x = baseX + fdx * frac;
          const y = baseY + fdy * frac;
          noiseVal += 0.02;
          const w = fastNoise(noiseVal) * finThickness * (1 - frac * 0.5);
          const half = w * 0.5;
          ctx.fillRect(x - half, y - half, w, w);
        }
      }
    };

    // 가슴지느러미 (가장 넓은 부근)
    const pectoralIdx = 5;
    const pectoralAngle = bodyPoints[pectoralIdx]?.angle || this.segments[3].angle;

    if (upperPoints[pectoralIdx]) {
      drawFin(upperPoints[pectoralIdx].x, upperPoints[pectoralIdx].y,
        pectoralAngle - p.HALF_PI - finFlap, finLength, finStripes);
    }
    if (lowerPoints[pectoralIdx]) {
      drawFin(lowerPoints[pectoralIdx].x, lowerPoints[pectoralIdx].y,
        pectoralAngle + p.HALF_PI + finFlap, finLength, finStripes);
    }

    // 배지느러미 (꼬리 쪽)
    const ventralIdx = 2;
    const ventralAngle = bodyPoints[ventralIdx]?.angle || this.segments[5].angle;
    const ventralFlap = Math.sin(this.swimOffset + Math.PI * 0.5) * 0.35;
    const ventralLength = 14 * sizeScale;

    if (upperPoints[ventralIdx]) {
      drawFin(upperPoints[ventralIdx].x, upperPoints[ventralIdx].y,
        ventralAngle - p.HALF_PI - ventralFlap, ventralLength, 3);
    }
    if (lowerPoints[ventralIdx]) {
      drawFin(lowerPoints[ventralIdx].x, lowerPoints[ventralIdx].y,
        ventralAngle + p.HALF_PI + ventralFlap, ventralLength, 3);
    }

    // 수염
    const barbelBaseX = this.position.x + Math.cos(headAngle) * circleRadius * 0.9;
    const barbelBaseY = this.position.y + Math.sin(headAngle) * circleRadius * 0.9;

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
