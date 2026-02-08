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

function modulateColorChroma(oklchStr, scale) {
  const m = oklchStr.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
  if (!m) return oklchStr;
  const l = parseFloat(m[1]);
  const c = parseFloat(m[2]) * scale;
  const h = parseFloat(m[3]);
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  return `oklch(${l} ${c.toFixed(4)} ${h} / ${a})`;
}

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
    case 'depth':        return generateDepth(ctx, rng, colors);
    case 'tunnel':       return generateTunnel(ctx, rng, colors);
    case 'cluster3d':    return generateCluster3d(ctx, rng, colors);
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

// --- Depth: Layered Depth Field ---
function generateDepth(ctx, rng, colors) {
  const layerCount = 3 + Math.floor(rng() * 2); // 3 or 4 layers
  const targetLayer = Math.floor(rng() * layerCount);
  const layerH = CANVAS_H / layerCount;

  // Draw atmospheric gradient bands between layers
  for (let i = 0; i < layerCount; i++) {
    const depthT = i / (layerCount - 1); // 0 = far, 1 = near
    const y0 = i * layerH;
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + layerH);
    const alpha = 0.03 + depthT * 0.06;
    grad.addColorStop(0, `oklch(0.3 0.02 270 / ${alpha})`);
    grad.addColorStop(1, `oklch(0.3 0.02 270 / ${alpha * 0.5})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, CANVAS_W, layerH);
  }

  // Depth labels on left edge
  ctx.font = '700 14px Inter, system-ui';
  ctx.textAlign = 'left';
  for (let i = 0; i < layerCount; i++) {
    const y = i * layerH + layerH / 2;
    ctx.fillStyle = i === targetLayer ? colors.primary : colors.muted;
    ctx.globalAlpha = i === targetLayer ? 1 : 0.4;
    ctx.fillText(`D${i + 1}`, 8, y + 5);
  }
  ctx.globalAlpha = 1;

  // Highlight target layer with glowing side bars
  const targetY = targetLayer * layerH;
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 3;
  ctx.shadowColor = colors.primary;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(0, targetY + 2);
  ctx.lineTo(0, targetY + layerH - 2);
  ctx.moveTo(CANVAS_W, targetY + 2);
  ctx.lineTo(CANVAS_W, targetY + layerH - 2);
  ctx.stroke();
  // Horizontal boundary lines for target
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, targetY);
  ctx.lineTo(CANVAS_W, targetY);
  ctx.moveTo(0, targetY + layerH);
  ctx.lineTo(CANVAS_W, targetY + layerH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  // Generate particles across all layers
  const totalCount = Math.round(120 + rng() * 200);
  let targetCount = 0;
  const margin = 30;

  for (let i = 0; i < totalCount; i++) {
    const layer = Math.floor(rng() * layerCount);
    const depthT = layer / (layerCount - 1); // 0=far, 1=near
    const y0 = layer * layerH;

    const x = margin + rng() * (CANVAS_W - margin * 2);
    const y = y0 + 10 + rng() * (layerH - 20);

    // Size scales with depth: far=small, near=large
    const r = 2 + depthT * 6 + rng() * 2;
    // Alpha scales with depth
    const alpha = 0.3 + depthT * 0.7;
    // Chroma scales with depth
    const chromaScale = 0.3 + depthT * 0.7;

    const baseColor = rng() > 0.85 ? colors.secondary : colors.primary;
    const color = modulateColorChroma(baseColor, chromaScale);

    ctx.globalAlpha = alpha;
    drawParticle(ctx, x, y, r, color);

    if (layer === targetLayer) targetCount++;
  }
  ctx.globalAlpha = 1;

  return targetCount;
}

// --- Tunnel: Perspective Tunnel ---
function generateTunnel(ctx, rng, colors) {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const maxRadius = Math.min(CANVAS_W, CANVAS_H) / 2 - 20;
  const ringCount = 4;
  const ringBoundaries = [];
  for (let i = 0; i <= ringCount; i++) {
    ringBoundaries.push((i / ringCount) * maxRadius);
  }
  const targetRing = ringCount - 1; // outer ring

  // Draw radial spoke lines (16 spokes)
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.3;
  for (let s = 0; s < 16; s++) {
    const angle = (s / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * maxRadius, cy + Math.sin(angle) * maxRadius);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Draw concentric ring boundaries
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.25;
  for (let i = 1; i < ringCount; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, ringBoundaries[i], 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Outer boundary
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Glowing vanishing point
  const vpGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
  vpGrad.addColorStop(0, colors.primary);
  vpGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = vpGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();

  // Highlight target ring (outer) with bright arc
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 3;
  ctx.shadowColor = colors.primary;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, ringBoundaries[targetRing], 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // "OUTER" label
  ctx.font = '700 14px Inter, system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = colors.primary;
  const labelR = (ringBoundaries[targetRing] + maxRadius) / 2;
  ctx.fillText('OUTER', cx + labelR * 0.7, cy - labelR * 0.7);

  // Generate particles in rings
  const totalCount = Math.round(80 + rng() * 120);
  let targetCount = 0;

  for (let i = 0; i < totalCount; i++) {
    const ring = Math.floor(rng() * ringCount);
    const rInner = ringBoundaries[ring];
    const rOuter = ringBoundaries[ring + 1];
    // Random position within ring
    const angle = rng() * Math.PI * 2;
    const dist = rInner + rng() * (rOuter - rInner);

    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;

    // Depth: inner=far (small/dim), outer=near (large/bright)
    const depthT = ring / (ringCount - 1);
    const r = 2 + depthT * 5 + rng() * 2;
    const alpha = 0.3 + depthT * 0.7;
    const chromaScale = 0.3 + depthT * 0.7;

    const baseColor = rng() > 0.85 ? colors.secondary : colors.primary;
    const color = modulateColorChroma(baseColor, chromaScale);

    ctx.globalAlpha = alpha;
    drawParticle(ctx, x, y, r, color);

    if (ring === targetRing) targetCount++;
  }
  ctx.globalAlpha = 1;

  return targetCount;
}

// --- Cluster3d: 3D Sphere Projection ---
function generateCluster3d(ctx, rng, colors) {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const sphereRadius = Math.min(CANVAS_W, CANVAS_H) / 2 - 40;

  // Faint sphere outline
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.arc(cx, cy, sphereRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Dashed equator line
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.35;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(cx - sphereRadius, cy);
  ctx.lineTo(cx + sphereRadius, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // NEAR/FAR labels
  ctx.font = '700 14px Inter, system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = colors.primary;
  ctx.fillText('NEAR', cx, cy + sphereRadius + 20);
  ctx.fillStyle = colors.muted;
  ctx.globalAlpha = 0.5;
  ctx.fillText('FAR', cx, cy - sphereRadius - 10);
  ctx.globalAlpha = 1;

  // Generate Fibonacci sphere points
  const totalCount = Math.round(80 + rng() * 150);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const particles = [];
  let nearCount = 0;

  for (let i = 0; i < totalCount; i++) {
    // Fibonacci sphere distribution with some randomness
    const t = i / totalCount;
    const inclination = Math.acos(1 - 2 * t);
    const azimuth = goldenAngle * i + rng() * 0.3;

    // 3D coordinates on unit sphere
    const sx = Math.sin(inclination) * Math.cos(azimuth);
    const sy = Math.sin(inclination) * Math.sin(azimuth);
    const sz = Math.cos(inclination); // -1=top(far) to 1=bottom(near)

    // Perspective projection (sz > 0 = near/front)
    const perspectiveScale = 0.6 + 0.4 * (sz * 0.5 + 0.5); // near = larger projection
    const px = cx + sx * sphereRadius * perspectiveScale * 0.85;
    const py = cy + sy * sphereRadius * perspectiveScale * 0.85;

    // Depth: sz > 0 = front/near hemisphere
    const isNear = sz > 0;
    const depthT = sz * 0.5 + 0.5; // 0=far(back), 1=near(front)

    const r = 2 + depthT * 6 + rng() * 1.5;
    const alpha = 0.2 + depthT * 0.8;
    const chromaScale = 0.2 + depthT * 0.8;

    const baseColor = rng() > 0.85 ? colors.secondary : colors.primary;
    const color = modulateColorChroma(baseColor, chromaScale);

    particles.push({ px, py, r, alpha, color, depthT, isNear });
    if (isNear) nearCount++;
  }

  // Depth-sorted rendering: back particles first
  particles.sort((a, b) => a.depthT - b.depthT);

  for (const p of particles) {
    ctx.globalAlpha = p.alpha;
    drawParticle(ctx, p.px, p.py, p.r, p.color);
  }
  ctx.globalAlpha = 1;

  return nearCount;
}

export { CANVAS_W, CANVAS_H };
