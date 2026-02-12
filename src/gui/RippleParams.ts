export const RippleParams = {
  // 파동
  speed: 2,             // 확장 속도 (px/frame)
  amplitude: 8,         // 왜곡 세기 (px)
  waveWidth: 50,        // 파동 폭 (px)
  maxRadius: 200,       // 최대 반경 (px)

  // 시각
  ringCount: 4,         // 동심원 개수
  ringGap: 30,          // 동심원 간격 (px)
  lineWidth: 8,         // 선 두께
  strokeColor: '#847d75', // 동심원 선 색
  strokeAlpha: 0.055,     // 선 투명도
  fillColor: '#ffffff',   // 동심원 면 색
  fillAlpha: 0,           // 면 투명도

  // 도망
  scatterStrength: 6.5, // 도망 힘 세기
  scatterRange: 775,    // 도망 최대 거리 (px)
  scatterWindow: 0.35,  // 도망 활성 구간 (0~1)
};
