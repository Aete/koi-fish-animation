import { RippleParams } from '../gui/RippleParams';

/**
 * Ripple - 수면 파문 효과
 * 클릭 시 동심원이 확장되며, 물고기에 도망 힘과 왜곡 효과를 적용
 */
export class Ripple {
  cx: number;
  cy: number;
  radius: number;
  amplitude: number;
  alive: boolean;
  // 생성 시점의 초기 amplitude 스냅샷
  private _initAmplitude: number;

  constructor(x: number, y: number) {
    this.cx = x;
    this.cy = y;
    this.radius = 0;
    this._initAmplitude = RippleParams.amplitude;
    this.amplitude = this._initAmplitude;
    this.alive = true;
  }

  update(): void {
    this.radius += RippleParams.speed;
    // amplitude 감쇠: 반경이 커질수록 약해짐
    this.amplitude = this._initAmplitude * (1 - this.radius / RippleParams.maxRadius);
    if (this.radius > RippleParams.maxRadius) {
      this.alive = false;
    }
  }

  /**
   * 임의 좌표에 대한 왜곡 벡터 반환
   * 파동 전면(wavefront) 근처에서만 활성화
   */
  getDisplacement(x: number, y: number): { dx: number; dy: number } {
    const ddx = x - this.cx;
    const ddy = y - this.cy;
    const distSq = ddx * ddx + ddy * ddy;
    const dist = Math.sqrt(distSq);

    const waveWidth = RippleParams.waveWidth;
    // early return: 파동 범위 밖
    const diff = dist - this.radius;
    if (Math.abs(diff) > waveWidth) {
      return { dx: 0, dy: 0 };
    }

    // Gaussian envelope * sin wave
    const halfWidth = waveWidth * 0.5;
    const envelope = Math.exp(-(diff * diff) / (2 * halfWidth * halfWidth));
    const wave = Math.sin((diff / waveWidth) * Math.PI * 2);
    const displacement = this.amplitude * envelope * wave;

    // 중심으로부터의 방향으로 밀어냄
    if (dist < 0.1) return { dx: 0, dy: 0 };
    const invDist = 1 / dist;
    return {
      dx: ddx * invDist * displacement,
      dy: ddy * invDist * displacement,
    };
  }

  /**
   * 동심원 시각 효과를 trail layer에 렌더링
   */
  display(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) return;

    const progress = this.radius / RippleParams.maxRadius;
    const baseAlpha = RippleParams.strokeAlpha * (1 - progress);
    if (baseAlpha <= 0) return;

    const { strokeColor, fillColor, fillAlpha, ringCount, ringGap, lineWidth } = RippleParams;

    // hex → r,g,b 파싱
    const sr = parseInt(strokeColor.slice(1, 3), 16);
    const sg = parseInt(strokeColor.slice(3, 5), 16);
    const sb = parseInt(strokeColor.slice(5, 7), 16);
    const fr = parseInt(fillColor.slice(1, 3), 16);
    const fg = parseInt(fillColor.slice(3, 5), 16);
    const fb = parseInt(fillColor.slice(5, 7), 16);

    ctx.save();
    ctx.lineWidth = lineWidth;

    for (let i = 0; i < ringCount; i++) {
      const r = this.radius - i * ringGap;
      if (r <= 0) continue;
      const alpha = baseAlpha * (1 - i * (0.9 / ringCount));
      if (alpha <= 0) continue;

      ctx.beginPath();
      ctx.arc(this.cx, this.cy, r, 0, Math.PI * 2);

      // 면 채우기
      const fa = fillAlpha * (1 - progress);
      if (fa > 0) {
        ctx.fillStyle = `rgba(${fr}, ${fg}, ${fb}, ${fa})`;
        ctx.fill();
      }

      // 선 그리기
      ctx.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, ${alpha})`;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 리플 중심으로부터의 도망 힘
   */
  getScatterForce(fishX: number, fishY: number): { fx: number; fy: number } {
    const { scatterWindow, scatterStrength } = RippleParams;
    const scatterRange = Math.min(window.innerWidth * 0.3, 300);
    const progress = this.radius / RippleParams.maxRadius;
    if (progress > scatterWindow) return { fx: 0, fy: 0 };

    const ddx = fishX - this.cx;
    const ddy = fishY - this.cy;
    const distSq = ddx * ddx + ddy * ddy;
    const dist = Math.sqrt(distSq);

    if (dist < 1) return { fx: 0, fy: 0 };
    if (dist > scatterRange) return { fx: 0, fy: 0 };

    const distRatio = 1 - dist / scatterRange;
    // distanceFactor: 가까운 물고기에 추가 배율 (1 + factor * distRatio)
    const proximityBoost = 1 + RippleParams.distanceFactor * distRatio;
    const strength = scatterStrength * distRatio * proximityBoost * (1 - progress / scatterWindow);
    const invDist = 1 / dist;

    return {
      fx: ddx * invDist * strength,
      fy: ddy * invDist * strength,
    };
  }
}
