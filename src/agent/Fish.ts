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
    this.size = p.random(80, 140);

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
    const tailLength = 25 * sizeScale;  // 꼬리 크기
    const tailSpread = Math.PI / 4; // 45도
    const maxTailSwing = Math.PI / 15;  // 12도 (좌우 각도 줄임)
    const tailSwingAngle = Math.sin(this.swimOffset * 0.25) * maxTailSwing;  // 속도 50% 감소

    // 위쪽 꼬리 끝점
    const upperTailAngle = tailBaseAngle + tailSpread / 2 + tailSwingAngle;
    const upperTailTip = p.createVector(
      hingeX + Math.cos(upperTailAngle) * tailLength,
      hingeY + Math.sin(upperTailAngle) * tailLength
    );

    // 아래쪽 꼬리 끝점
    const lowerTailAngle = tailBaseAngle - tailSpread / 2 + tailSwingAngle;
    const lowerTailTip = p.createVector(
      hingeX + Math.cos(lowerTailAngle) * tailLength,
      hingeY + Math.sin(lowerTailAngle) * tailLength
    );

    // 꼬리 중앙 끝점 (V자 모양의 중앙)
    const centerTailTip = p.createVector(
      hingeX + Math.cos(tailBaseAngle + tailSwingAngle) * tailLength * 0.6,
      hingeY + Math.sin(tailBaseAngle + tailSwingAngle) * tailLength * 0.6
    );

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

    // 윤곽선 점들 계산
    const upperPoints = [];
    const lowerPoints = [];

    for (let i = 0; i < bodyPoints.length; i++) {
      const pt = bodyPoints[i];
      const upperX = pt.x + Math.cos(pt.angle + p.HALF_PI) * pt.thickness;
      const upperY = pt.y + Math.sin(pt.angle + p.HALF_PI) * pt.thickness;
      const lowerX = pt.x + Math.cos(pt.angle - p.HALF_PI) * pt.thickness;
      const lowerY = pt.y + Math.sin(pt.angle - p.HALF_PI) * pt.thickness;
      upperPoints.push({ x: upperX, y: upperY });
      lowerPoints.push({ x: lowerX, y: lowerY });
    }

    // === 수묵화 스타일: 외곽선을 여러 번 겹쳐 그리기 ===
    const outlineStrokes = 4;  // 외곽선 겹쳐 그리는 횟수 (6→4로 감소, 33% 빠름)
    const noiseScale = 3 * sizeScale;      // 노이즈 강도 (크기에 비례)

    const head = bodyPoints[bodyPoints.length - 1];
    const headAngle = head.angle;

    // 1. 몸통 채우기 (한 번만, 연한 색) - 꼬리와 10% 겹치게
    p.fill(248, 245, 238, 180);
    p.noStroke();

    // 꼬리와 겹치는 부분 (10% 연장)
    const overlapRatio = 0.1;
    const bodyTailUpperX = p.lerp(upperPoints[0].x, hingeX, overlapRatio);
    const bodyTailUpperY = p.lerp(upperPoints[0].y, hingeY, overlapRatio);
    const bodyTailLowerX = p.lerp(lowerPoints[0].x, hingeX, overlapRatio);
    const bodyTailLowerY = p.lerp(lowerPoints[0].y, hingeY, overlapRatio);

    p.beginShape();
    // 꼬리 연결부 (10% 겹침)
    p.curveVertex(bodyTailUpperX, bodyTailUpperY);
    p.curveVertex(bodyTailUpperX, bodyTailUpperY);
    for (let i = 0; i < upperPoints.length; i++) {
      p.curveVertex(upperPoints[i].x, upperPoints[i].y);
    }
    p.curveVertex(
      head.x + Math.cos(headAngle) * head.thickness * 0.8,
      head.y + Math.sin(headAngle) * head.thickness * 0.8
    );
    for (let i = lowerPoints.length - 1; i >= 0; i--) {
      p.curveVertex(lowerPoints[i].x, lowerPoints[i].y);
    }
    // 꼬리 연결부 (10% 겹침)
    p.curveVertex(bodyTailLowerX, bodyTailLowerY);
    p.curveVertex(bodyTailLowerX, bodyTailLowerY);
    p.endShape(p.CLOSE);

    // 2. 외곽선만 여러 번 노이즈를 주면서 겹쳐 그리기
    for (let stroke = 0; stroke < outlineStrokes; stroke++) {
      const alpha = 15 + stroke * 8;  // 점점 진해지는 투명도
      const noiseOffset = stroke * 100 + this.swimOffset * 10;  // 움직임에 따라 변하는 노이즈
      const strokeNoiseScale = noiseScale * (1 - stroke * 0.1);  // 점점 노이즈 감소

      p.noFill();
      p.stroke(30, 25, 20, alpha);
      p.strokeWeight(1.8 - stroke * 0.2);

      p.beginShape();
      // 꼬리 연결부에서 시작 (10% 겹침)
      const n1x = (p.noise(noiseOffset + 0.1) - 0.5) * strokeNoiseScale;
      const n1y = (p.noise(noiseOffset + 0.15) - 0.5) * strokeNoiseScale;
      p.curveVertex(bodyTailUpperX + n1x, bodyTailUpperY + n1y);
      p.curveVertex(bodyTailUpperX + n1x, bodyTailUpperY + n1y);

      // 위쪽 몸통 윤곽선
      for (let i = 0; i < upperPoints.length; i++) {
        const nx = (p.noise(noiseOffset + i * 0.2) - 0.5) * strokeNoiseScale;
        const ny = (p.noise(noiseOffset + i * 0.2 + 50) - 0.5) * strokeNoiseScale;
        p.curveVertex(upperPoints[i].x + nx, upperPoints[i].y + ny);
      }

      // 머리 둥글게
      const headNx = (p.noise(noiseOffset + 10) - 0.5) * strokeNoiseScale;
      const headNy = (p.noise(noiseOffset + 10.5) - 0.5) * strokeNoiseScale;
      p.curveVertex(
        head.x + Math.cos(headAngle) * head.thickness * 0.8 + headNx,
        head.y + Math.sin(headAngle) * head.thickness * 0.8 + headNy
      );

      // 아래쪽 몸통 윤곽선 (역순)
      for (let i = lowerPoints.length - 1; i >= 0; i--) {
        const nx = (p.noise(noiseOffset + i * 0.2 + 20) - 0.5) * strokeNoiseScale;
        const ny = (p.noise(noiseOffset + i * 0.2 + 70) - 0.5) * strokeNoiseScale;
        p.curveVertex(lowerPoints[i].x + nx, lowerPoints[i].y + ny);
      }

      // 꼬리 연결부에서 끝 (10% 겹침)
      const n2x = (p.noise(noiseOffset + 0.2) - 0.5) * strokeNoiseScale;
      const n2y = (p.noise(noiseOffset + 0.25) - 0.5) * strokeNoiseScale;
      p.curveVertex(bodyTailLowerX + n2x, bodyTailLowerY + n2y);
      p.curveVertex(bodyTailLowerX + n2x, bodyTailLowerY + n2y);

      p.endShape(p.CLOSE);
    }

    // 꼬리 지느러미 - 채우기 (불투명하게 해서 몸통 가리기)
    p.fill(248, 245, 238);  // 배경색과 비슷한 불투명 색상
    p.noStroke();
    p.beginShape();
    p.vertex(hingeX, hingeY);
    p.quadraticVertex(
      (hingeX + upperTailTip.x) / 2 + Math.cos(upperTailAngle + p.HALF_PI) * 8,
      (hingeY + upperTailTip.y) / 2 + Math.sin(upperTailAngle + p.HALF_PI) * 8,
      upperTailTip.x, upperTailTip.y
    );
    p.vertex(centerTailTip.x, centerTailTip.y);
    p.vertex(lowerTailTip.x, lowerTailTip.y);
    p.quadraticVertex(
      (hingeX + lowerTailTip.x) / 2 + Math.cos(lowerTailAngle - p.HALF_PI) * 8,
      (hingeY + lowerTailTip.y) / 2 + Math.sin(lowerTailAngle - p.HALF_PI) * 8,
      hingeX, hingeY
    );
    p.endShape(p.CLOSE);

    // 꼬리 지느러미 - 외곽선 여러 번 겹쳐 그리기
    for (let stroke = 0; stroke < outlineStrokes; stroke++) {
      const alpha = 12 + stroke * 6;
      const noiseOffset = stroke * 50 + 200 + this.swimOffset * 5;
      const strokeNoiseScale = noiseScale * 0.8;
      const nx = (p.noise(noiseOffset) - 0.5) * strokeNoiseScale;
      const ny = (p.noise(noiseOffset + 0.5) - 0.5) * strokeNoiseScale;

      p.noFill();
      p.stroke(40, 35, 30, alpha);
      p.strokeWeight(1.2 - stroke * 0.1);

      p.beginShape();
      p.vertex(hingeX + nx, hingeY + ny);
      p.quadraticVertex(
        (hingeX + upperTailTip.x) / 2 + Math.cos(upperTailAngle + p.HALF_PI) * 8 + nx,
        (hingeY + upperTailTip.y) / 2 + Math.sin(upperTailAngle + p.HALF_PI) * 8 + ny,
        upperTailTip.x + nx, upperTailTip.y + ny
      );
      p.vertex(centerTailTip.x + nx, centerTailTip.y + ny);
      p.vertex(lowerTailTip.x + nx, lowerTailTip.y + ny);
      p.quadraticVertex(
        (hingeX + lowerTailTip.x) / 2 + Math.cos(lowerTailAngle - p.HALF_PI) * 8 + nx,
        (hingeY + lowerTailTip.y) / 2 + Math.sin(lowerTailAngle - p.HALF_PI) * 8 + ny,
        hingeX + nx, hingeY + ny
      );
      p.endShape(p.CLOSE);
    }

    // 농담(濃淡) 효과 - 여러 번 겹쳐서 부드럽게 (최적화: 2×10으로 감소)
    for (let stroke = 0; stroke < 2; stroke++) {
      for (let s = 0; s < 10; s++) {
        const t = s / 15;
        const inkDensity = p.lerp(200, 100, t);
        const noiseOffset = stroke * 30 + s;
        const nx = (p.noise(noiseOffset) - 0.5) * noiseScale;
        const ny = (p.noise(noiseOffset + 0.5) - 0.5) * noiseScale;

        p.fill(inkDensity, inkDensity - 5, inkDensity - 10, 20);
        p.noStroke();

        const floatIdx = t * (bodyPoints.length - 1);
        const idx1 = Math.floor(floatIdx);
        const idx2 = Math.min(idx1 + 1, bodyPoints.length - 1);

        if (idx1 < upperPoints.length && idx2 < upperPoints.length) {
          p.beginShape();
          p.vertex(upperPoints[idx1].x + nx, upperPoints[idx1].y + ny);
          p.vertex(upperPoints[idx2].x + nx, upperPoints[idx2].y + ny);
          p.vertex(lowerPoints[idx2].x + nx, lowerPoints[idx2].y + ny);
          p.vertex(lowerPoints[idx1].x + nx, lowerPoints[idx1].y + ny);
          p.endShape(p.CLOSE);
        }
      }
    }

    // === 지느러미 - 외곽선에서 진자운동 ===
    // 지느러미 펄럭임 애니메이션 (삼각함수로 진자운동)
    const finFlapSpeed = 1;  // 펄럭이는 속도 (느리게)
    const finFlapAmount = 0.5;  // 펄럭이는 각도 범위
    const finFlap = Math.sin(this.swimOffset * finFlapSpeed) * finFlapAmount;

    // 가슴지느러미 - 꼬리 쪽으로 이동 (인덱스 낮춤)
    const pectoralIdx = 3;  // 꼬리 쪽으로 이동
    const pectoralAngle = bodyPoints[pectoralIdx]?.angle || this.segments[2].angle;

    // 가슴지느러미 - 여러 번 겹쳐 그리기
    for (let stroke = 0; stroke < outlineStrokes; stroke++) {
      const alpha = 25 + stroke * 10;
      const nx = (p.noise(stroke * 10 + 300) - 0.5) * noiseScale;
      const ny = (p.noise(stroke * 10 + 350) - 0.5) * noiseScale;

      p.fill(180, 175, 165, alpha * 0.5);
      p.stroke(50, 45, 40, alpha);
      p.strokeWeight(1 - stroke * 0.1);

      // 오른쪽 가슴지느러미 (위쪽 외곽선에서 진자운동, 방향 반전, 크기 비례)
      if (upperPoints[pectoralIdx]) {
        p.push();
        p.translate(upperPoints[pectoralIdx].x + nx, upperPoints[pectoralIdx].y + ny);
        p.rotate(pectoralAngle - p.HALF_PI + finFlap);  // 방향 반전 (꼬리 쪽으로)
        p.scale(sizeScale); // 크기 스케일 적용
        p.beginShape();
        p.vertex(0, 0);
        p.quadraticVertex(5, 6, 2, 22);
        p.quadraticVertex(0, 12, -2, 22);
        p.quadraticVertex(-3, 6, 0, 0);
        p.endShape(p.CLOSE);
        p.pop();
      }

      // 왼쪽 가슴지느러미 (아래쪽 외곽선에서 진자운동, 방향 반전, 크기 비례)
      if (lowerPoints[pectoralIdx]) {
        p.push();
        p.translate(lowerPoints[pectoralIdx].x + nx, lowerPoints[pectoralIdx].y + ny);
        p.rotate(pectoralAngle + p.HALF_PI - finFlap);  // 방향 반전 (꼬리 쪽으로)
        p.scale(sizeScale); // 크기 스케일 적용
        p.beginShape();
        p.vertex(0, 0);
        p.quadraticVertex(-5, -6, -2, -22);
        p.quadraticVertex(0, -12, 2, -22);
        p.quadraticVertex(3, -6, 0, 0);
        p.endShape(p.CLOSE);
        p.pop();
      }
    }

    // 배지느러미 - 꼬리 쪽으로 이동 (가슴지느러미와 약간 다른 위상)
    const ventralIdx = 1;  // 꼬리 쪽으로 더 이동
    const ventralAngle = bodyPoints[ventralIdx]?.angle || this.segments[4].angle;

    // 배지느러미 펄럭임 (가슴지느러미와 위상 차이)
    const ventralFlap = Math.sin(this.swimOffset * finFlapSpeed + Math.PI * 0.5) * finFlapAmount * 0.7;

    for (let stroke = 0; stroke < outlineStrokes; stroke++) {
      const alpha = 25 + stroke * 10;
      const nx = (p.noise(stroke * 10 + 400) - 0.5) * noiseScale;
      const ny = (p.noise(stroke * 10 + 450) - 0.5) * noiseScale;

      p.fill(190, 185, 175, alpha * 0.5);
      p.stroke(50, 45, 40, alpha);
      p.strokeWeight(0.8);

      // 오른쪽 배지느러미 (위쪽 외곽선에서 진자운동, 방향 반전, 크기 비례)
      if (upperPoints[ventralIdx]) {
        p.push();
        p.translate(upperPoints[ventralIdx].x + nx, upperPoints[ventralIdx].y + ny);
        p.rotate(ventralAngle - p.HALF_PI + ventralFlap);  // 방향 반전 (꼬리 쪽으로)
        p.scale(sizeScale); // 크기 스케일 적용
        p.beginShape();
        p.vertex(0, 0);
        p.quadraticVertex(3, 4, 1, 14);
        p.quadraticVertex(-1, 7, 0, 0);
        p.endShape(p.CLOSE);
        p.pop();
      }

      // 왼쪽 배지느러미 (아래쪽 외곽선에서 진자운동, 방향 반전, 크기 비례)
      if (lowerPoints[ventralIdx]) {
        p.push();
        p.translate(lowerPoints[ventralIdx].x + nx, lowerPoints[ventralIdx].y + ny);
        p.rotate(ventralAngle + p.HALF_PI - ventralFlap);  // 방향 반전 (꼬리 쪽으로)
        p.scale(sizeScale); // 크기 스케일 적용
        p.beginShape();
        p.vertex(0, 0);
        p.quadraticVertex(-3, -4, -1, -14);
        p.quadraticVertex(1, -7, 0, 0);
        p.endShape(p.CLOSE);
        p.pop();
      }
    }

    // 눈 그리기 - 여러 번 겹쳐서 붓터치 느낌 (최적화: 3→2)
    const eyeOffset = circleRadius * 0.8;
    const eyeRX = this.position.x + Math.cos(headAngle + p.HALF_PI) * eyeOffset;
    const eyeRY = this.position.y + Math.sin(headAngle + p.HALF_PI) * eyeOffset;
    const eyeLX = this.position.x + Math.cos(headAngle - p.HALF_PI) * eyeOffset;
    const eyeLY = this.position.y + Math.sin(headAngle - p.HALF_PI) * eyeOffset;

    for (let stroke = 0; stroke < 2; stroke++) {
      const alpha = 30 + stroke * 25;
      const enx = (p.noise(stroke * 5 + 500) - 0.5) * 1.5 * sizeScale;
      const eny = (p.noise(stroke * 5 + 550) - 0.5) * 1.5 * sizeScale;

      p.fill(20, 15, 10, alpha);
      p.noStroke();
      p.circle(eyeRX + enx, eyeRY + eny, (4 - stroke * 0.3) * sizeScale);
      p.circle(eyeLX + enx, eyeLY + eny, (4 - stroke * 0.3) * sizeScale);
    }

    // 수염 (barbels) - 여러 번 겹쳐서 붓터치 느낌 (최적화: 3→2)
    const barbelBaseX = this.position.x + Math.cos(headAngle) * circleRadius * 1.3;
    const barbelBaseY = this.position.y + Math.sin(headAngle) * circleRadius * 1.3;

    for (let stroke = 0; stroke < 2; stroke++) {
      const alpha = 25 + stroke * 20;
      const bnx = (p.noise(stroke * 5 + 600) - 0.5) * 1.5 * sizeScale;
      const bny = (p.noise(stroke * 5 + 650) - 0.5) * 1.5 * sizeScale;

      p.stroke(30, 25, 20, alpha);
      p.strokeWeight((1.2 - stroke * 0.2) * sizeScale);
      p.noFill();

      // 오른쪽 수염 (크기 비례)
      p.beginShape();
      p.vertex(barbelBaseX + bnx, barbelBaseY + bny);
      p.quadraticVertex(
        barbelBaseX + Math.cos(headAngle + 0.4) * 10 * sizeScale + bnx,
        barbelBaseY + Math.sin(headAngle + 0.4) * 10 * sizeScale + bny,
        barbelBaseX + Math.cos(headAngle + 0.6) * 15 * sizeScale + bnx,
        barbelBaseY + Math.sin(headAngle + 0.6) * 15 * sizeScale + bny
      );
      p.endShape();

      // 왼쪽 수염 (크기 비례)
      p.beginShape();
      p.vertex(barbelBaseX + bnx, barbelBaseY + bny);
      p.quadraticVertex(
        barbelBaseX + Math.cos(headAngle - 0.4) * 10 * sizeScale + bnx,
        barbelBaseY + Math.sin(headAngle - 0.4) * 10 * sizeScale + bny,
        barbelBaseX + Math.cos(headAngle - 0.6) * 15 * sizeScale + bnx,
        barbelBaseY + Math.sin(headAngle - 0.6) * 15 * sizeScale + bny
      );
      p.endShape();
    }
  }
}
