/**
 * Water - 물의 물리적 특성을 정의하는 클래스
 * 수묵화/수채화 느낌을 위한 유체 역학 시뮬레이션
 */
export class Water {
  // 물의 밀도 (density)
  density: number;

  // 점성 (viscosity) - 물의 저항력
  viscosity: number;

  // 유체 저항 계수 (drag coefficient)
  dragCoefficient: number;

  // 부력 (buoyancy)
  buoyancy: number;

  constructor() {
    this.density = 1000; // kg/m³
    this.viscosity = 0.89; // mPa·s at 25°C
    this.dragCoefficient = 0.47; // 일반적인 물체의 항력 계수
    this.buoyancy = 9.81; // 중력 가속도
  }

  /**
   * 물의 저항력 계산
   * @param velocity - 물체의 속도 벡터
   * @param area - 물체의 단면적
   */
  calculateDrag(velocity: p5.Vector, area: number = 1): p5.Vector {
    const speed = velocity.mag();
    const dragMagnitude = 0.5 * this.density * speed * speed * this.dragCoefficient * area * 0.0001;

    const drag = velocity.copy();
    drag.normalize();
    drag.mult(-dragMagnitude);

    return drag;
  }

  /**
   * 점성에 의한 저항 계산
   */
  calculateViscosity(velocity: p5.Vector): p5.Vector {
    const viscousForce = velocity.copy();
    viscousForce.mult(-this.viscosity * 0.01);
    return viscousForce;
  }

  /**
   * 물의 흐름 효과 (선택적)
   * @param x - x 좌표
   * @param y - y 좌표
   * @param time - 시간
   */
  getFlowField(x: number, y: number, time: number): p5.Vector {
    const p = (window as any).p5Instance;
    const noise1 = p.noise(x * 0.01, y * 0.01, time * 0.1);
    const noise2 = p.noise(x * 0.01 + 1000, y * 0.01 + 1000, time * 0.1);

    const angle = noise1 * Math.PI * 2;
    const magnitude = noise2 * 0.5;

    return p.createVector(
      Math.cos(angle) * magnitude,
      Math.sin(angle) * magnitude
    );
  }
}
