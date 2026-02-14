import "./types/p5.brush.d.ts";
import { Fish } from "./agent/Fish";
import { Physics } from "./world/Physics";
import { Ripple } from "./effects/Ripple";
import { playDropSound } from "./effects/DropSound";
import {
  isMobile,
  DESKTOP_QUALITY,
  MOBILE_QUALITY,
} from "./types/QualitySettings";
import type { QualitySettings } from "./types/QualitySettings";
import p5 from "p5";

const sketch = (p: p5) => {
  let fishes: Fish[] = [];
  let ripples: Ripple[] = [];
  let physics: Physics;
  let time = 0;
  const quality: QualitySettings = isMobile()
    ? MOBILE_QUALITY
    : DESKTOP_QUALITY;
  let trailLayer: p5.Graphics; // Trail (ink spread) buffer

  // FPS DOM element
  let fpsDiv: HTMLDivElement;

  // Set p5 globally (for Fish class access)
  (window as any).p5Instance = p;

  p.setup = () => {
    // Uniform logical pixel rendering across all devices (mobile high-DPI correction)
    p.pixelDensity(1);

    const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
    canvas.parent("app");

    // Limit frame rate on mobile
    if (quality.frameRate > 0) {
      p.frameRate(quality.frameRate);
    }

    // Initialize physics
    physics = new Physics(p.width, p.height);

    // Spawn fish randomly across the screen
    for (let i = 0; i < quality.fishCount; i++) {
      const x = p.random(100, p.width - 100);
      const y = p.random(100, p.height - 100);
      fishes.push(new Fish(x, y));
    }

    p.background(255);

    // Create trail layer (transparent buffer)
    trailLayer = p.createGraphics(p.width, p.height);
    trailLayer.clear();

    // Create FPS DOM element
    fpsDiv = document.createElement("div");
    fpsDiv.style.cssText =
      "position:fixed;top:10px;left:10px;font:12px monospace;color:rgba(0,0,0,0.6);pointer-events:none;z-index:1000;";
    document.body.appendChild(fpsDiv);

  };

  p.draw = () => {
    // Update time
    time += 0.01;

    // 1) Trail layer fade: gradually erase previous frame traces with semi-transparent white
    const tCtx = trailLayer.drawingContext as CanvasRenderingContext2D;
    tCtx.fillStyle = "rgba(255, 255, 255, 0.04)";
    tCtx.fillRect(0, 0, p.width, p.height);

    // 2) Update ripples + remove dead ones
    for (const ripple of ripples) {
      ripple.update();
    }
    ripples = ripples.filter((r) => r.alive);

    // 3) Apply scatter force to fish → update → display (pass ripples)
    for (const fish of fishes) {
      fish.applyScatterForce(ripples);
      fish.update(physics, time);
      fish.display(quality, trailLayer, ripples);
    }

    // 4) Render ripple visual effects on trail layer
    for (const ripple of ripples) {
      ripple.display(tCtx);
    }

    // 5) Main canvas: clean background + composite trail layer
    p.background(255);
    p.image(trailLayer, 0, 0);

    // Display FPS (dev)
    displayInfo();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    physics.updateDimensions(p.width, p.height);
    trailLayer.remove();
    trailLayer = p.createGraphics(p.width, p.height);
    trailLayer.clear();
  };

  const displayInfo = (): void => {
    // Update FPS text every 10 frames only
    if (p.frameCount % 10 === 0 && fpsDiv) {
      const fps = p.frameRate().toFixed(0);
      fpsDiv.textContent = `FPS: ${fps} | Fish: ${fishes.length} | Click to create ripple`;
    }
  };

  p.mousePressed = () => {
    // Create ripple on mouse click
    if (
      p.mouseX >= 0 &&
      p.mouseX <= p.width &&
      p.mouseY >= 0 &&
      p.mouseY <= p.height
    ) {
      // Limit to 5 max
      if (ripples.length >= 5) {
        ripples.shift();
      }
      ripples.push(new Ripple(p.mouseX, p.mouseY));
      playDropSound();
      // Mobile haptic feedback (short vibration)
      if (isMobile() && navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
  };
};

new p5(sketch);
