import { generateRound, CANVAS_W, CANVAS_H } from './canvas.js';
import { hashDateString } from './seed.js';
import { getCtx } from './audio.js';
import { ROUND_TYPES } from './game.js';
import { getTheme } from './themes.js';

const TYPE_LABELS = {
  count: 'SIGNAL COUNT',
  proportion: 'FIELD ACTIVITY',
  comparison: 'SECTOR COMPARE',
  density: 'QUADRANT DENSITY',
  countExtreme: 'MASS INTERCEPT',
};

let rafId = null;
let droneNodes = null;

export function startIntro(canvas, themeId) {
  const ctx = canvas.getContext('2d');
  const theme = getTheme(themeId);

  // Pre-render snapshots on offscreen canvases with randomised seeds
  const snapshots = ROUND_TYPES.map((type) => {
    const off = document.createElement('canvas');
    off.width = CANVAS_W;
    off.height = CANVAS_H;
    const seed = hashDateString('demo_' + type + '_' + Date.now());
    generateRound(off, type, seed, themeId);
    return { canvas: off, label: TYPE_LABELS[type] || type };
  });

  const DISPLAY_MS = 2000;
  const FADE_MS = 600;
  const CYCLE_MS = DISPLAY_MS + FADE_MS;
  let startTime = performance.now();

  function frame(now) {
    const elapsed = now - startTime;
    const totalCycle = snapshots.length * CYCLE_MS;
    const pos = elapsed % totalCycle;
    const idx = Math.floor(pos / CYCLE_MS);
    const inCycle = pos - idx * CYCLE_MS;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Current snapshot
    const cur = snapshots[idx];
    if (inCycle < DISPLAY_MS) {
      ctx.globalAlpha = 1;
      ctx.drawImage(cur.canvas, 0, 0);
    } else {
      // Crossfade
      const fadeT = (inCycle - DISPLAY_MS) / FADE_MS;
      const nextIdx = (idx + 1) % snapshots.length;
      ctx.globalAlpha = 1 - fadeT;
      ctx.drawImage(cur.canvas, 0, 0);
      ctx.globalAlpha = fadeT;
      ctx.drawImage(snapshots[nextIdx].canvas, 0, 0);
    }

    ctx.globalAlpha = 1;

    // Type label
    const activeIdx = inCycle < DISPLAY_MS ? idx : (idx + 1) % snapshots.length;
    const label = snapshots[activeIdx].label;
    ctx.font = '700 14px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.8;
    ctx.fillText(label, CANVAS_W / 2, CANVAS_H - 28);

    // Pagination dots
    const dotR = 4;
    const gap = 16;
    const dotsW = (snapshots.length - 1) * gap;
    const dotsX = CANVAS_W / 2 - dotsW / 2;
    const dotsY = CANVAS_H - 12;
    for (let i = 0; i < snapshots.length; i++) {
      ctx.beginPath();
      ctx.arc(dotsX + i * gap, dotsY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i === activeIdx ? theme.primary : theme.dim;
      ctx.globalAlpha = i === activeIdx ? 1 : 0.5;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  // Music starts on first user interaction
  const startMusic = () => {
    document.removeEventListener('pointerdown', startMusic);
    document.removeEventListener('keydown', startMusic);
    droneNodes = createDrone();
  };
  document.addEventListener('pointerdown', startMusic, { once: false });
  document.addEventListener('keydown', startMusic, { once: false });
  // Store refs so stop() can clean up
  startIntro._musicListeners = startMusic;
}

function createDrone() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 2.5);
  master.connect(ctx.destination);

  // Bass A1 55Hz
  const bass = ctx.createOscillator();
  bass.type = 'sine';
  bass.frequency.value = 55;
  const bassGain = ctx.createGain();
  bassGain.gain.value = 0.5;
  bass.connect(bassGain).connect(master);
  bass.start();

  // Detuned A3 pad pair
  const pad1 = ctx.createOscillator();
  pad1.type = 'triangle';
  pad1.frequency.value = 220;
  pad1.detune.value = -8;
  const pad2 = ctx.createOscillator();
  pad2.type = 'triangle';
  pad2.frequency.value = 220;
  pad2.detune.value = 8;
  const padGain = ctx.createGain();
  padGain.gain.value = 0.3;
  pad1.connect(padGain);
  pad2.connect(padGain);
  padGain.connect(master);
  pad1.start();
  pad2.start();

  // E5 shimmer with tremolo
  const shimmer = ctx.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.value = 659.25;
  const shimGain = ctx.createGain();
  shimGain.gain.value = 0.15;
  const trem = ctx.createOscillator();
  trem.type = 'sine';
  trem.frequency.value = 3;
  const tremGain = ctx.createGain();
  tremGain.gain.value = 0.08;
  trem.connect(tremGain);
  tremGain.connect(shimGain.gain);
  shimmer.connect(shimGain).connect(master);
  shimmer.start();
  trem.start();

  return { master, oscs: [bass, pad1, pad2, shimmer, trem], ctx };
}

export function stopIntro() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Remove music listeners if music never started
  if (startIntro._musicListeners) {
    document.removeEventListener('pointerdown', startIntro._musicListeners);
    document.removeEventListener('keydown', startIntro._musicListeners);
    startIntro._musicListeners = null;
  }

  if (droneNodes) {
    const { master, oscs, ctx } = droneNodes;
    const now = ctx.currentTime;
    master.gain.linearRampToValueAtTime(0, now + 0.8);
    setTimeout(() => {
      oscs.forEach(o => { try { o.stop(); } catch (_) {} });
    }, 900);
    droneNodes = null;
  }
}
