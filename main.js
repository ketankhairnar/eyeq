import './style.css';
import { createGame, setActualAnswer, submitEstimate, advanceRound, useHint, getBadge, getElapsedTime, ROUND_TYPES } from './src/game.js';
import { getTodayDateString, getPuzzleNumber, createRng, hashDateString } from './src/seed.js';
import { Dial } from './src/dial.js';
import { createPuzzleCanvas, generateRound } from './src/canvas.js';
import { buildShareString, copyToClipboard } from './src/share.js';
import { initAudio, playLockIn, playForTier, playShare } from './src/audio.js';
import confetti from 'canvas-confetti';

let game = null;
let dial = null;
let puzzleCanvas = null;
let roundTimer = null;

const statusBar = document.getElementById('status-bar');
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

  game = createGame(dateStr);
  game.puzzleNumber = getPuzzleNumber(dateStr);

  puzzleCanvas = createPuzzleCanvas(canvasArea);

  const dialSize = Math.min(dialArea.clientWidth - 32, 260);

  dial = new Dial(dialArea, {
    size: Math.max(dialSize, 180),
    onValueChange: () => {},
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
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

  showStartScreen();
}

function showStartScreen() {
  statusBar.innerHTML = `<span class="neon-text">⚡ EYEQ #${game.puzzleNumber}</span>`;
  questionArea.innerHTML = `<div style="padding:24px 0">
    <div class="neon-text" style="font-size:clamp(20px,5vw,28px);font-weight:800;letter-spacing:-0.03em;margin-bottom:8px">TUNE YOUR FREQUENCY</div>
    <div style="color:var(--muted);font-size:14px">5 rounds · 25 seconds each · beat the AI</div>
  </div>`;

  controlsArea.innerHTML = '<button class="btn btn-primary" id="start-btn">START TRANSMISSION</button>';
  document.getElementById('start-btn').addEventListener('click', startGame);
}

function startGame() {
  initAudio();
  game.status = 'playing';
  game.startTime = Date.now();
  startRound();
}

function startRound() {
  const round = game.rounds[game.currentRound];
  const roundSeed = hashDateString(game.dateStr + '_round_' + game.currentRound);

  const actualAnswer = generateRound(puzzleCanvas, round.type, roundSeed);
  setActualAnswer(game, game.currentRound, actualAnswer);

  dial.setRange(round.dialMin, round.dialMax);
  dial.timerRemaining = 25;
  dial.timerTotal = 25;

  statusBar.innerHTML = `
    <span>R${game.currentRound + 1}/5</span>
    <span>${game.totalScore} pts</span>
  `;

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

  playForTier(round.tier);

  if (navigator.vibrate) navigator.vibrate(10);

  questionArea.innerHTML = `
    <div style="font-size:13px">
      <span>You: <strong>${round.playerEstimate}</strong></span>
      <span style="margin:0 8px">·</span>
      <span>Actual: <strong style="color:var(--magenta)">${round.actualAnswer}</strong></span>
      <span style="margin:0 8px">·</span>
      <span>AI: <strong>${round.aiEstimate}</strong></span>
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

  statusBar.innerHTML = `<span class="neon-text">⚡ EYEQ #${game.puzzleNumber} ⚡</span>`;

  questionArea.innerHTML = '';

  if (game.totalScore >= 350) {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  }

  canvasArea.innerHTML = `
    <div style="text-align:center;padding:16px;animation:popIn 0.4s">
      <div style="font-size:48px;font-weight:800;letter-spacing:-0.03em;margin-bottom:4px" class="neon-text">
        ${game.totalScore}<span style="font-size:24px;color:var(--muted)">/500</span>
      </div>
      <div style="font-size:20px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--cyan);margin-bottom:4px">
        ${badge.name}
      </div>
      <div style="font-size:14px;color:var(--muted);margin-bottom:16px">${badge.flavor}</div>
      <div style="font-size:28px;letter-spacing:4px;margin-bottom:16px">${emojiLine}</div>
      <div style="font-size:20px;font-weight:800;margin-bottom:8px">
        HUMAN ${game.humanWins} — AI ${game.aiWins}
      </div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:24px">⏱️ ${timeStr}</div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--muted);margin-bottom:24px">
        ${game.rounds.map((r, i) => `
          <div>R${i + 1} ${r.tier.emoji} ${r.score}pts — You: ${r.playerEstimate} · Actual: ${r.actualAnswer} · AI: ${r.aiEstimate}</div>
        `).join('')}
      </div>
    </div>
  `;

  controlsArea.innerHTML = `
    <button class="btn btn-primary" id="share-btn" style="animation:pulse 2s infinite">SHARE RESULT</button>
  `;

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
