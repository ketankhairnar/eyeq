import { getTheme, getSavedThemeId } from './themes.js';

const TAU = Math.PI * 2;
// Horseshoe gauge: gap at bottom. Arc from 225deg (7 o'clock) counterclockwise to -45deg (5 o'clock)
// In canvas: 225deg = lower-left, -45deg = lower-right
const ARC_START_DEG = 225;
const ARC_END_DEG = -45;
const ARC_START = (ARC_START_DEG * Math.PI) / 180;
const ARC_END = (ARC_END_DEG * Math.PI) / 180;
const ARC_SWEEP = (270 * Math.PI) / 180;

export class Dial {
  constructor(container, options = {}) {
    this.container = container;
    this.size = options.size || 240;
    this.min = options.min || 0;
    this.max = options.max || 100;
    this.value = this.min;
    this.locked = false;
    this.dragging = false;

    this.timerTotal = 25;
    this.timerRemaining = 25;

    this.feedbackMode = false;
    this.feedbackColor = 'cyan';
    this.actualAnswerAngle = null;
    this.scoreText = '';

    this.roundResults = [];
    this.theme = getTheme(getSavedThemeId());

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.resize(this.size);
    container.appendChild(this.canvas);

    this.label = document.createElement('div');
    this.label.className = 'dial-label';
    this._applyLabelStyle();
    container.appendChild(this.label);

    this.onValueChange = options.onValueChange || (() => {});
    this.onRelease = options.onRelease || (() => {});

    this._bindEvents();
    this.draw();
  }

  _applyLabelStyle() {
    const t = this.theme;
    this.label.style.cssText = `
      position: absolute;
      background: oklch(0.06 0.03 270 / 0.92);
      backdrop-filter: blur(12px);
      color: ${t.accent};
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 36px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      padding: 6px 18px;
      border-radius: 10px;
      border: 2px solid ${t.primary};
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.12s;
      z-index: 10;
      white-space: nowrap;
      text-shadow: 0 0 12px ${t.primary};
    `;
  }

  setTheme(themeId) {
    this.theme = getTheme(themeId);
    this._applyLabelStyle();
    this.draw();
  }

  resize(size) {
    this.size = size;
    const pad = 40;                    // horizontal padding for range labels
    const canvasW = size + pad * 2;
    this.canvas.width = canvasW * this.dpr;
    this.canvas.height = size * this.dpr;
    this.canvas.style.width = canvasW + 'px';
    this.canvas.style.height = size + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.canvasW = canvasW;
    this.cx = canvasW / 2;
    this.cy = size / 2;
    this.radius = size / 2 - 36;      // smaller gauge — leaves room for side labels
    this.timerRadius = size / 2 - 22;
  }

  setRange(min, max) {
    this.min = min;
    this.max = max;
    this.value = min;
    this.locked = false;
    this.feedbackMode = false;
    this.actualAnswerAngle = null;
    this.scoreText = '';
    this.draw();
  }

