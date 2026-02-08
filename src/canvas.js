import { createRng } from './seed.js';

const COLORS = {
  cyan: 'oklch(0.78 0.15 195)',
  cyanDim: 'oklch(0.78 0.15 195 / 0.4)',
  magenta: 'oklch(0.65 0.20 330)',
  gray: 'oklch(0.25 0.02 270)',
  grayDim: 'oklch(0.15 0.02 270)',
  bg: 'oklch(0.08 0.03 270)',
  text: 'oklch(0.93 0.01 270)',
  muted: 'oklch(0.45 0.02 270)',
};

const CANVAS_W = 840;
const CANVAS_H = 588;

export function createPuzzleCanvas(container) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.borderRadius = '8px';
  container.appendChild(canvas);
  return canvas;
}

export function generateRound(canvas, roundType, seed) {
  const ctx = canvas.getContext('2d');
  const rng = createRng(seed);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  switch (roundType) {
    case 'count':        return generateCount(ctx, rng, false);
    case 'proportion':   return generateProportion(ctx, rng);
    case 'comparison':   return generateComparison(ctx, rng);
    case 'density':      return generateDensity(ctx, rng);
    case 'countExtreme': return generateCount(ctx, rng, true);
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

function generateCount(ctx, rng, extreme) {
  const count = extreme
    ? Math.round(200 + rng() * 300)
    : Math.round(30 + rng() * 50);

  const minRadius = extreme ? 2 : 4;
  const maxRadius = extreme ? 10 : 8;
  const margin = 20;

  for (let i = 0; i < count; i++) {
    const x = margin + rng() * (CANVAS_W - margin * 2);
    const y = margin + rng() * (CANVAS_H - margin * 2);
    const r = minRadius + rng() * (maxRadius - minRadius);
    const color = rng() > 0.85 ? COLORS.magenta : COLORS.cyan;
    drawParticle(ctx, x, y, r, color);
  }

  if (extreme) {
    ctx.fillStyle = 'oklch(0 0 0 / 0.08)';
    for (let y = 0; y < CANVAS_H; y += 4) {
      ctx.fillRect(0, y, CANVAS_W, 2);
    }
  }

  return count;
}

function generateProportion(ctx, rng) {
  const totalCount = Math.round(120 + rng() * 80);
  const activePct = 25 + rng() * 50;
  const activeCount = Math.round(totalCount * activePct / 100);
  const inactiveCount = totalCount - activeCount;
  const margin = 20;

  for (let i = 0; i < inactiveCount; i++) {
    const x = margin + rng() * (CANVAS_W - margin * 2);
    const y = margin + rng() * (CANVAS_H - margin * 2);
    const r = 4 + rng() * 4;
    drawParticle(ctx, x, y, r, COLORS.gray);
  }

  for (let i = 0; i < activeCount; i++) {
    const x = margin + rng() * (CANVAS_W - margin * 2);
    const y = margin + rng() * (CANVAS_H - margin * 2);
    const r = 4 + rng() * 4;
    drawParticle(ctx, x, y, r, COLORS.cyan);
  }

  return Math.round(activePct);
}

function generateComparison(ctx, rng) {
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
  ctx.fillStyle = COLORS.muted;
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
    drawParticle(ctx, x, y, r, COLORS.cyan);
  }

  for (let i = 0; i < countB; i++) {
    const x = midX + margin + rng() * (midX - margin * 2);
    const y = 40 + rng() * (CANVAS_H - 60);
    const r = 3 + rng() * 4;
    drawParticle(ctx, x, y, r, COLORS.cyan);
  }

  return diff;
}

function generateDensity(ctx, rng) {
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
    const color = rng() > 0.9 ? COLORS.magenta : COLORS.cyan;
    drawParticle(ctx, p.x, p.y, p.r, color);
  }

  ctx.strokeStyle = 'oklch(0.3 0.02 270)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(midX, 0); ctx.lineTo(midX, CANVAS_H);
  ctx.moveTo(0, midY); ctx.lineTo(CANVAS_W, midY);
  ctx.stroke();

  const tq = quadrantBounds[targetQ];
  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 3;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 10;
  ctx.strokeRect(tq.x1 + 2, tq.y1 + 2, tq.x2 - tq.x1 - 4, tq.y2 - tq.y1 - 4);
  ctx.shadowBlur = 0;

  return targetCount;
}

export { CANVAS_W, CANVAS_H };
