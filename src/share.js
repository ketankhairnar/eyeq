import { getBadge, getElapsedTime } from './game.js';

export function buildShareString(game) {
  const badge = getBadge(game.totalScore);
  const emojiLine = game.rounds.map(r => r.tier.emoji).join('');
  const elapsed = getElapsedTime(game);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return [
    `⚡ EYEQ #${game.puzzleNumber} ⚡`,
    `Human ${game.humanWins} — AI ${game.aiWins}`,
    emojiLine,
    `${badge.name} — ${game.totalScore}/500`,
    `⏱️ ${timeStr}`,
    `eyeq.game`,
  ].join('\n');
}

export async function copyToClipboard(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return true;
    } catch (e) {
      // fall through
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }
}
