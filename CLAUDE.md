# Music Maker — Claude Code Guide

## Project Overview

A three-machine creative audio studio deployed on GitHub Pages. Each machine is a self-contained vanilla HTML/CSS/JS app with no build step.

**Live URL:** `https://watcheratthethreshold.github.io/music-maker/`

### Machines

| Machine | Directory | Purpose | Audio |
|---------|-----------|---------|-------|
| **8-Bit Beat Builder** | `8bit/` | Retro chiptune loop maker | Tone.js |
| **EDM Maker Pro** | `edm/` | Electronic dance music studio | Tone.js |
| **Sheet Music → MIDI** | `sheet-to-midi/` | Three-staff step sequencer | Web Audio API |

### File Structure

```
index.html          # Landing page hub with links to all three machines
script.js           # Landing page particle animation
style.css           # Landing page styles
images/             # mist-overlay.png (shared atmospheric background)
docs/               # Technical notes and upgrade docs
8bit/               # index.html, script.js, style.css
edm/                # index.html, script.js, style.css
sheet-to-midi/      # index.html, script.js, style.css
```

Each machine is fully self-contained — its own `index.html`, `script.js`, and `style.css`.

## Design System (Mist Aesthetic)

All machines share a common visual language:

- **Background:** `images/mist-overlay.png` fixed overlay at `opacity: 0.8`
- **Fonts:** Cormorant Garamond (display), IBM Plex Mono (UI/labels), Inter (body) via Google Fonts
- **Color palette:** Dark backgrounds (#0a0a0f to #1a1a24), text hierarchy (primary #e8e8f0, secondary #a0a0b0, muted #606070)
- **CSS variables:** All colors, spacing, fonts, and shadows use `:root` custom properties
- **Panels:** Collapsible sections with click-to-toggle headers

### Staff Colors (Sheet to MIDI)

- Melody: blue (`--staff-melody: #a8c8ff`)
- Right Hand: green (`--staff-right: #a8e8c0`)
- Left Hand: amber (`--staff-bass: #ffd8a0`)

## Key Patterns

### Collapsible Panels

**8-bit & EDM:** `.section` with `.section-title` / `.section-content`, toggle via `.collapsed` class
**Sheet to MIDI:** `.panel` with `.panel__head` / `.panel__body`, same toggle pattern

The toggle JS is in an inline `<script>` block at the bottom of each `index.html`.

### Step Sequencer (8-bit & EDM)

- Drum tracks: `Array(32).fill(0)` — velocity values 0–127
- Melody tracks: `Array(32).fill().map(() => ({ note: null, velocity: 70 }))`
- Two pattern slots (A and B) per machine
- Beat markers every 4 steps, visual velocity bars inside cells

### Step Sequencer (Sheet to MIDI)

- Grid-based piano roll with rows = chromatic pitches, columns = time steps
- Notes stored as: `{ id, midi, startBeat, durBeats, accidental, staffIndex }`
- Three staves: Melody (sine), Right Hand (triangle), Left Hand (sawtooth)
- Grid resolution: quarter (32 cols), eighth (64 cols), or sixteenth (128 cols)
- Playhead uses `requestAnimationFrame` synced to `audio.currentTime`

### Audio

- **8-bit & EDM:** Tone.js v14.8.39 via CDN. Effects chain: synth → bitcrusher → filter → delay → reverb → destination
- **Sheet to MIDI:** Raw Web Audio API oscillators (no Tone.js). Each note creates an oscillator with envelope shaping
- Audio context must be created on user interaction (browser autoplay policy)

### MIDI Export

All three machines export MIDI files. The binary encoding is custom (no library):
- Format 1 (multi-track, synchronous)
- TPQ = 480 ticks per quarter note
- VLQ (variable-length quantity) encoding for delta times
- Downloads via Blob URL

## Conventions

- **No frameworks, no build step** — vanilla HTML/CSS/JS only
- **ES6 patterns** — IIFEs wrapping each machine, `const`/`let`, arrow functions, template literals
- **CSS custom properties** in `:root` for all theming
- **Responsive breakpoints** at 768px and 1200px (desktop-primary)
- **Keyboard shortcuts:** Space (play/pause in 8-bit/EDM), Ctrl+Z (undo in sheet-to-midi)
- **requestAnimationFrame** for all real-time visual updates (playheads, animations)

### Magic Generation (Sheet to MIDI)

Nine modes, each with its own hardcoded native key. All scales/chords are transposed at generation time by `getKeyOffset()` — never stored as transposed values.

| Mode | Native root | `#keyShift` to reach C |
|------|------------|------------------------|
| Phrase / Loop / Drift | C major | 0 |
| Victory | C major | 0 |
| Lo-fi | C jazz/blues | 0 |
| Fantasy | D Dorian | −2 |
| Mystic | D Dorian | −2 |
| Boss Battle | D Phrygian | −2 |
| Adventure | E minor | −4 |

**Transposition utilities** (all in `sheet-to-midi/script.js`):
- `getKeyOffset()` — reads `#keyShift` select (−6 to +6)
- `transposeArr(arr, n)` — flat note array
- `transposeChords(sections, n)` — `{ section: [[midi...]] }` chord maps
- `transposeRoots(sections, n)` — `{ section: [midi...] }` root maps

The native root labels are displayed directly in the Magic Mode `<select>` options so the user always knows the offset needed for DAW compatibility.

## Common Pitfalls

- The mist overlay image path is relative (`../images/mist-overlay.png`) — keep the directory structure intact
- Font URLs are loaded from Google Fonts CDN — pages need internet access
- Tone.js is loaded from CDN in 8-bit and EDM but is NOT used in sheet-to-midi
- The collapsible panel JS is in inline `<script>` tags, not in the main `script.js` files
- Magic generation in sheet-to-midi uses beat-based durations (e.g., `durBeats: 1` = quarter note) — these must align with grid resolution when displayed
- Scale constants (`DORIAN_MELODY`, `LOFI_MELODY`, etc.) are **function-local**, not module-level — they live inside their respective `generate*` functions and are transposed fresh on each Magic call

## Docs

- `docs/infinite-loop-problem.md` — Bug analysis for sheet-to-midi Magic generation
- `docs/sheet-to-midi-magic-upgrade.md` — Phrase-aware generation design + Key Shift feature (Mar 2026)
