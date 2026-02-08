let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function initAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}

function playTone(freq, duration, type = 'sine', volume = 0.15) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export function playLockIn() {
  playTone(600, 0.1, 'sine', 0.12);
  setTimeout(() => playTone(800, 0.1, 'sine', 0.1), 60);
}

export function playExact() {
  playTone(880, 0.15, 'sine', 0.15);
  setTimeout(() => playTone(1100, 0.15, 'sine', 0.12), 100);
  setTimeout(() => playTone(1320, 0.2, 'sine', 0.1), 200);
}

export function playClose() {
  playTone(660, 0.15, 'sine', 0.12);
  setTimeout(() => playTone(880, 0.15, 'sine', 0.1), 100);
}

export function playWarm() {
  playTone(440, 0.2, 'triangle', 0.1);
}

export function playCool() {
  playTone(330, 0.2, 'triangle', 0.1);
  setTimeout(() => playTone(260, 0.15, 'triangle', 0.08), 100);
}

export function playMiss() {
  playTone(200, 0.3, 'sawtooth', 0.08);
  setTimeout(() => playTone(150, 0.3, 'sawtooth', 0.06), 100);
}

export function playForTier(tier) {
  switch (tier.label) {
    case 'EXACT': playExact(); break;
    case 'CLOSE': playClose(); break;
    case 'WARM':  playWarm(); break;
    case 'COOL':  playCool(); break;
    case 'COLD':  playCool(); break;
    case 'MISS':  playMiss(); break;
  }
}

export function playShare() {
  playTone(523, 0.1, 'sine', 0.1);
  setTimeout(() => playTone(659, 0.1, 'sine', 0.08), 80);
  setTimeout(() => playTone(784, 0.15, 'sine', 0.06), 160);
}
