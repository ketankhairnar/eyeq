import { createRng, hashDateString } from './seed.js';

const ROUND_TYPES = ['count', 'proportion', 'comparison', 'density', 'countExtreme'];

const ROUND_CONFIG = {
  count:        { question: 'How many signals intercepted?', minRange: 30, maxRange: 80 },
  proportion:   { question: 'What % of the field is active?', minRange: 0, maxRange: 100 },
  comparison:   { question: 'How many MORE in the larger sector?', minRange: 0, maxRange: 50 },
  density:      { question: 'How many signals in the highlighted quadrant?', minRange: 20, maxRange: 150 },
  countExtreme: { question: 'How many signals intercepted?', minRange: 100, maxRange: 600 },
};

const SCORE_TIERS = [
  { maxPct: 5,   emoji: '◉', points: 100, label: 'EXACT',    color: 'green' },
  { maxPct: 15,  emoji: '◈', points: 75,  label: 'CLOSE',    color: 'cyan' },
  { maxPct: 25,  emoji: '▲', points: 50,  label: 'WARM',     color: 'yellow' },
  { maxPct: 40,  emoji: '◇', points: 25,  label: 'COOL',     color: 'orange' },
  { maxPct: 60,  emoji: '▽', points: 10,  label: 'COLD',     color: 'red' },
  { maxPct: Infinity, emoji: '✕', points: 0, label: 'MISS', color: 'red' },
];

const AI_NOISE = {
  count:        { min: 0.05, max: 0.15 },
  proportion:   { min: 0.05, max: 0.18 },
  comparison:   { min: 0.10, max: 0.25 },
  density:      { min: 0.08, max: 0.20 },
  countExtreme: { min: 0.12, max: 0.30 },
};

const AI_WEAKNESS = {
  count:        'Tends to overcount in clusters',
  proportion:   'Struggles with irregular boundaries',
  comparison:   'Fooled by object size differences',
  density:      'Has trouble with border objects',
  countExtreme: 'Loses accuracy in dense fields',
};

const BADGES = [
  { min: 450, name: 'CALIBRATED', flavor: 'Your frequency is locked in.' },
  { min: 350, name: 'TUNED IN',   flavor: 'Strong signal detected.' },
  { min: 250, name: 'ON FREQUENCY', flavor: "You're picking up the signal." },
  { min: 150, name: 'STATIC',     flavor: 'Adjust your antenna.' },
  { min: 0,   name: 'OFF AIR',    flavor: 'Signal lost.' },
];

export function createGame(dateStr) {
  const seed = hashDateString(dateStr);
  const rng = createRng(seed);

  const rounds = ROUND_TYPES.map((type, i) => {
    const config = ROUND_CONFIG[type];
    const noiseConfig = AI_NOISE[type];
    const noiseAmount = noiseConfig.min + rng() * (noiseConfig.max - noiseConfig.min);
    const noiseSign = rng() > 0.5 ? 1 : -1;

    return {
      type,
      index: i,
      question: config.question,
      dialMin: config.minRange,
      dialMax: config.maxRange,
      actualAnswer: 0,
      aiEstimate: 0,
      aiNoiseRatio: noiseAmount * noiseSign,
      aiWeakness: AI_WEAKNESS[type],
      playerEstimate: null,
      score: null,
      tier: null,
      hintUsed: false,
      timeRemaining: 25,
    };
  });

  return {
    dateStr,
    seed,
    puzzleNumber: 0,
    rounds,
    currentRound: 0,
    status: 'ready',
    totalScore: 0,
    aiTotalScore: 0,
    humanWins: 0,
    aiWins: 0,
    startTime: null,
    endTime: null,
  };
}

export function setActualAnswer(game, roundIndex, actualAnswer) {
  const round = game.rounds[roundIndex];
  round.actualAnswer = actualAnswer;
  round.aiEstimate = Math.round(actualAnswer * (1 + round.aiNoiseRatio));
  round.aiEstimate = Math.max(round.dialMin, Math.min(round.dialMax, round.aiEstimate));
}

export function scoreEstimate(actualAnswer, estimate) {
  if (actualAnswer === 0) return SCORE_TIERS[SCORE_TIERS.length - 1];
  const pctOff = Math.abs(estimate - actualAnswer) / actualAnswer * 100;
  return SCORE_TIERS.find(t => pctOff <= t.maxPct);
}

export function submitEstimate(game, estimate) {
  const round = game.rounds[game.currentRound];
  round.playerEstimate = Math.round(estimate);
  round.tier = scoreEstimate(round.actualAnswer, round.playerEstimate);
  round.score = round.tier.points;

  const aiTier = scoreEstimate(round.actualAnswer, round.aiEstimate);
  const aiScore = aiTier.points;

  game.totalScore += round.score;
  game.aiTotalScore += aiScore;

  if (round.score > aiScore) game.humanWins++;
  else if (aiScore > round.score) game.aiWins++;

  game.status = 'revealed';
  return round;
}

export function advanceRound(game) {
  if (game.currentRound >= 4) {
    game.status = 'finished';
    game.endTime = Date.now();
    return false;
  }
  game.currentRound++;
  game.status = 'playing';
  return true;
}

export function useHint(game) {
  const round = game.rounds[game.currentRound];
  if (round.hintUsed) return null;
  round.hintUsed = true;
  return getHintText(round);
}

function getHintText(round) {
  const answer = round.actualAnswer;
  if (round.index % 2 === 0) {
    if (answer < 20) return 'In the teens';
    if (answer < 50) return 'Tens';
    if (answer < 100) return 'Near a hundred';
    if (answer < 200) return 'Low hundreds';
    if (answer < 350) return 'Mid hundreds';
    return 'High hundreds';
  } else {
    const rangeSpan = round.dialMax - round.dialMin;
    const bracketSize = Math.round(rangeSpan * 0.5);
    const low = Math.max(round.dialMin, Math.round(answer - bracketSize / 2));
    const high = Math.min(round.dialMax, Math.round(answer + bracketSize / 2));
    return `Between ${low} and ${high}`;
  }
}

export function getBadge(totalScore) {
  return BADGES.find(b => totalScore >= b.min);
}

export function getElapsedTime(game) {
  const end = game.endTime || Date.now();
  return Math.round((end - game.startTime) / 1000);
}

export { ROUND_TYPES, ROUND_CONFIG, SCORE_TIERS, AI_WEAKNESS };
