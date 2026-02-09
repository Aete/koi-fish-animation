import "./types/p5.brush.d.ts";
import { Fish } from "./agent/Fish";
import { Physics } from "./world/Physics";
import { isMobile, DESKTOP_QUALITY, MOBILE_QUALITY } from "./types/QualitySettings";
import type { QualitySettings } from "./types/QualitySettings";
import p5 from "p5";

const sketch = (p: p5) => {
  let fishes: Fish[] = [];
  let physics: Physics;
  let time = 0;
  const quality: QualitySettings = isMobile() ? MOBILE_QUALITY : DESKTOP_QUALITY;
  let paperTexture: p5.Graphics; // 한지 질감 레이어
  let trailLayer: p5.Graphics;  // 잔상(먹 번짐) 버퍼

  // FPS DOM 엘리먼트
  let fpsDiv: HTMLDivElement;

  // p5를 전역에 설정 (Fish 클래스가 사용할 수 있도록)
  (window as any).p5Instance = p;

  p.setup = () => {
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

    // 배경 설정 (한지 느낌)
    p.background(255, 255, 255);

    // 한지 질감 생성
    createPaperTexture();
    p.image(paperTexture, 0, 0);

    // 잔상 레이어 생성 (투명 버퍼)
    trailLayer = p.createGraphics(p.width, p.height);
    trailLayer.clear();

    // FPS DOM 엘리먼트 생성
    fpsDiv = document.createElement("div");
    fpsDiv.style.cssText =
      "position:fixed;top:10px;left:10px;font:12px monospace;color:rgba(0,0,0,0.6);pointer-events:none;z-index:1000;";
    document.body.appendChild(fpsDiv);
  };

  // 한지 질감 생성 함수 (최적화 버전)
  const createPaperTexture = () => {
    paperTexture = p.createGraphics(p.width, p.height);
    const noiseScale = 0.015;
    const backR = 255,
      backG = 255,
      backB = 255;

    // 베이스 배경색 먼저 채우기
    paperTexture.background(backR, backG, backB);

    // 최적화: noiseDetail 옥타브 감소 (10→6으로 40% 빠름)
    p.noiseDetail(6, 0.7);
    const scaledNoise = noiseScale * (p.width / 700);

    // 성능 최적화: 픽셀을 건너뛰며 샘플링 (stride)
    const stride = 3; // 3픽셀마다 샘플링 (9배 빠름)

    // 첫 번째 레이어: 어두운 톤의 질감 (RGB 값도 변화)
    for (let y = 0; y < p.height; y += stride) {
      for (let x = 0; x < p.width; x += stride) {
        const n = p.noise((x * scaledNoise) / 3, y * scaledNoise);
        const colorVar = p.map(n, 0, 1, -35, 35);
        paperTexture.stroke(
          backR + colorVar,
          backG + colorVar,
          backB + colorVar,
          n * 200,
        );
        paperTexture.strokeWeight(stride); // strokeWeight를 stride에 맞게 조정
        paperTexture.point(x, y);
      }
    }

    // 두 번째 레이어: 밝은 하이라이트
    for (let y = 0; y < p.height; y += stride) {
      for (let x = 0; x < p.width; x += stride) {
        const n = p.constrain(
          p.noise((x * scaledNoise) / 3, y * scaledNoise),
          0,
          1.6,
        );
        paperTexture.stroke(255, 255, 250, n * 180);
        paperTexture.strokeWeight(stride);
        paperTexture.point(x - 1, y - 2);
      }
    }

    // 세 번째 레이어: 미세한 점들 (한지 섬유 느낌) - 개수 70% 감소
    const fiberCount = Math.floor(p.width * p.height * 0.015);
    for (let i = 0; i < fiberCount; i++) {
      const x = p.random(p.width);
      const y = p.random(p.height);
      const n = p.noise(x * scaledNoise, y * scaledNoise);
      paperTexture.stroke(200, 195, 185, n * 120);
      paperTexture.strokeWeight(p.random(0.5, 2.5));
      paperTexture.point(x, y);
    }
  };

  p.draw = () => {
    // 시간 업데이트
    time += 0.01;

    // 1) 잔상 레이어 페이드: 반투명 흰색으로 이전 프레임 흔적을 서서히 지움
    const tCtx = trailLayer.drawingContext as CanvasRenderingContext2D;
    tCtx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    tCtx.fillRect(0, 0, p.width, p.height);

    // 2) 물고기를 잔상 레이어에 그림
    for (const fish of fishes) {
      fish.update(physics, time);
      fish.display(quality, trailLayer);
    }

    // 3) 메인 캔버스: 깨끗한 배경 + 한지 질감 + 잔상 레이어 합성
    p.background(255);
    p.image(paperTexture, 0, 0);
    p.image(trailLayer, 0, 0);

    // FPS 표시 (개발용)
    displayInfo();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    physics.updateDimensions(p.width, p.height);
    createPaperTexture();
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

  p.keyPressed = () => {
    // 'C' 키: 물고기 전체 삭제
    if (p.key === "c" || p.key === "C") {
      fishes = [];
    }

    // 'R' 키: 리셋
    if (p.key === "r" || p.key === "R") {
      fishes = [];
      for (let i = 0; i < quality.fishCount; i++) {
        const x = p.random(p.width);
        const y = p.random(p.height);
        fishes.push(new Fish(x, y));
      }
      createPaperTexture();
      trailLayer.clear();
    }

    // 스페이스바: 배경 지우기
    if (p.key === " ") {
      trailLayer.clear();
    }
  };
};

new p5(sketch);
