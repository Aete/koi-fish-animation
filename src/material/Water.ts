import type p5 from 'p5';

/**
 * Water - Defines physical properties of water
 * Fluid dynamics simulation for ink wash / watercolor aesthetics
 */
export class Water {
  // Water density
  density: number;

  // Viscosity - water resistance
  viscosity: number;

  // Drag coefficient
  dragCoefficient: number;

  // Buoyancy (gravitational acceleration)
  buoyancy: number;

  constructor() {
    this.density = 1000; // kg/m³
    this.viscosity = 0.89; // mPa·s at 25°C
    this.dragCoefficient = 0.47;
    this.buoyancy = 9.81;
  }

  /**
   * Calculate water drag force
   * @param velocity - Object velocity vector
   * @param area - Object cross-sectional area
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
   * Calculate viscous resistance
   */
  calculateViscosity(velocity: p5.Vector): p5.Vector {
    const viscousForce = velocity.copy();
    viscousForce.mult(-this.viscosity * 0.01);
    return viscousForce;
  }

  /**
   * Water flow field effect
   * @param x - x coordinate
   * @param y - y coordinate
   * @param time - time
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
