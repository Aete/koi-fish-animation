import type p5 from 'p5';
import { Water } from '../material/Water';

/**
 * Physics - 세계의 물리 법칙을 관리하는 클래스
 * Nature of Code 스타일의 물리 엔진
 */
export class Physics {
  water: Water;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.water = new Water();
    this.width = width;
    this.height = height;
  }

  /**
   * 경계 조건 적용 (wraparound)
   * 물체가 화면을 벗어나면 반대편에서 나타남
   */
  applyBoundary(position: p5.Vector): p5.Vector {
    const newPos = position.copy();

    if (newPos.x > this.width) {
      newPos.x = 0;
    } else if (newPos.x < 0) {
      newPos.x = this.width;
    }

    if (newPos.y > this.height) {
      newPos.y = 0;
    } else if (newPos.y < 0) {
      newPos.y = this.height;
    }

    return newPos;
  }

  /**
   * 물의 저항력 적용
   */
  applyWaterResistance(velocity: p5.Vector, area: number = 1): p5.Vector {
    const drag = this.water.calculateDrag(velocity, area);
    const viscosity = this.water.calculateViscosity(velocity);

    const totalResistance = drag.copy();
    totalResistance.add(viscosity);

    return totalResistance;
  }

  /**
   * 물의 흐름 효과 적용
   */
  applyFlowField(position: p5.Vector, time: number): p5.Vector {
    return this.water.getFlowField(position.x, position.y, time);
  }

  /**
   * 화면 크기 업데이트
   */
  updateDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}
