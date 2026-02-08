// Mulberry32 -- fast, deterministic, 32-bit PRNG
export function createRng(seed) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashDateString(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash;
}

export function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function getPuzzleNumber(dateStr) {
  const epoch = new Date('2026-02-08');
  const today = new Date(dateStr);
  return Math.floor((today - epoch) / 86400000) + 1;
}

// Monotonic play counter — increments each game start, persists in localStorage.
// Mixing this into the seed ensures replays on the same day produce different puzzles.
export function nextPlayId() {
  const id = parseInt(localStorage.getItem('eyeq_playId') || '0', 10) + 1;
  localStorage.setItem('eyeq_playId', String(id));
  return id;
}
