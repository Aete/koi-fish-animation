import type p5 from 'p5';
import { Water } from '../material/Water';

/**
 * Physics - Manages world physics rules
 * Nature of Code style physics engine
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
   * Apply boundary conditions (wraparound)
   * Objects that leave the screen appear on the opposite side
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
   * Apply water resistance
   */
  applyWaterResistance(velocity: p5.Vector, area: number = 1): p5.Vector {
    const drag = this.water.calculateDrag(velocity, area);
    const viscosity = this.water.calculateViscosity(velocity);

    const totalResistance = drag.copy();
    totalResistance.add(viscosity);

    return totalResistance;
  }

  /**
   * Apply flow field effect
   */
  applyFlowField(position: p5.Vector, time: number): p5.Vector {
    return this.water.getFlowField(position.x, position.y, time);
  }

  /**
   * Update screen dimensions
   */
  updateDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}
