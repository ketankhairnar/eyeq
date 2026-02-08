# EYEQ — Tune Your Frequency

**A 2-minute visual perception game where you compete against AI across 8 pseudo-3D estimation challenges. No server. No framework. Pure canvas, pure sound, pure skill.**

---

## What is it?

EYEQ is a daily puzzle game that tests visual estimation — counting particles, judging proportions, reading depth cues — faster and more accurately than an AI opponent. Every day brings a new deterministic puzzle. Every play is a 2-minute sprint across 8 visually distinct rounds.

## Why it's impressive

### 8 Generative Round Types — zero static assets

Every round is procedurally generated on a `<canvas>`. No images, no sprites — just math and pixels.

| Round | What you see | What you estimate |
|-------|-------------|-------------------|
| **Signal Count** | Clustered particle scatter | Total particle count |
| **Field Activity** | Active vs inactive particles | Percentage active |
| **Sector Compare** | Split-screen with size-tricked sectors | Difference between sides |
| **Quadrant Density** | Full-field scatter with highlighted zone | Count in one quadrant |
| **Mass Intercept** | 200-550 particles with scanline noise | Total count under pressure |
| **Depth Field** | Horizontal depth bands with atmospheric perspective | Count in highlighted layer |
| **Tunnel View** | Concentric rings converging to vanishing point | Count in outer ring |
| **3D Cluster** | Fibonacci sphere projected to 2D with depth sort | Count on near hemisphere |

The last 3 types use **pseudo-3D depth effects** — particle size, alpha, and chroma all scale with simulated depth to create atmospheric perspective. A custom `modulateColorChroma()` function parses and scales OKLch chroma values in real-time.

### Fully Deterministic — zero backend

- Same date = same puzzle for every player worldwide
- Mulberry32 PRNG seeded from date hash + monotonic play counter
- Replays on the same day produce fresh sequences (different `playId`)
- Entire game state is client-side — LocalStorage for persistence, no API calls

### AI Opponent with Personality

The AI isn't random noise. Each round type has a **calibrated weakness profile**:

- Count: "Tends to overcount in clusters" (5-15% noise)
- Tunnel: "Confused by radial perspective cues" (10-24% noise)
- Cluster3D: "Misjudges 3D spatial distribution" (9-23% noise)

AI estimates are clamped to the dial range so they feel realistic. Human vs AI wins are tracked per game, creating a competitive narrative.

### Synthesized Audio — zero audio files

All sound is generated live via Web Audio API oscillators:

- **Lock-in:** 600Hz → 800Hz confirmation chord
- **Tier feedback:** Ascending arpeggio (EXACT) → descending sawtooth (MISS)
- **Intro drone:** Layered A1 bass + detuned A3 pad pair + E5 shimmer with 3Hz tremolo
- **Share:** C5 → E5 → G5 ascending scale

### CRT Aesthetic in OKLch Color Space

The entire color system uses **perceptual OKLch** — not RGB, not HSL. Colors are defined in lightness/chroma/hue space for true perceptual uniformity.

Visual layers:
- Scanline overlay (repeating 2px transparent stripes)
- Radial vignette (center-to-edge darkening)
- Gradient mesh backdrop (dual elliptical radials)
- Dynamic ambient border glow that shifts with game state (calm → warning → danger → feedback)

### Interactive Dial

Custom horseshoe gauge (270 arc) with:
- Pointer-tracked indicator with floating value label
- Timer ring that color-shifts as time runs out (cyan → yellow → orange → red)
- Glass reflection highlight (radial crescent)
- 8 round-result dots color-coded by scoring tier
- Feedback mode: shows actual answer needle + score animation

### Tiered Celebrations

Every score gets confetti — scaled from a sad 5-particle poof to a 200-particle fireworks show with side bursts.

### Smooth Transitions

Staggered `fadeSlideIn` animations on round results (each row delayed 40ms). Buttons fade in with 100-300ms delays. All layout containers have CSS transitions on opacity, transform, and height.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Rendering | Canvas 2D | Full control, no DOM overhead for particles |
| Color | OKLch | Perceptually uniform, superior to RGB for gradients |
| Audio | Web Audio API | Zero audio files, dynamic synthesis |
| PRNG | Mulberry32 | Deterministic, fast, cross-browser consistent |
| State | LocalStorage | No server, instant persistence |
| Build | Vite | Fast HMR, minimal config |
| Deploy | Cloudflare Pages | Edge-cached, global CDN |
| Dependencies | 1 (canvas-confetti) | Everything else is hand-rolled |

## Numbers

- **~50KB** minified bundle (1 external dependency)
- **8** procedurally generated round types
- **15s** per round, **2 min** total game time
- **0** API calls, **0** images, **0** audio files
- **149** passing tests (113 game logic + 36 theme validation)
- **3** clipboard fallback methods for universal sharing
- **1** CSS file, **0** frameworks

## The Stack I Didn't Use

No React. No Three.js. No Howler. No Tone.js. No GSAP. No Tailwind. No Firebase.

Just vanilla JS modules, Canvas 2D, Web Audio API, and CSS with OKLch variables. The entire game — 8 generative art modes, synthesized audio, interactive dial, daily puzzle seeding, AI opponent, ambient lighting, CRT effects, sharing — ships in a single Vite bundle under 50KB.

---

**Play it:** [eyeq.game](https://eyeq.game)
