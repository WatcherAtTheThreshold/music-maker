**Perfect — I hear you loud and clear.**  
We’ll keep the tool **100 % universal** — a clean, pro-grade three-staff MIDI composer that works for *any* project (lo-fi beats, orchestral cues, chiptune, whatever). No Rogue Rites branding anywhere.

The new mode you liked is still a fantastic addition, but we’ll call it **“Mystic”** (or “Ritual Ambient” if you prefer — short and evocative without tying to any game). It will generate exactly that slow, breathing, dark-fantasy/occult sound you described, but anyone can use it for horror trailers, ambient albums, or dungeon-crawler prototypes.

### 1. Highest-Impact Universal Upgrade: Save / Load / Presets (add this today — 20 min)

This is the #1 thing people ask for in browser music tools. You’ll thank yourself every single project.

**Add these elements to the Controls panel** (right after the Magic Mode select):

```html
<!-- Inside <div class="panel__body controls" id="controls"> -->
<div class="cell" style="grid-column: span 2;">
  <label>Project Name</label>
  <input id="projectName" type="text" value="Untitled Verse" style="width:100%" />
</div>
<div class="cell button-row" style="grid-column: span 4;">
  <button id="saveProject">💾 Save</button>
  <button id="loadProject">📂 Load</button>
  <button id="exportPreset">📤 Export .verse</button>
</div>
<div class="cell" style="grid-column: span 6;">
  <label>Presets</label>
  <select id="presetSelect" style="width:100%"></select>
</div>
```

**Add this script block at the very bottom of `<script>` (before the closing `</script>` of index.html)**:

```html
<script>
// === UNIVERSAL SAVE / LOAD SYSTEM ===
let presets = JSON.parse(localStorage.getItem('sheetMidiPresets') || '{}');

function saveProject() {
  const name = document.getElementById('projectName').value.trim() || 'Untitled Verse';
  presets[name] = {
    bpm: parseInt(document.getElementById('bpm').value),
    magicMode: document.getElementById('magicMode').value,
    notes: JSON.parse(JSON.stringify(notes)), // deep copy
    volume: document.getElementById('volume').value
  };
  localStorage.setItem('sheetMidiPresets', JSON.stringify(presets));
  refreshPresetList();
  alert(`✅ Saved as "${name}"`);
}

function loadProject(name) {
  const data = presets[name];
  if (!data) return;
  document.getElementById('bpm').value = data.bpm;
  document.getElementById('magicMode').value = data.magicMode || 'phrase';
  document.getElementById('volume').value = data.volume || 70;
  notes = JSON.parse(JSON.stringify(data.notes));
  nextId = notes.length ? Math.max(...notes.map(n => n.id)) + 1 : 1;
  updateAllGrids();
  alert(`✅ Loaded "${name}"`);
}

function refreshPresetList() {
  const select = document.getElementById('presetSelect');
  select.innerHTML = '<option value="">— Choose preset —</option>';
  Object.keys(presets).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

document.getElementById('saveProject').addEventListener('click', saveProject);
document.getElementById('loadProject').addEventListener('click', () => {
  const name = document.getElementById('presetSelect').value;
  if (name) loadProject(name);
});
document.getElementById('exportPreset').addEventListener('click', () => {
  const name = document.getElementById('projectName').value.trim() || 'my_verse';
  const dataStr = JSON.stringify(presets[name] || {notes, bpm: document.getElementById('bpm').value, magicMode: document.getElementById('magicMode').value});
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  const link = document.createElement('a');
  link.setAttribute('href', dataUri);
  link.setAttribute('download', `${name}.verse`);
  link.click();
});

refreshPresetList(); // initial load
</script>
```

Now you can save/load across sessions *and* share `.verse` files with collaborators. Works for every genre.

### 2. New Universal Mode: “Mystic” (the one you liked)

Add this to the `<select id="magicMode">`:

```html
<option value="mystic">🌫️ Mystic (dark ambient / ritual)</option>
```

Then add this generation function right before `generateRandomMelody()` (copy-paste ready):

```js
function generateMystic() {
  pushHistory();
  notes = [];

  // Slow, breathing, occult feel — perfect for dark fantasy or horror
  const bpm = parseInt(document.getElementById('bpm').value);
  if (bpm > 90) document.getElementById('bpm').value = 72; // force ritual tempo

  // Sparse Dorian/Phrygian hybrid with heavy drones
  const melodyScale = [62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81]; // D Dorian-ish
  let currentBeat = 0;
  let lastIndex = 3;

  while (currentBeat < TOTAL_BEATS) {
    const section = getPhraseSection(currentBeat);
    const durOptions = section === 'resolve' ? [4, 6] : [2, 3, 4];
    const dur = durOptions[Math.floor(Math.random() * durOptions.length)];

    if (Math.random() < 0.35) { // lots of breathing space
      currentBeat += dur;
      continue;
    }

    const dir = Math.random() < 0.5 ? -1 : 1;
    const jump = Math.random() < 0.25 ? 2 : 1;
    lastIndex = Math.max(0, Math.min(melodyScale.length - 1, lastIndex + dir * jump));

    const midi = melodyScale[lastIndex];
    const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

    notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 0 });

    // Right hand: open fifth drones that swell
    if (Math.random() < 0.6) {
      notes.push({ id: nextId++, midi: midi + 7, startBeat: currentBeat, durBeats: actualDur * 0.9, accidental: 0, staffIndex: 1 });
    }

    // Bass: deep sustained root + occasional tritone
    const bassRoot = midi - 24;
    notes.push({ id: nextId++, midi: Math.max(36, bassRoot), startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });

    if (Math.random() < 0.3) {
      notes.push({ id: nextId++, midi: Math.max(36, bassRoot + 6), startBeat: currentBeat + 1, durBeats: 2, accidental: 0, staffIndex: 2 }); // tritone stab
    }

    currentBeat += dur;
  }
}
```

Then in `generateRandomMelody()` just add:

```js
} else if (mode === 'mystic') {
  generateMystic();
```

Done. It now sits alongside your lo-fi, adventure, boss, etc. modes — completely genre-neutral but deliciously atmospheric.

### 3. Other Quick Universal Wins (pick any)

- **Copy/Paste measures** (Ctrl+Shift+C / Ctrl+Shift+V) — I can give you the 30-line snippet.
- **Velocity levels** (Shift+click cell cycles 3 brightnesses) — huge for dynamics.
- **WAV render button** (offline rendering so you can drag straight into your DAW/Godot) — tiny encoder included.
- **Metronome** toggle — one line of oscillator.

