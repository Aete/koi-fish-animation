export interface QualitySettings {
  fishCount: number;
  subdivisions: number;
  stripeSpacing: number; // multiplier (1.0 = default)
  stepSize: number; // multiplier (1.0 = default)
  spotStep: number; // multiplier (1.0 = default)
  frameRate: number; // 0 = unlimited
}

export const DESKTOP_QUALITY: QualitySettings = {
  fishCount: 8,
  subdivisions: 4,
  stripeSpacing: 1.0,
  stepSize: 1.0,
  spotStep: 1.0,
  frameRate: 60,
};

export const MOBILE_QUALITY: QualitySettings = {
  fishCount: 4,
  subdivisions: 2,
  stripeSpacing: 1.0,
  stepSize: 1.0,
  spotStep: 1.0,
  frameRate: 30,
};

export function isMobile(): boolean {
  const ua = navigator.userAgent || '';
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const smallScreen = window.innerWidth <= 768;
  return mobileUA || (hasTouch && smallScreen);
}
