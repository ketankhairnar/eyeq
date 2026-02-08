import './style.css';
import { createGame, setActualAnswer, submitEstimate, advanceRound, useHint, getBadge, getElapsedTime, ROUND_TYPES } from './src/game.js';
import { getTodayDateString, getPuzzleNumber, createRng, hashDateString, nextPlayId } from './src/seed.js';
import { Dial } from './src/dial.js';
import { createPuzzleCanvas, generateRound } from './src/canvas.js';
import { buildShareString, copyToClipboard } from './src/share.js';
import { initAudio, playLockIn, playForTier, playShare } from './src/audio.js';
import { getTheme, getSavedThemeId } from './src/themes.js';
import { startIntro, stopIntro } from './src/intro.js';
import confetti from 'canvas-confetti';

let game = null;
let dial = null;
let puzzleCanvas = null;
let roundTimer = null;
let currentThemeId = getSavedThemeId();

const app = document.getElementById('app');
const statusBar = document.getElementById('status-bar');

// Ambient border light - maps game state to oklch base (L C H)
// Feedback states use fixed hues for universal readability; idle/playing use theme hue
function getAmbientBase() {
  const theme = getTheme(currentThemeId);
  const h = theme.ambientHue;
  return {
    idle:    [0.85, 0.18, h],
    playing: [0.85, 0.18, h],
    timer:   [0.88, 0.16, 90],    // yellow — universal warning
    danger:  [0.70, 0.24, 25],    // red — universal danger
    exact:   [0.80, 0.20, 155],   // green
    close:   [0.88, 0.18, h],     // theme hue
    warm:    [0.88, 0.16, 90],    // yellow
    cool:    [0.78, 0.20, 55],    // orange
    miss:    [0.70, 0.24, 25],    // red
    win:     [0.80, 0.20, 155],   // green
    loss:    [0.70, 0.22, 330],   // magenta
  };
}

function setAmbient(state, intensity = 0.3) {
  const base = getAmbientBase();
  const [l, c, h] = base[state] || base.idle;
  const borderAlpha = Math.min(1, intensity * 1.0).toFixed(2);
  const glowAlpha = Math.min(1, intensity * 0.3).toFixed(2);
  const outerAlpha = Math.min(1, intensity * 0.5).toFixed(2);
  app.style.setProperty('--ab', `oklch(${l} ${c} ${h} / ${borderAlpha})`);
  app.style.setProperty('--ag', `oklch(${l} ${c} ${h} / ${glowAlpha})`);
  app.style.setProperty('--ao', `oklch(${l} ${c} ${h} / ${outerAlpha})`);
}

function flashAmbient(state, intensity = 0.7) {
  setAmbient(state, intensity);
  setTimeout(() => setAmbient(state, 0.3), 400);
}
const canvasArea = document.getElementById('canvas-area');
const questionArea = document.getElementById('question-area');
const dialArea = document.getElementById('dial-area');
const controlsArea = document.getElementById('controls-area');

function init() {
  const dateStr = getTodayDateString();

  const saved = localStorage.getItem('eyeq_' + dateStr);
  if (saved) {
    game = JSON.parse(saved);
    showResults();
    return;
  }

  const playId = nextPlayId();
  game = createGame(dateStr, playId);
  game.puzzleNumber = getPuzzleNumber(dateStr);

  puzzleCanvas = createPuzzleCanvas(canvasArea);
  applyCanvasTheme();

  // Show start screen + intro animation immediately, before heavy Dial setup
  showStartScreen();

  const dialSize = Math.min(dialArea.clientWidth - 32, 260);

  dial = new Dial(dialArea, {
    size: Math.max(dialSize, 180),
    onValueChange: () => {},
    onRelease: () => onLockIn(),
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const btn = document.getElementById('lockin-btn')
        || document.getElementById('next-btn')
        || document.getElementById('results-btn')
        || document.getElementById('start-btn');
      btn?.click();
    }
    if (e.key === 'h' || e.key === 'H') {
      document.getElementById('hint-btn')?.click();
    }
  });
}

