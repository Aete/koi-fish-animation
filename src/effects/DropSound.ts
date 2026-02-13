import waterBubbleUrl from './water_bubble.wav';

let audioCtx: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

async function loadBuffer(): Promise<void> {
  const ctx = getAudioContext();
  const res = await fetch(waterBubbleUrl);
  const arrayBuf = await res.arrayBuffer();
  audioBuffer = await ctx.decodeAudioData(arrayBuf);
}

export function playDropSound(): void {
  const ctx = getAudioContext();
  if (!audioBuffer) {
    loadBuffer().then(() => playDropSound());
    return;
  }

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  // 주파수를 약간 낮춤 (playbackRate < 1 → 피치 다운)
  source.playbackRate.value = 2;

  // 짧게 자르기: 페이드아웃 후 정지
  const gain = ctx.createGain();
  const duration = 0.3;
  gain.gain.setValueAtTime(1, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + duration);
}
