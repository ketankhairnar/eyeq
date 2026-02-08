const TAU = Math.PI * 2;
const ARC_START = (225 * Math.PI) / 180;
const ARC_END = (-45 * Math.PI) / 180;
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
    this.feedbackRingPct = 1.0;
    this.feedbackColor = 'cyan';
    this.actualAnswerAngle = null;
    this.scoreText = '';
    this.emojiText = '';

    this.roundResults = [];

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.resize(this.size);
    container.appendChild(this.canvas);

    this.label = document.createElement('div');
    this.label.className = 'dial-label';
    this.label.style.cssText = `
      position: absolute;
      background: oklch(0.14 0.02 270 / 0.85);
      backdrop-filter: blur(8px);
      color: oklch(0.93 0.01 270);
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 18px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      padding: 4px 12px;
      border-radius: 6px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 10;
      white-space: nowrap;
    `;
    container.appendChild(this.label);

    this.onValueChange = options.onValueChange || (() => {});

    this._bindEvents();
    this.draw();
  }

  resize(size) {
    this.size = size;
    this.canvas.width = size * this.dpr;
    this.canvas.height = size * this.dpr;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cx = size / 2;
    this.cy = size / 2;
    this.radius = size / 2 - 20;
    this.timerRadius = size / 2 - 8;
  }

  setRange(min, max) {
    this.min = min;
    this.max = max;
    this.value = min;
    this.locked = false;
    this.feedbackMode = false;
    this.actualAnswerAngle = null;
    this.scoreText = '';
    this.emojiText = '';
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

    this.canvas.addEventListener('pointerup', (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.canvas.style.cursor = 'grab';
      this.label.style.opacity = '0';
    });
  }

  _updateFromPointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - this.cx * (rect.width / this.size);
    const y = e.clientY - rect.top - this.cy * (rect.height / this.size);

    let angle = Math.atan2(y, x);
    let normalized = ARC_START - angle;
    if (normalized < 0) normalized += TAU;
    if (normalized > TAU) normalized -= TAU;

    let t = normalized / ARC_SWEEP;
    t = Math.max(0, Math.min(1, t));

    this.value = Math.round(this.min + t * (this.max - this.min));
    this.onValueChange(this.value);

    // Floating label position
    const indicatorAngle = ARC_START - t * ARC_SWEEP;
    const containerRect = this.container.getBoundingClientRect();
    const labelX = rect.left + (this.cx + Math.cos(indicatorAngle) * this.radius) * (rect.width / this.size) - containerRect.left;
    const labelY = rect.top + (this.cy + Math.sin(indicatorAngle) * this.radius) * (rect.height / this.size) - containerRect.top - 40;
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
    ctx.clearRect(0, 0, this.size, this.size);

    this._drawTimerRing(ctx);
    this._drawMainRing(ctx);
    this._drawRangeLabels(ctx);
    this._drawIndicator(ctx);
    this._drawRoundDots(ctx);
    this._drawCenterContent(ctx);

    if (this.feedbackMode) {
      this._drawFeedback(ctx);
    }
  }

  _drawTimerRing(ctx) {
    const pct = this.timerRemaining / this.timerTotal;
    const sweepAngle = pct * ARC_SWEEP;

    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.timerRadius, ARC_START, ARC_START - ARC_SWEEP, true);
    ctx.strokeStyle = 'oklch(0.2 0.02 270)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'butt';
    ctx.stroke();

    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.timerRadius, ARC_START, ARC_START - sweepAngle, true);
      ctx.strokeStyle = this._getTimerColorCSS();
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  _getTimerColorCSS() {
    const pct = this.timerRemaining / this.timerTotal;
    if (pct > 0.6) return 'oklch(0.78 0.15 195)';
    if (pct > 0.32) return 'oklch(0.82 0.15 90)';
    if (pct > 0.12) return 'oklch(0.72 0.18 55)';
    return 'oklch(0.65 0.22 25)';
  }

  _drawMainRing(ctx) {
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius, ARC_START, ARC_START - ARC_SWEEP, true);
    ctx.strokeStyle = 'oklch(0.78 0.15 195)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'oklch(0.78 0.15 195)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _drawRangeLabels(ctx) {
    ctx.font = '12px Inter, system-ui';
    ctx.fillStyle = 'oklch(0.45 0.02 270)';
    ctx.textAlign = 'center';

    const minAngle = ARC_START;
    const labelR = this.radius + 16;
    ctx.fillText(this.min, this.cx + Math.cos(minAngle) * labelR, this.cy + Math.sin(minAngle) * labelR + 4);

    const maxAngle = ARC_START - ARC_SWEEP;
    ctx.fillText(this.max, this.cx + Math.cos(maxAngle) * labelR, this.cy + Math.sin(maxAngle) * labelR + 4);
  }

  _drawIndicator(ctx) {
    const angle = this._valueToAngle(this.value);
    const ix = this.cx + Math.cos(angle) * this.radius;
    const iy = this.cy + Math.sin(angle) * this.radius;
    const dotRadius = 10;

    ctx.beginPath();
    ctx.arc(ix, iy, dotRadius + 4, 0, TAU);
    ctx.fillStyle = 'oklch(0.78 0.15 195 / 0.3)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ix, iy, dotRadius, 0, TAU);
    ctx.fillStyle = 'oklch(0.78 0.15 195)';
    ctx.shadowColor = 'oklch(0.78 0.15 195)';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  _drawRoundDots(ctx) {
    const dotRadius = 4;
    const startX = this.cx - 40;
    const y = this.cy + this.radius + 24;
    for (let i = 0; i < 5; i++) {
      const x = startX + i * 20;
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, TAU);
      if (this.roundResults[i]) {
        ctx.fillStyle = this._tierToCSS(this.roundResults[i].color);
      } else {
        ctx.fillStyle = 'oklch(0.2 0.02 270)';
      }
      ctx.fill();
    }
  }

  _drawCenterContent(ctx) {
    if (this.feedbackMode && this.scoreText) {
      ctx.font = '800 32px Inter, system-ui';
      ctx.fillStyle = this._tierToCSS(this.feedbackColor);
      ctx.textAlign = 'center';
      ctx.fillText(this.scoreText, this.cx, this.cy + 4);

      ctx.font = '24px sans-serif';
      ctx.fillText(this.emojiText, this.cx, this.cy + 34);
    }
  }

  _drawFeedback(ctx) {
    if (this.actualAnswerAngle !== null) {
      const ax = this.cx + Math.cos(this.actualAnswerAngle) * this.radius;
      const ay = this.cy + Math.sin(this.actualAnswerAngle) * this.radius;

      ctx.beginPath();
      ctx.arc(ax, ay, 8, 0, TAU);
      ctx.fillStyle = 'oklch(0.65 0.20 330)';
      ctx.shadowColor = 'oklch(0.65 0.20 330)';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  _tierToCSS(colorName) {
    const map = {
      green: 'oklch(0.75 0.18 155)',
      cyan: 'oklch(0.78 0.15 195)',
      yellow: 'oklch(0.82 0.15 90)',
      orange: 'oklch(0.72 0.18 55)',
      red: 'oklch(0.65 0.22 25)',
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
    this.emojiText = tier.emoji;
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
    this.emojiText = '';
    this.timerRemaining = this.timerTotal;
    this.canvas.style.cursor = 'grab';
    this.draw();
  }

  getValue() {
    return this.value;
  }
}
