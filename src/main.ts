import "./types/p5.brush.d.ts";
import { Fish } from "./agent/Fish";
import { Physics } from "./world/Physics";
import {
  isMobile,
  DESKTOP_QUALITY,
  MOBILE_QUALITY,
} from "./types/QualitySettings";
import type { QualitySettings } from "./types/QualitySettings";
import p5 from "p5";

const sketch = (p: p5) => {
  let fishes: Fish[] = [];
  let physics: Physics;
  let time = 0;
  const quality: QualitySettings = isMobile()
    ? MOBILE_QUALITY
    : DESKTOP_QUALITY;
  let trailLayer: p5.Graphics; // 잔상(먹 번짐) 버퍼

  // FPS DOM 엘리먼트
  let fpsDiv: HTMLDivElement;

  // p5를 전역에 설정 (Fish 클래스가 사용할 수 있도록)
  (window as any).p5Instance = p;

  p.setup = () => {
    // 모든 기기에서 동일한 논리 픽셀 기준 렌더링 (모바일 고DPI 보정)
    p.pixelDensity(1);

    const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
    canvas.parent("app");

    // 모바일 프레임 레이트 제한
    if (quality.frameRate > 0) {
      p.frameRate(quality.frameRate);
    }

    // Physics 초기화
    physics = new Physics(p.width, p.height);

    // 물고기 생성 (화면 전체에 랜덤 배치)
    for (let i = 0; i < quality.fishCount; i++) {
      const x = p.random(100, p.width - 100);
      const y = p.random(100, p.height - 100);
      fishes.push(new Fish(x, y));
    }

    p.background(255);

    // 잔상 레이어 생성 (투명 버퍼)
    trailLayer = p.createGraphics(p.width, p.height);
    trailLayer.clear();

    // FPS DOM 엘리먼트 생성
    fpsDiv = document.createElement("div");
    fpsDiv.style.cssText =
      "position:fixed;top:10px;left:10px;font:12px monospace;color:rgba(0,0,0,0.6);pointer-events:none;z-index:1000;";
    document.body.appendChild(fpsDiv);
  };

  p.draw = () => {
    // 시간 업데이트
    time += 0.01;

    // 1) 잔상 레이어 페이드: 반투명 흰색으로 이전 프레임 흔적을 서서히 지움
    const tCtx = trailLayer.drawingContext as CanvasRenderingContext2D;
    tCtx.fillStyle = "rgba(255, 255, 255, 0.04)";
    tCtx.fillRect(0, 0, p.width, p.height);

    // 2) 물고기를 잔상 레이어에 그림
    for (const fish of fishes) {
      fish.update(physics, time);
      fish.display(quality, trailLayer);
    }

    // 3) 메인 캔버스: 깨끗한 배경 + 잔상 레이어 합성
    p.background(255);
    p.image(trailLayer, 0, 0);

    // FPS 표시 (개발용)
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
    // 매 10프레임마다만 FPS 텍스트 갱신
    if (p.frameCount % 10 === 0 && fpsDiv) {
      const fps = p.frameRate().toFixed(0);
      fpsDiv.textContent = `FPS: ${fps} | 물고기: ${fishes.length} | 클릭하여 물고기 추가`;
    }
  };

  p.mousePressed = () => {
    // 마우스 클릭 시 물고기 추가
    if (
      p.mouseX >= 0 &&
      p.mouseX <= p.width &&
      p.mouseY >= 0 &&
      p.mouseY <= p.height
    ) {
      fishes.push(new Fish(p.mouseX, p.mouseY));
    }
  };
};

new p5(sketch);
