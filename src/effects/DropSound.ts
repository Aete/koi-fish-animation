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
  // Slightly lower pitch (playbackRate < 1 = pitch down)
  source.playbackRate.value = 2;

  // Trim short: fade out then stop
  const gain = ctx.createGain();
  const duration = 0.3;
  gain.gain.setValueAtTime(1, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + duration);
}
