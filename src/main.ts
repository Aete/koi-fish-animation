import "./types/p5.brush.d.ts";
import { Fish } from "./agent/Fish";
import { Physics } from "./world/Physics";
import p5 from "p5";

const sketch = (p: p5) => {
  let fishes: Fish[] = [];
  let physics: Physics;
  let time = 0;
  const FISH_COUNT = 8; // 여러 마리 표시
  let paperTexture: p5.Graphics; // 한지 질감 레이어

  // p5를 전역에 설정 (Fish 클래스가 사용할 수 있도록)
  (window as any).p5Instance = p;

  p.setup = () => {
    const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
    canvas.parent("app");

    // Physics 초기화
    physics = new Physics(p.width, p.height);

    // 물고기 생성 (화면 전체에 랜덤 배치)
    for (let i = 0; i < FISH_COUNT; i++) {
      const x = p.random(100, p.width - 100);
      const y = p.random(100, p.height - 100);
      fishes.push(new Fish(x, y));
    }

    // 배경 설정 (한지 느낌)
    p.background(255, 255, 255);

    // 한지 질감 생성
    createPaperTexture();

    // 자동 루프 활성화 (마우스 따라가기)
    // p.noLoop();
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
          n * 200
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
          1.6
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
    // 한지 질감 배경 표시
    p.image(paperTexture, 0, 0);

    // 반투명 레이어로 잔상 효과 (먹이 번지는 느낌) - 투명도 더 낮춤
    p.fill(250, 247, 240, 20);
    p.noStroke();
    p.rect(0, 0, p.width, p.height);

    // 시간 업데이트
    time += 0.01;

    // 물고기 업데이트 및 렌더링
    for (const fish of fishes) {
      fish.update(physics, time);
      fish.display();
    }

    // FPS 표시 (개발용)
    displayInfo();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    physics.updateDimensions(p.width, p.height);
    createPaperTexture(); // 화면 크기 변경 시 질감 다시 생성
  };

  const displayInfo = (): void => {
    p.fill(0, 150);
    p.noStroke();
    p.textSize(12);
    p.textAlign(p.LEFT, p.TOP);
    p.text(`FPS: ${p.frameRate().toFixed(0)}`, 10, 10);
    p.text(`물고기: ${fishes.length}`, 10, 25);
    p.text(`클릭하여 물고기 추가`, 10, 40);
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
      for (let i = 0; i < FISH_COUNT; i++) {
        const x = p.random(p.width);
        const y = p.random(p.height);
        fishes.push(new Fish(x, y));
      }
      p.background(250, 247, 240);
      createPaperTexture(); // 질감 다시 생성
    }

    // 스페이스바: 배경 지우기
    if (p.key === " ") {
      p.background(250, 247, 240);
      createPaperTexture(); // 질감 다시 생성
    }
  };
};

new p5(sketch);