function showStartScreen() {
  setAmbient('idle', 0.2);
  statusBar.innerHTML = '';
  questionArea.innerHTML = `<div style="padding:24px 0">
    <div class="neon-text" style="font-size:clamp(28px,7vw,40px);font-weight:800;letter-spacing:0.12em;margin-bottom:12px">EYEQ <span style="font-size:0.5em;opacity:0.5">#${game.puzzleNumber}</span></div>
    <div style="color:var(--text);font-size:clamp(15px,3.5vw,18px);font-weight:700;letter-spacing:0.04em;margin-bottom:6px">TUNE YOUR FREQUENCY</div>
    <div style="color:var(--muted);font-size:14px;font-weight:600">5 rounds · 25s each · beat the AI</div>
  </div>`;

  // Hide dial on start screen — timer shouldn't be visible yet
  dialArea.style.display = 'none';

  // Start intro animation on the puzzle canvas
  if (puzzleCanvas) {
    startIntro(puzzleCanvas, currentThemeId);
  }

  controlsArea.innerHTML = '<button class="btn btn-primary" id="start-btn">START</button>';
  document.getElementById('start-btn').addEventListener('click', startGame);
}

function applyCanvasTheme() {
  if (!puzzleCanvas) return;
  const theme = getTheme(currentThemeId);
  puzzleCanvas.style.border = `${theme.canvasBorderWidth}px solid ${theme.canvasBorder}`;
  puzzleCanvas.style.borderRadius = `${theme.canvasRadius}px`;
  puzzleCanvas.style.boxShadow = `0 0 20px ${theme.canvasBorder}, inset 0 0 30px oklch(0 0 0 / 0.3)`;
}

function startGame() {
  stopIntro();
  initAudio();
  dialArea.style.display = '';
  game.status = 'playing';
  game.startTime = Date.now();
  startRound();
}

function renderStatusDots() {
  const tierCSS = {
    green:  'oklch(0.82 0.20 155)',
    cyan:   'oklch(0.88 0.18 195)',
    yellow: 'oklch(0.90 0.16 90)',
    orange: 'oklch(0.80 0.20 55)',
    red:    'oklch(0.72 0.24 25)',
  };
  const dots = game.rounds.map((r, i) => {
    if (r.tier) {
      const c = tierCSS[r.tier.color] || tierCSS.cyan;
      return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};box-shadow:0 0 6px ${c}"></span>`;
    }
    return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:oklch(0.20 0.02 270)"></span>`;
  }).join('');

  statusBar.innerHTML = `
    <span style="letter-spacing:0.12em">EYEQ</span>
    <span style="display:flex;gap:6px;align-items:center">${dots}</span>
    <span>${game.totalScore}</span>
  `;
}

function startRound() {
  setAmbient('playing', 0.25);
  const round = game.rounds[game.currentRound];
  const roundSeed = hashDateString(game.dateStr + '_p' + game.playId + '_round_' + game.currentRound);

  const actualAnswer = generateRound(puzzleCanvas, round.type, roundSeed, currentThemeId);
  setActualAnswer(game, game.currentRound, actualAnswer);

  dial.setRange(round.dialMin, round.dialMax);
  dial.timerRemaining = 25;
  dial.timerTotal = 25;

  renderStatusDots();

  questionArea.innerHTML = `
    <div>${round.question}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:4px">AI weakness: ${round.aiWeakness}</div>
  `;

  controlsArea.innerHTML = `
    <button class="btn" id="hint-btn">HINT −5s</button>
    <button class="btn btn-primary" id="lockin-btn">LOCK IN</button>
  `;

  document.getElementById('hint-btn').addEventListener('click', onHint);
  document.getElementById('lockin-btn').addEventListener('click', onLockIn);

  startRoundTimer();
}

function startRoundTimer() {
  const startTime = Date.now();
  const round = game.rounds[game.currentRound];
  let totalMs = round.timeRemaining * 1000;

  if (roundTimer) clearInterval(roundTimer);

  roundTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, totalMs - elapsed) / 1000;
    round.timeRemaining = remaining;
    dial.setTimerRemaining(remaining);

    // Ambient shifts with urgency
    const pct = remaining / 25;
    if (pct <= 0.12) setAmbient('danger', 0.5);
    else if (pct <= 0.32) setAmbient('timer', 0.35);
    else setAmbient('playing', 0.25);

    if (remaining <= 0) {
      clearInterval(roundTimer);
      onLockIn();
    }
  }, 50);
}

