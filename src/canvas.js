import { createRng } from './seed.js';
import { getTheme, getSavedThemeId } from './themes.js';

function getColors(theme) {
  return {
    primary: theme.primary,
    secondary: theme.secondary,
    dim: theme.dim,
    bg: theme.bg,
    muted: 'oklch(0.55 0.02 270)',
  };
}

const CANVAS_W = 840;
const CANVAS_H = 588;

export function createPuzzleCanvas(container) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.overflow = 'hidden';
  container.appendChild(canvas);
  return canvas;
}

export function generateRound(canvas, roundType, seed, themeId) {
  const ctx = canvas.getContext('2d');
  const rng = createRng(seed);
  const theme = getTheme(themeId || getSavedThemeId());
  const colors = getColors(theme);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  switch (roundType) {
    case 'count':        return generateCount(ctx, rng, false, colors);
    case 'proportion':   return generateProportion(ctx, rng, colors);
    case 'comparison':   return generateComparison(ctx, rng, colors);
    case 'density':      return generateDensity(ctx, rng, colors);
    case 'countExtreme': return generateCount(ctx, rng, true, colors);
    default:             return 0;
  }
}

function drawParticle(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.4, color);
  gradient.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function generateCount(ctx, rng, extreme, colors) {
  const count = extreme
    ? Math.round(200 + rng() * 350)    // 200-550
    : Math.round(40 + rng() * 50);     // 40-90

  // Smaller particles + high size variance = harder to count
  const minRadius = extreme ? 1.5 : 2.5;
  const maxRadius = extreme ? 8 : 7;
  const margin = 15;

  // Add 2-3 dense clusters to confuse counting
  const clusterCount = 2 + Math.floor(rng() * 2);
  const clusters = [];
  for (let c = 0; c < clusterCount; c++) {
    clusters.push({
      x: margin + rng() * (CANVAS_W - margin * 2),
      y: margin + rng() * (CANVAS_H - margin * 2),
      radius: 60 + rng() * 80,
    });
  }

  for (let i = 0; i < count; i++) {
    let x, y;
    // 40% of particles cluster together
    if (rng() < 0.4 && clusters.length > 0) {
      const cl = clusters[Math.floor(rng() * clusters.length)];
      const angle = rng() * Math.PI * 2;
      const dist = rng() * cl.radius;
      x = cl.x + Math.cos(angle) * dist;
      y = cl.y + Math.sin(angle) * dist;
    } else {
      x = margin + rng() * (CANVAS_W - margin * 2);
      y = margin + rng() * (CANVAS_H - margin * 2);
    }
    const r = minRadius + rng() * (maxRadius - minRadius);
    const color = rng() > 0.8 ? colors.secondary : colors.primary;
    drawParticle(ctx, x, y, r, color);
  }

  // Scanline overlay for extra difficulty
  if (extreme) {
    ctx.fillStyle = 'oklch(0 0 0 / 0.1)';
    for (let y = 0; y < CANVAS_H; y += 3) {
      ctx.fillRect(0, y, CANVAS_W, 1.5);
    }
  }

  return count;
}

function generateProportion(ctx, rng, colors) {
  const totalCount = Math.round(120 + rng() * 80);
  const activePct = 25 + rng() * 50;
  const activeCount = Math.round(totalCount * activePct / 100);
  const inactiveCount = totalCount - activeCount;
  const margin = 20;

  for (let i = 0; i < inactiveCount; i++) {
    const x = margin + rng() * (CANVAS_W - margin * 2);
    const y = margin + rng() * (CANVAS_H - margin * 2);
    const r = 4 + rng() * 4;
    drawParticle(ctx, x, y, r, colors.dim);
  }

  for (let i = 0; i < activeCount; i++) {
    const x = margin + rng() * (CANVAS_W - margin * 2);
    const y = margin + rng() * (CANVAS_H - margin * 2);
    const r = 4 + rng() * 4;
    drawParticle(ctx, x, y, r, colors.primary);
  }

  return Math.round(activePct);
}

function generateComparison(ctx, rng, colors) {
  const midX = CANVAS_W / 2;
  ctx.beginPath();
  ctx.moveTo(midX, 0);
  ctx.lineTo(midX, CANVAS_H);
  ctx.strokeStyle = 'oklch(0.25 0.02 270)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = '700 16px Inter, system-ui';
  ctx.fillStyle = colors.muted;
  ctx.textAlign = 'center';
  ctx.fillText('SECTOR A', midX / 2, 28);
  ctx.fillText('SECTOR B', midX + midX / 2, 28);

  const baseCount = Math.round(40 + rng() * 40);
  const diff = Math.round(8 + rng() * 32);
  const countA = baseCount;
  const countB = baseCount + diff;

  const margin = 30;

  for (let i = 0; i < countA; i++) {
    const x = margin + rng() * (midX - margin * 2);
    const y = 40 + rng() * (CANVAS_H - 60);
    const r = 6 + rng() * 8;
    drawParticle(ctx, x, y, r, colors.primary);
  }

  for (let i = 0; i < countB; i++) {
    const x = midX + margin + rng() * (midX - margin * 2);
    const y = 40 + rng() * (CANVAS_H - 60);
    const r = 3 + rng() * 4;
    drawParticle(ctx, x, y, r, colors.primary);
  }

  return diff;
}

function generateDensity(ctx, rng, colors) {
  const totalCount = Math.round(200 + rng() * 200);
  const margin = 20;

  const midX = CANVAS_W / 2;
  const midY = CANVAS_H / 2;

  const targetQ = Math.floor(rng() * 4);
  const quadrantBounds = [
    { x1: 0, y1: 0, x2: midX, y2: midY },
    { x1: midX, y1: 0, x2: CANVAS_W, y2: midY },
    { x1: 0, y1: midY, x2: midX, y2: CANVAS_H },
    { x1: midX, y1: midY, x2: CANVAS_W, y2: CANVAS_H },
  ];

  let targetCount = 0;
  const particles = [];

  for (let i = 0; i < totalCount; i++) {
    const x = margin + rng() * (CANVAS_W - margin * 2);
    const y = margin + rng() * (CANVAS_H - margin * 2);
    const r = 3 + rng() * 6;
    particles.push({ x, y, r });

    const tq = quadrantBounds[targetQ];
    if (x >= tq.x1 && x < tq.x2 && y >= tq.y1 && y < tq.y2) {
      targetCount++;
    }
  }

  for (const p of particles) {
    const color = rng() > 0.9 ? colors.secondary : colors.primary;
    drawParticle(ctx, p.x, p.y, p.r, color);
  }

  ctx.strokeStyle = 'oklch(0.3 0.02 270)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(midX, 0); ctx.lineTo(midX, CANVAS_H);
  ctx.moveTo(0, midY); ctx.lineTo(CANVAS_W, midY);
  ctx.stroke();

  const tq = quadrantBounds[targetQ];
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 3;
  ctx.shadowColor = colors.primary;
  ctx.shadowBlur = 10;
  ctx.strokeRect(tq.x1 + 2, tq.y1 + 2, tq.x2 - tq.x1 - 4, tq.y2 - tq.y1 - 4);
  ctx.shadowBlur = 0;

  return targetCount;
}

export { CANVAS_W, CANVAS_H };
