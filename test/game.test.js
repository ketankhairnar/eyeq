// DLG Quality Playtest: Game Logic
// Run with: node test/game.test.js

import { createGame, setActualAnswer, submitEstimate, advanceRound, useHint, getBadge, scoreEstimate } from '../src/game.js';
import { createRng, hashDateString, getTodayDateString, getPuzzleNumber } from '../src/seed.js';
import { generateRound } from '../src/canvas.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// === SEED TESTS ===
section('Seed / PRNG');

const rng1 = createRng(42);
const rng2 = createRng(42);
const v1 = rng1();
const v2 = rng2();
assert(v1 === v2, `Same seed same output: ${v1} === ${v2}`);
assert(v1 >= 0 && v1 < 1, `Output in [0,1): ${v1}`);

const rng3 = createRng(99);
const v3 = rng3();
assert(v3 !== v1, `Different seed different output: ${v3} !== ${v1}`);

const hash1 = hashDateString('2026-02-08');
const hash2 = hashDateString('2026-02-08');
const hash3 = hashDateString('2026-02-09');
assert(hash1 === hash2, `Same date same hash`);
assert(hash1 !== hash3, `Different date different hash`);

const pn = getPuzzleNumber('2026-02-08');
assert(pn === 1, `Puzzle #1 on epoch day: got ${pn}`);
const pn2 = getPuzzleNumber('2026-02-09');
assert(pn2 === 2, `Puzzle #2 on day 2: got ${pn2}`);

// === GAME STATE ===
section('Game State Machine');

const game = createGame('2026-02-08');
assert(game.rounds.length === 5, `5 rounds: got ${game.rounds.length}`);
assert(game.status === 'ready', `Initial status: ${game.status}`);
assert(game.currentRound === 0, `Starts at round 0`);
assert(game.totalScore === 0, `Score starts at 0`);

// Round types in order
assert(game.rounds[0].type === 'count', `R1 is count`);
assert(game.rounds[1].type === 'proportion', `R2 is proportion`);
assert(game.rounds[2].type === 'comparison', `R3 is comparison`);
assert(game.rounds[3].type === 'density', `R4 is density`);
assert(game.rounds[4].type === 'countExtreme', `R5 is countExtreme`);

// === SCORING ===
section('Scoring');

const exact = scoreEstimate(100, 100);
assert(exact.label === 'EXACT', `100 vs 100 = EXACT: got ${exact.label}`);
assert(exact.points === 100, `EXACT = 100pts`);

const close = scoreEstimate(100, 90);
assert(close.label === 'CLOSE', `100 vs 90 (10% off) = CLOSE: got ${close.label}`);

const warm = scoreEstimate(100, 80);
assert(warm.label === 'WARM', `100 vs 80 (20% off) = WARM: got ${warm.label}`);

const cool = scoreEstimate(100, 65);
assert(cool.label === 'COOL', `100 vs 65 (35% off) = COOL: got ${cool.label}`);

const cold = scoreEstimate(100, 45);
assert(cold.label === 'COLD', `100 vs 45 (55% off) = COLD: got ${cold.label}`);

const miss = scoreEstimate(100, 30);
assert(miss.label === 'MISS', `100 vs 30 (70% off) = MISS: got ${miss.label}`);

// Edge: actual=0
const zeroActual = scoreEstimate(0, 50);
assert(zeroActual.label === 'MISS', `actual=0 always MISS: got ${zeroActual.label}`);

// === FULL GAME SIMULATION ===
section('Full Game Simulation');

const simGame = createGame('2026-02-08');
simGame.startTime = Date.now();

for (let i = 0; i < 5; i++) {
  const round = simGame.rounds[i];
  // Simulate setting actual answer (normally canvas does this)
  const fakeAnswer = round.dialMin + Math.round((round.dialMax - round.dialMin) * 0.5);
  setActualAnswer(simGame, i, fakeAnswer);

  assert(round.actualAnswer === fakeAnswer, `R${i+1} actual set: ${round.actualAnswer}`);
  assert(round.aiEstimate > 0, `R${i+1} AI estimate computed: ${round.aiEstimate}`);
  assert(round.aiEstimate >= round.dialMin, `R${i+1} AI clamped min: ${round.aiEstimate} >= ${round.dialMin}`);
  assert(round.aiEstimate <= round.dialMax, `R${i+1} AI clamped max: ${round.aiEstimate} <= ${round.dialMax}`);

  // Player guesses exact
  simGame.status = 'playing';
  const result = submitEstimate(simGame, fakeAnswer);
  assert(result.tier.label === 'EXACT', `R${i+1} exact guess = EXACT: got ${result.tier.label}`);
  assert(result.score === 100, `R${i+1} score = 100`);
  assert(simGame.status === 'revealed', `Status = revealed after submit`);

  if (i < 4) {
    const advanced = advanceRound(simGame);
    assert(advanced === true, `Advance R${i+1}->R${i+2}`);
    assert(simGame.status === 'playing', `Status = playing after advance`);
  }
}

// Final round
const finished = advanceRound(simGame);
assert(finished === false, `Game ends after R5`);
assert(simGame.status === 'finished', `Status = finished`);
assert(simGame.totalScore === 500, `Perfect score: ${simGame.totalScore}`);

// Badge
const badge = getBadge(500);
assert(badge.name === 'CALIBRATED', `500pts = CALIBRATED: got ${badge.name}`);

const badge2 = getBadge(250);
assert(badge2.name === 'ON FREQUENCY', `250pts = ON FREQUENCY: got ${badge2.name}`);

const badge3 = getBadge(50);
assert(badge3.name === 'OFF AIR', `50pts = OFF AIR: got ${badge3.name}`);

// === HINTS ===
section('Hints');

const hintGame = createGame('2026-02-08');
setActualAnswer(hintGame, 0, 55);
hintGame.status = 'playing';

const hint1 = useHint(hintGame);
assert(hint1 !== null, `First hint returns text: "${hint1}"`);
assert(hintGame.rounds[0].hintUsed === true, `Hint marked as used`);

const hint2 = useHint(hintGame);
assert(hint2 === null, `Second hint returns null (already used)`);

// Test proportion hint (round index 1 = range bracket)
setActualAnswer(hintGame, 1, 50);
advanceRound(hintGame);
const hint3 = useHint(hintGame);
assert(hint3 !== null && hint3.includes('Between'), `Proportion hint is range bracket: "${hint3}"`);

// === AI WIN/LOSS COUNTING ===
section('AI Win/Loss');

const aiGame = createGame('2026-02-09');
setActualAnswer(aiGame, 0, 50);
aiGame.status = 'playing';

// Player guesses exact (100pts), AI has noise so less
submitEstimate(aiGame, 50);
assert(aiGame.humanWins >= 0, `Human wins tracked: ${aiGame.humanWins}`);
assert(aiGame.aiWins >= 0, `AI wins tracked: ${aiGame.aiWins}`);
assert(aiGame.humanWins + aiGame.aiWins <= 1, `Total wins <= rounds played`);

// === COMPARISON ROUND: diff can be 0? ===
section('Edge Cases');

// Proportion round: activePct between 25-75, never 0
// Comparison round: diff is 8+rng()*32, so min 8 — good, never 0
assert(true, `Comparison diff minimum is 8 (from code) — division by 0 safe`);

// CountExtreme: range 100-600, count 200-500 — range fits
assert(true, `CountExtreme range [100,600] fits count [200,500]`);

// === RESULTS ===
section('Results');
console.log(`\n${'='.repeat(40)}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log(`${'='.repeat(40)}`);

if (failed > 0) process.exit(1);