function onHint() {
  const hintText = useHint(game);
  if (!hintText) return;

  const round = game.rounds[game.currentRound];
  round.timeRemaining = Math.max(0, round.timeRemaining - 5);

  questionArea.innerHTML += `<div style="color:var(--cyan);font-size:13px;margin-top:4px;animation:popIn 0.3s">${hintText}</div>`;

  const hintBtn = document.getElementById('hint-btn');
  if (hintBtn) {
    hintBtn.disabled = true;
    hintBtn.style.opacity = '0.3';
  }
}

function onLockIn() {
  if (game.status === 'revealed' || game.status === 'finished') return;

  clearInterval(roundTimer);
  playLockIn();

  const estimate = dial.getValue();
  const round = submitEstimate(game, estimate);

  dial.lock();
  dial.showFeedback(round.actualAnswer, round.tier);
  dial.addRoundResult(game.currentRound, round.tier);

  // Update status bar dots immediately
  renderStatusDots();

  // Ambient flash for feedback
  const tierAmbientMap = { green: 'exact', cyan: 'close', yellow: 'warm', orange: 'cool', red: 'miss' };
  flashAmbient(tierAmbientMap[round.tier.color] || 'miss');

  playForTier(round.tier);

  if (navigator.vibrate) navigator.vibrate(10);

  const tierColor = dial._tierToCSS(round.tier.color);
  questionArea.innerHTML = `
    <div style="display:flex;justify-content:center;gap:16px;animation:popIn 0.3s">
      <div style="text-align:center">
        <div style="font-size:11px;color:var(--muted);letter-spacing:0.1em;margin-bottom:2px">YOU</div>
        <div style="font-size:24px;font-weight:800;color:${tierColor}">${round.playerEstimate}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:11px;color:var(--muted);letter-spacing:0.1em;margin-bottom:2px">ACTUAL</div>
        <div style="font-size:24px;font-weight:800;color:var(--text)">${round.actualAnswer}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:11px;color:var(--muted);letter-spacing:0.1em;margin-bottom:2px">AI</div>
        <div style="font-size:24px;font-weight:800;color:var(--muted)">${round.aiEstimate}</div>
      </div>
    </div>
  `;

  controlsArea.innerHTML = game.currentRound < 4
    ? '<button class="btn btn-primary" id="next-btn">NEXT SIGNAL</button>'
    : '<button class="btn btn-primary" id="results-btn">SEE RESULTS</button>';

  const nextBtn = document.getElementById('next-btn') || document.getElementById('results-btn');
  nextBtn.addEventListener('click', () => {
    if (advanceRound(game)) {
      dial.reset();
      startRound();
    } else {
      endGame();
    }
  });
}

function endGame() {
  game.endTime = Date.now();
  game.status = 'finished';

  localStorage.setItem('eyeq_' + game.dateStr, JSON.stringify(game));
  updateStats(game);
  showResults();
}