  _bindEvents() {
    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'grab';

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.locked) return;
      this.dragging = true;
      this.canvas.style.cursor = 'grabbing';
      this.canvas.setPointerCapture(e.pointerId);
      this._updateFromPointer(e);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging || this.locked) return;
      e.preventDefault();
      this._updateFromPointer(e);
    });

    this.canvas.addEventListener('pointerup', () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.canvas.style.cursor = 'grab';
      this.label.style.opacity = '0';
      if (!this.locked) this.onRelease(this.value);
    });
  }

  _updateFromPointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.size;
    const scaleY = rect.height / this.size;
    const x = e.clientX - rect.left - this.cx * scaleX;
    const y = e.clientY - rect.top - this.cy * scaleY;

    let angle = Math.atan2(y, x);
    // Horseshoe: sweep goes counterclockwise from ARC_START (225deg) for 270deg
    let normalized = ARC_START - angle;
    if (normalized < 0) normalized += TAU;
    if (normalized > TAU) normalized -= TAU;

    // Clamp to dead zone (bottom gap)
    let t = normalized / ARC_SWEEP;
    t = Math.max(0, Math.min(1, t));

    this.value = Math.round(this.min + t * (this.max - this.min));
    this.onValueChange(this.value);

    // Floating label near indicator
    const indicatorAngle = this._valueToAngle(this.value);
    const containerRect = this.container.getBoundingClientRect();
    const labelX = rect.left + (this.cx + Math.cos(indicatorAngle) * this.radius) * scaleX - containerRect.left;
    const labelY = rect.top + (this.cy + Math.sin(indicatorAngle) * this.radius) * scaleY - containerRect.top - 58;
    this.label.textContent = this.value;
    this.label.style.left = labelX + 'px';
    this.label.style.top = labelY + 'px';
    this.label.style.transform = 'translateX(-50%)';
    this.label.style.opacity = '1';

    this.draw();
  }

  _valueToAngle(value) {
    const t = (value - this.min) / (this.max - this.min);
    return ARC_START - t * ARC_SWEEP;
  }

  draw() {
    const ctx = this.ctx;
    const t = this.theme;
    ctx.clearRect(0, 0, this.canvasW, this.size);

    this._drawTimerRing(ctx, t);
    this._drawMainRing(ctx, t);
    this._drawTicks(ctx, t);
    this._drawRangeLabels(ctx, t);
    this._drawIndicator(ctx, t);
    this._drawGlassReflection(ctx);
    this._drawRoundDots(ctx, t);
    this._drawCenterContent(ctx, t);

    if (this.feedbackMode) {
      this._drawFeedback(ctx, t);
    }
  }

  _drawTimerRing(ctx, t) {
    const pct = this.timerRemaining / this.timerTotal;
    const sweepAngle = pct * ARC_SWEEP;

    // Background track
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.timerRadius, ARC_START, ARC_START - ARC_SWEEP, true);
    ctx.strokeStyle = 'oklch(0.15 0.02 270)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'butt';
    ctx.stroke();

    // Active timer
    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.timerRadius, ARC_START, ARC_START - sweepAngle, true);
      ctx.strokeStyle = this._getTimerColor(pct);
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  _getTimerColor(pct) {
    if (pct > 0.6) return 'oklch(0.78 0.15 195)';
    if (pct > 0.32) return 'oklch(0.82 0.15 90)';
    if (pct > 0.12) return 'oklch(0.72 0.18 55)';
    return 'oklch(0.65 0.22 25)';
  }

  _drawMainRing(ctx, t) {
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius, ARC_START, ARC_START - ARC_SWEEP, true);
    ctx.strokeStyle = t.ring;
    ctx.lineWidth = t.ringWidth;
    ctx.lineCap = 'round';
    ctx.shadowColor = t.ring;
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _drawTicks(ctx, t) {
    if (t.tickCount <= 0) return;
    const count = t.tickCount;
    ctx.strokeStyle = t.dim;
    ctx.lineWidth = 1.5;

    for (let i = 0; i <= count; i++) {
      const frac = i / count;
      const angle = ARC_START - frac * ARC_SWEEP;
      const innerR = this.radius - 10;
      const outerR = this.radius - 3;
      ctx.beginPath();
      ctx.moveTo(this.cx + Math.cos(angle) * innerR, this.cy + Math.sin(angle) * innerR);
      ctx.lineTo(this.cx + Math.cos(angle) * outerR, this.cy + Math.sin(angle) * outerR);
      ctx.stroke();
    }
  }

  _drawRangeLabels(ctx, t) {
    ctx.font = '800 18px Inter, system-ui';
    ctx.fillStyle = t.accent;
    ctx.globalAlpha = 0.55;
    ctx.textBaseline = 'middle';

    // Labels on far left/right, near the top of the gauge
    const labelY = this.cy - this.radius * 0.5;

    // Min — far left
    ctx.textAlign = 'right';
    ctx.fillText(this.min, this.cx - this.timerRadius - 14, labelY);

    // Max — far right
    ctx.textAlign = 'left';
    ctx.fillText(this.max, this.cx + this.timerRadius + 14, labelY);

    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  _drawIndicator(ctx, t) {
    const angle = this._valueToAngle(this.value);
    const ix = this.cx + Math.cos(angle) * this.radius;
    const iy = this.cy + Math.sin(angle) * this.radius;
    const r = t.indicatorRadius;

    // Outer glow
    ctx.beginPath();
    ctx.arc(ix, iy, r + 6, 0, TAU);
    ctx.fillStyle = t.primary.replace(')', ' / 0.2)').replace('oklch(', 'oklch(');
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(ix, iy, r, 0, TAU);
    ctx.fillStyle = t.accent;
    ctx.shadowColor = t.primary;
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  _drawGlassReflection(ctx) {
    // Subtle glass highlight — top-left crescent
    const grad = ctx.createRadialGradient(
      this.cx - this.radius * 0.3, this.cy - this.radius * 0.3, 0,
      this.cx, this.cy, this.radius * 0.85
    );
    grad.addColorStop(0, 'oklch(1 0 0 / 0.06)');
    grad.addColorStop(0.5, 'oklch(1 0 0 / 0.02)');
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  _drawRoundDots(ctx, t) {
    const dotR = 5;
    const startX = this.cx - 48;
    // Position below the dial gap (bottom center)
    const y = this.cy + this.radius + 22;
    for (let i = 0; i < 5; i++) {
      const x = startX + i * 24;
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, TAU);
      if (this.roundResults[i]) {
        const color = this._tierToCSS(this.roundResults[i].color);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = 'oklch(0.20 0.02 270)';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  _drawCenterContent(ctx, t) {
    if (this.feedbackMode && this.scoreText) {
      const color = this._tierToCSS(this.feedbackColor);
      ctx.font = '800 48px Inter, system-ui';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.fillText(this.scoreText, this.cx, this.cy + 8);
      ctx.shadowBlur = 0;

      ctx.font = '800 18px Inter, system-ui';
      ctx.fillStyle = 'oklch(0.65 0.02 270)';
      ctx.fillText(this._getTierLabel(this.feedbackColor), this.cx, this.cy + 36);
    } else if (!this.feedbackMode) {
      // Big value in center
      ctx.font = '800 56px Inter, system-ui';
      ctx.fillStyle = t.accent;
      ctx.textAlign = 'center';
      ctx.shadowColor = t.primary;
      ctx.shadowBlur = 16;
      ctx.fillText(this.value, this.cx, this.cy + 18);
      ctx.shadowBlur = 0;
    }
  }

  _getTierLabel(colorName) {
    const labels = { green: 'EXACT', cyan: 'CLOSE', yellow: 'WARM', orange: 'COOL', red: 'MISS' };
    return labels[colorName] || '';
  }

  _drawFeedback(ctx, t) {
    if (this.actualAnswerAngle === null) return;
    const ax = this.cx + Math.cos(this.actualAnswerAngle) * this.radius;
    const ay = this.cy + Math.sin(this.actualAnswerAngle) * this.radius;

    ctx.beginPath();
    ctx.arc(ax, ay, 12, 0, TAU);
    ctx.fillStyle = t.secondary.replace(')', ' / 0.3)').replace('oklch(', 'oklch(');
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ax, ay, 8, 0, TAU);
    ctx.fillStyle = t.secondary;
    ctx.shadowColor = t.secondary;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  _tierToCSS(colorName) {
    const map = {
      green:  'oklch(0.82 0.20 155)',
      cyan:   'oklch(0.88 0.18 195)',
      yellow: 'oklch(0.90 0.16 90)',
      orange: 'oklch(0.80 0.20 55)',
      red:    'oklch(0.72 0.24 25)',
    };
    return map[colorName] || map.cyan;
  }

  lock() {
    this.locked = true;
    this.canvas.style.cursor = 'default';
    this.label.style.opacity = '0';
  }

  showFeedback(actualAnswer, tier) {
    this.feedbackMode = true;
    this.actualAnswerAngle = this._valueToAngle(actualAnswer);
    this.feedbackColor = tier.color;
    this.scoreText = '+' + tier.points;
    this.draw();
  }

  setTimerRemaining(seconds) {
    this.timerRemaining = seconds;
    this.draw();
  }

  addRoundResult(index, tier) {
    this.roundResults[index] = { color: tier.color };
    this.draw();
  }

  reset() {
    this.locked = false;
    this.feedbackMode = false;
    this.actualAnswerAngle = null;
    this.scoreText = '';
    this.timerRemaining = this.timerTotal;
    this.canvas.style.cursor = 'grab';
    this.draw();
  }

  getValue() {
    return this.value;
  }
}
