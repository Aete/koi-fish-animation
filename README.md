# 🐟 연못 속 물고기 (Fish Pond Art)

p5.js와 p5.brush를 활용한 수묵화/수채화 느낌의 미디어 아트 작품입니다.

## 프로젝트 구조

```
fish-claude/
├── src/
│   ├── agent/          # Agent: 물고기, 생물체
│   │   └── Fish.ts     # 물고기 클래스
│   ├── world/          # World: 물리 법칙
│   │   └── Physics.ts  # 물리 엔진
│   ├── material/       # Material: 물질 특성
│   │   └── Water.ts    # 물의 특성
│   ├── types/          # TypeScript 타입 정의
│   │   └── p5.brush.d.ts
│   └── main.ts         # 메인 시뮬레이션
├── index.html
├── package.json
└── tsconfig.json
```

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

## 조작법

- **마우스 클릭**: 클릭한 위치에 물고기 추가
- **R 키**: 리셋 (초기 상태로)
- **C 키**: 모든 물고기 삭제
- **스페이스바**: 배경 지우기

## 구현 내용

### 1. Agent (물고기)
- Autonomous agent로 자율적인 움직임
- Wander 행동으로 자연스러운 배회
- p5.brush를 활용한 수묵화 스타일 렌더링

### 2. World (물리 법칙)
- 화면 경계에서 wraparound (반대편 출현)
- 물의 저항력 적용
- 유체 흐름 시뮬레이션

### 3. Material (물의 특성)
- 밀도, 점성, 항력 계수
- Perlin noise 기반 물의 흐름
- 유체 역학 시뮬레이션

## 기술 스택

- **Vite**: 빠른 개발 환경
- **TypeScript**: 타입 안정성
- **p5.js**: 크리에이티브 코딩 라이브러리
- **p5.brush**: 수묵화/수채화 효과

## 특징

- 수묵화/수채화 느낌의 브러시 렌더링
- 자연스러운 물고기 움직임
- 물의 물리적 특성 시뮬레이션
- 반응형 캔버스 (화면 크기 조절 대응)
- 잔상 효과로 먹이 번지는 느낌 구현