function showResults() {
  canvasArea.innerHTML = '';
  dialArea.innerHTML = '';

  const badge = getBadge(game.totalScore);
  const elapsed = getElapsedTime(game);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

  const emojiLine = game.rounds.map(r => r.tier.emoji).join('');

  // Ambient based on performance
  const resultAmbient = game.humanWins >= game.aiWins ? 'win' : 'loss';
  setAmbient(resultAmbient, 0.35);

  // Status bar: EYEQ + tier dots
  const tierCSS = {
    green:  'oklch(0.82 0.20 155)',
    cyan:   'oklch(0.88 0.18 195)',
    yellow: 'oklch(0.90 0.16 90)',
    orange: 'oklch(0.80 0.20 55)',
    red:    'oklch(0.72 0.24 25)',
  };
  const dots = game.rounds.map(r => {
    const c = tierCSS[r.tier.color] || tierCSS.cyan;
    return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};box-shadow:0 0 6px ${c}"></span>`;
  }).join('');
  statusBar.innerHTML = `
    <span style="letter-spacing:0.12em">EYEQ <span style="font-size:0.6em;opacity:0.5">#${game.puzzleNumber}</span></span>
    <span style="display:flex;gap:6px;align-items:center">${dots}</span>
    <span>${game.totalScore}</span>
  `;

  if (game.totalScore >= 350) {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  }

  // Hero: score + badge + emoji + matchup
  canvasArea.innerHTML = `
    <div style="text-align:center;padding:20px 16px 12px;animation:popIn 0.4s;width:100%">
      <div style="font-size:clamp(56px,14vw,72px);font-weight:800;letter-spacing:-0.03em;margin-bottom:2px" class="neon-text">
        ${game.totalScore}<span style="font-size:0.4em;color:var(--muted);font-weight:700">/500</span>
      </div>
      <div style="font-size:clamp(18px,4.5vw,24px);font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:var(--cyan);margin-bottom:4px">
        ${badge.name}
      </div>
      <div style="font-size:14px;color:var(--muted);margin-bottom:16px">${badge.flavor}</div>
      <div style="font-size:clamp(22px,5.5vw,30px);letter-spacing:8px;margin-bottom:14px;font-weight:800">${emojiLine}</div>
      <div style="font-size:clamp(18px,4.5vw,22px);font-weight:800;letter-spacing:0.04em">
        HUMAN ${game.humanWins} — AI ${game.aiWins}
      </div>
      <div style="font-size:13px;color:var(--muted);margin-top:4px;letter-spacing:0.08em">${timeStr}</div>
    </div>
  `;

  // Round breakdown in question area
  questionArea.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;font-variant-numeric:tabular-nums;padding:4px 0">
      ${game.rounds.map((r, i) => {
        const c = tierCSS[r.tier.color] || tierCSS.cyan;
        return `<div style="display:flex;align-items:center;justify-content:center;gap:10px;font-size:clamp(12px,3vw,14px)">
          <span style="color:${c};font-weight:800">${r.tier.emoji} +${r.score}</span>
          <span style="color:var(--muted)">You: ${r.playerEstimate}</span>
          <span style="color:var(--text);font-weight:700">${r.actualAnswer}</span>
          <span style="color:var(--muted)">AI: ${r.aiEstimate}</span>
        </div>`;
      }).join('')}
    </div>
  `;

  controlsArea.innerHTML = `
    <button class="btn" id="replay-btn">PLAY AGAIN</button>
    <button class="btn btn-primary" id="share-btn" style="animation:pulse 2s infinite">SHARE RESULT</button>
  `;

  document.getElementById('replay-btn').addEventListener('click', resetGame);

  document.getElementById('share-btn').addEventListener('click', async () => {
    playShare();
    const shareText = buildShareString(game);
    await copyToClipboard(shareText);
    document.getElementById('share-btn').textContent = 'COPIED!';
    setTimeout(() => {
      const btn = document.getElementById('share-btn');
      if (btn) btn.textContent = 'SHARE RESULT';
    }, 2000);
  });
}

function resetGame() {
  const dateStr = getTodayDateString();
  localStorage.removeItem('eyeq_' + dateStr);

  game = null;
  dial = null;
  puzzleCanvas = null;
  if (roundTimer) clearInterval(roundTimer);
  roundTimer = null;

  canvasArea.innerHTML = '';
  questionArea.innerHTML = '';
  dialArea.innerHTML = '';
  controlsArea.innerHTML = '';
  statusBar.innerHTML = '';

  init();
}

function updateStats(game) {
  const stats = JSON.parse(localStorage.getItem('eyeq_stats') || '{"played":0,"totalScore":0,"currentStreak":0,"bestStreak":0,"lastDate":""}');

  stats.played++;
  stats.totalScore += game.totalScore;

  const yesterday = new Date(new Date(game.dateStr).getTime() - 86400000).toISOString().slice(0, 10);
  if (stats.lastDate === yesterday) {
    stats.currentStreak++;
  } else if (stats.lastDate !== game.dateStr) {
    stats.currentStreak = 1;
  }
  stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
  stats.lastDate = game.dateStr;

  localStorage.setItem('eyeq_stats', JSON.stringify(stats));
}

init();
