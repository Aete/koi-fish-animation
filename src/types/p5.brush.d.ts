/**
 * p5.brush 타입 선언
 */
interface BrushInterface {
  set(brushType: string, color: p5.Color | string, weight?: number): void;
  fill(color: p5.Color | string, opacity?: number): void;
  noFill(): void;
  stroke(color: p5.Color | string, opacity?: number): void;
  noStroke(): void;
  strokeWeight(weight: number): void;
  bleed(amount: number): void;
  fillTexture(intensity: number, border?: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  ellipse(x: number, y: number, w: number, h?: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  circle(x: number, y: number, d: number): void;
  beginShape(): void;
  vertex(x: number, y: number): void;
  endShape(mode?: string): void;
}

interface Window {
  brush: BrushInterface;
}

declare const brush: BrushInterface;
