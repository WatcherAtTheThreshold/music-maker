/* ====================================================
   SHEET MUSIC TO MIDI - THREE-STAFF SYSTEM
   Melody + Right Hand (Treble) + Left Hand (Bass)
   ==================================================== */

(() => {
  /* === MUSICAL CONSTANTS === */
  const TPQ = 480;        // ticks per quarter note for MIDI
  const MEASURES = 8;     // visible measures (doubled for phrase-aware generation)
  const TIME_SIG_NUM = 4; // 4/4 time signature
  const TIME_SIG_DEN = 4;
  const TOTAL_BEATS = MEASURES * TIME_SIG_NUM;

  /* === STAFF CONFIGURATION === */
  const STAVES = [
    { name: 'Melody', clef: 'treble', midiRange: [60, 81], channel: 0, color: '#cfe0ff', waveform: 'sine' },
    { name: 'Right Hand', clef: 'treble', midiRange: [60, 81], channel: 1, color: '#a5d6a7', waveform: 'triangle' },
    { name: 'Left Hand', clef: 'bass', midiRange: [36, 64], channel: 2, color: '#ffcc80', waveform: 'sawtooth' }
  ];

  /* === SVG LAYOUT CONSTANTS === */
  const svg = document.getElementById('staff');
  const W = 4200, H = 1400; // viewBox units (wider for 8 measures, optimized for 3 staves)
  const PADDING = { l: 120, r: 60, t: 30, b: 30 };
  const innerW = W - PADDING.l - PADDING.r;
  const innerH = H - PADDING.t - PADDING.b;

  /* === STAFF POSITIONING === */
  const staffGap = 28;      // distance between staff lines (larger for bigger staves)
  const staffLines = 5;
  const staffHeight = (staffLines - 1) * staffGap; // 112px per staff
  const staffSpacing = 420; // vertical distance between staff tops (more space)
  const firstStaffTop = PADDING.t + 100;

  // Calculate staff top position
  function getStaffTop(staffIndex) {
    return firstStaffTop + staffIndex * staffSpacing;
  }

  function getStaffBottom(staffIndex) {
    return getStaffTop(staffIndex) + staffHeight;
  }

  // Determine which staff a Y coordinate is on
  function getStaffForY(y) {
    for (let i = 0; i < STAVES.length; i++) {
      const top = getStaffTop(i) - staffGap * 4; // ledger line area above
      const bottom = getStaffBottom(i) + staffGap * 4; // ledger line area below
      if (y >= top && y <= bottom) {
        return i;
      }
    }
    // Return closest staff if between staves
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < STAVES.length; i++) {
      const center = getStaffTop(i) + staffHeight / 2;
      const dist = Math.abs(y - center);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    return closest;
  }

  /* === PITCH AND NOTE SYSTEM === */
  const NOTE_ORDER = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  function midiToName(n) {
    const name = NOTE_ORDER[n % 12];
    const oct = Math.floor(n/12) - 1;
    return name + oct;
  }

  /* === COORDINATE MAPPING FUNCTIONS === */

  // Convert MIDI note to staff Y position for a specific staff
  function midiToStaffY(midi, staffIndex) {
    const staff = STAVES[staffIndex];
    const staffTop = getStaffTop(staffIndex);
    const staffBottom = getStaffBottom(staffIndex);

    if (staff.clef === 'treble') {
      return midiToTrebleY(midi, staffTop, staffBottom);
    } else {
      return midiBassY(midi, staffTop, staffBottom);
    }
  }

  // Treble clef: E4 (64) on bottom line
  function midiToTrebleY(midi, staffTop, staffBottom) {
    const naturals = { 'C': -2, 'D': -1, 'E': 0, 'F': 1, 'G': 2, 'A': 3, 'B': 4 };

    const semitone = midi % 12;
    const oct = Math.floor(midi / 12) - 1;
    const baseName = NOTE_ORDER[semitone];
    const natural = baseName[0];

    const NAT_TO_SEMI = { 'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11 };
    const naturalSemi = NAT_TO_SEMI[natural];
    const naturalMidi = (oct+1)*12 + naturalSemi;

    const stepsFromE4 = diatonicDistance(64, naturalMidi, 'E', natural);
    let y = staffBottom - stepsFromE4 * (staffGap/2);

    return y;
  }

  // Bass clef: G2 (43) on bottom line, or A2 (45) on first space
  // F3 (53) on 4th line from bottom
  function midiBassY(midi, staffTop, staffBottom) {
    // In bass clef: G2 = bottom line (midi 43)
    // Each diatonic step up moves up half a staffGap
    const naturals = { 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6 };

    const semitone = midi % 12;
    const oct = Math.floor(midi / 12) - 1;
    const baseName = NOTE_ORDER[semitone];
    const natural = baseName[0];

    const NAT_TO_SEMI = { 'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11 };
    const naturalSemi = NAT_TO_SEMI[natural];
    const naturalMidi = (oct+1)*12 + naturalSemi;

    // G2 (midi 43) sits on bottom line of bass clef
    const stepsFromG2 = diatonicDistance(43, naturalMidi, 'G', natural);
    let y = staffBottom - stepsFromG2 * (staffGap/2);

    return y;
  }

  function diatonicDistance(m1, m2, letter1, letter2) {
    const LETTERS = ['C','D','E','F','G','A','B'];
    function nextLetter(l){ return LETTERS[(LETTERS.indexOf(l)+1)%7]; }

    let steps = 0;
    let L = letter1;
    let midiN = m1;
    const semis = { 'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11 };

    while (!(L===letter2 && midiN===m2)){
      const nextL = nextLetter(L);
      let oct = Math.floor(midiN/12) - 1;
      let candidate = (Math.floor((midiN+1)/12))*12 + semis[nextL];
      while (candidate <= midiN) candidate += 12;
      L = nextL;
      midiN = candidate;
      steps++;
      if (steps>100) break;
    }
    return steps * ( (m2>=m1)? 1 : -1 );
  }

  // Quantize Y coordinate to closest supported MIDI note for a specific staff
  function quantizeYToMidi(y, staffIndex) {
    const staff = STAVES[staffIndex];
    const [minMidi, maxMidi] = staff.midiRange;

    let best = minMidi;
    let bestDist = 1e9;

    for (let m = minMidi; m <= maxMidi; m++) {
      const yy = midiToStaffY(m, staffIndex);
      const d = Math.abs(y - yy);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    return best;
  }

  /* === TIME GRID FUNCTIONS === */

  function xForBeat(beat) {
    return PADDING.l + (beat / TOTAL_BEATS) * innerW;
  }

  function beatForX(x) {
    const rel = (x - PADDING.l) / innerW;
    const rawBeat = rel * TOTAL_BEATS;
    const snap = parseInt(document.getElementById('snap').value, 10);
    const stepBeat = 4 / snap;
    return Math.max(0, Math.min(TOTAL_BEATS, Math.round(rawBeat/stepBeat)*stepBeat));
  }

  /* === APPLICATION STATE === */
  let notes = []; // { id, midi, startBeat, durBeats, accidental, staffIndex }
  let selectedId = null;
  let nextId = 1;
  const history = [];
  let activeStaff = 0; // Currently selected staff for new notes

  /* === HISTORY MANAGEMENT === */

  function pushHistory() {
    history.push(JSON.stringify(notes));
    if (history.length > 100) history.shift();
  }

  function undo() {
    if (history.length) {
      notes = JSON.parse(history.pop());
      selectedId = null;
      render();
    }
  }

  /* === RENDERING FUNCTIONS === */

  function render() {
    const g = [];

    renderSVGDefinitions(g);

    // Render each staff
    for (let i = 0; i < STAVES.length; i++) {
      renderStaff(g, i);
    }

    // Render all notes
    renderAllNotes(g);

    svg.innerHTML = g.join('\n');
  }

  function renderSVGDefinitions(g) {
    g.push(`<defs>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".6"/>
      </filter>
    </defs>`);
  }

  function renderStaff(g, staffIndex) {
    const staff = STAVES[staffIndex];
    const staffTop = getStaffTop(staffIndex);
    const staffBottom = getStaffBottom(staffIndex);

    // Background panel
    g.push(`<rect x="${PADDING.l-50}" y="${staffTop-70}" width="${innerW+100}" height="${staffHeight+140}" rx="14" ry="14" fill="#0d1320" stroke="#1f2a3a"/>`);

    // Measure grid shading
    for (let i = 0; i < MEASURES; i++) {
      const x0 = xForBeat(i*4), x1 = xForBeat((i+1)*4);
      g.push(`<rect x="${x0}" y="${staffTop-45}" width="${x1-x0}" height="${staffHeight+90}" fill="${i%2? '#0b1220':'#0a101a'}" opacity=".45"/>`);
    }

    // Pitch guides
    renderPitchGuides(g, staffIndex);

    // Staff lines
    for (let i = 0; i < staffLines; i++) {
      const y = staffTop + i * staffGap;
      g.push(`<line x1="${PADDING.l}" y1="${y}" x2="${W-PADDING.r}" y2="${y}" stroke="#cfe0ff" stroke-opacity=".7" stroke-width="2" />`);
    }

    // Beat tick marks
    for (let b = 0; b <= TOTAL_BEATS; b++) {
      const x = xForBeat(b);
      const isBar = (b % TIME_SIG_NUM) === 0;
      g.push(`<line x1="${x}" y1="${staffTop-45}" x2="${x}" y2="${staffBottom+45}" stroke="${isBar? '#6aa2ff':'#35507a'}" stroke-opacity="${isBar? .8:.35}" stroke-width="${isBar? 3:1.5}" />`);
    }

    // Measure numbers (only on first staff)
    if (staffIndex === 0) {
      for (let b = 0; b < TOTAL_BEATS; b += 4) {
        const x = xForBeat(b) + (xForBeat(b+4) - xForBeat(b)) / 2;
        const measureNum = Math.floor(b / 4) + 1;
        g.push(`<text x="${x}" y="${staffTop - 80}" fill="#6aa2ff" font-size="20" text-anchor="middle" font-family="monospace">${measureNum}</text>`);
      }
    }

    // Staff label
    const labelColor = staff.color;
    g.push(`<text x="${PADDING.l - 105}" y="${staffTop + staffHeight/2 - 20}" fill="${labelColor}" font-size="14" text-anchor="end" font-family="monospace">${staff.name}</text>`);

    // Active indicator
    if (staffIndex === activeStaff) {
      g.push(`<circle cx="${PADDING.l - 105}" cy="${staffTop + staffHeight/2 + 8}" r="6" fill="${labelColor}" opacity="0.8"/>`);
    }

    // Clef
    if (staff.clef === 'treble') {
      renderTrebleClef(g, staffTop);
    } else {
      renderBassClef(g, staffTop);
    }

    // Note labels on left (only show a few key notes)
    renderNoteLabels(g, staffIndex);
  }

  function renderPitchGuides(g, staffIndex) {
    const staffTop = getStaffTop(staffIndex);
    const staffBottom = getStaffBottom(staffIndex);
    // Limit guides to just 1-2 ledger lines above/below staff (within background panel)
    const noteAreaTop = staffTop - staffGap * 1.5;
    const noteAreaBottom = staffBottom + staffGap * 1.5;

    for (let y = noteAreaTop; y <= noteAreaBottom; y += staffGap / 2) {
      const isOnStaffLine = (y >= staffTop && y <= staffBottom &&
        Math.abs((y - staffTop) % staffGap) < 1);

      if (!isOnStaffLine) {
        g.push(`<line x1="${PADDING.l}" y1="${y}" x2="${W-PADDING.r}" y2="${y}" stroke="#2a3a4a" stroke-opacity=".15" stroke-width="1" stroke-dasharray="6,12" />`);
      }
    }
  }

  function renderTrebleClef(g, staffTop) {
    g.push(`<text x="${PADDING.l - 75}" y="${staffTop + staffGap*3.2}" fill="#cfe0ff" font-size="95" font-family="'Segoe UI Symbol', 'Noto Emoji', sans-serif">𝄞</text>`);
  }

  function renderBassClef(g, staffTop) {
    // Bass clef symbol (F clef) - using Unicode
    g.push(`<text x="${PADDING.l - 75}" y="${staffTop + staffGap*2.5}" fill="#cfe0ff" font-size="75" font-family="'Segoe UI Symbol', 'Noto Emoji', sans-serif">𝄢</text>`);
  }

  function renderNoteLabels(g, staffIndex) {
    const staff = STAVES[staffIndex];
    const staffTop = getStaffTop(staffIndex);
    const staffBottom = getStaffBottom(staffIndex);

    // Key reference notes for each clef
    let noteLabels;
    if (staff.clef === 'treble') {
      noteLabels = [
        { midi: 79, label: 'G5' },
        { midi: 72, label: 'C5' },
        { midi: 67, label: 'G4' },
        { midi: 60, label: 'C4' }
      ];
    } else {
      noteLabels = [
        { midi: 60, label: 'C4' },
        { midi: 53, label: 'F3' },
        { midi: 48, label: 'C3' },
        { midi: 41, label: 'F2' }
      ];
    }

    for (const nl of noteLabels) {
      if (nl.midi >= staff.midiRange[0] && nl.midi <= staff.midiRange[1]) {
        const y = midiToStaffY(nl.midi, staffIndex);
        if (y >= staffTop - staffGap * 2 && y <= staffBottom + staffGap * 2) {
          g.push(`<text x="${W - PADDING.r + 15}" y="${y + 5}" fill="#4a6a8a" font-size="13" text-anchor="start" font-family="monospace">${nl.label}</text>`);
        }
      }
    }
  }

  function renderAllNotes(g) {
    for (const n of notes) {
      renderSingleNote(g, n);
    }
  }

  function renderSingleNote(g, n) {
    const staff = STAVES[n.staffIndex];
    const x = xForBeat(n.startBeat) + 25;
    const y = midiToStaffY(n.midi, n.staffIndex);
    const w = 22, h = 16; // larger note heads
    const sel = n.id === selectedId;
    const color = sel ? '#ffffff' : staff.color;

    // Render ledger lines if needed
    renderLedgerLines(g, n.midi, x, n.staffIndex);

    // Render accidental
    renderAccidental(g, n, x, y, color);

    // Render note head
    renderNoteHead(g, x, y, w, h, color);

    // Render stem
    renderNoteStem(g, n, x, y, w, color);

    // Render duration indicator
    renderDurationIndicator(g, n, x, y);
  }

  function renderLedgerLines(g, midi, x, staffIndex) {
    const staff = STAVES[staffIndex];
    const staffTop = getStaffTop(staffIndex);
    const staffBottom = getStaffBottom(staffIndex);
    const yNote = midiToStaffY(midi, staffIndex);

    // Collect ledger line positions
    const ledgerYs = [];

    // Check for ledger lines below staff
    if (yNote > staffBottom + 2) {
      for (let y = staffBottom + staffGap; y <= yNote + staffGap/4; y += staffGap) {
        ledgerYs.push(y);
      }
    }

    // Check for ledger lines above staff
    if (yNote < staffTop - 2) {
      for (let y = staffTop - staffGap; y >= yNote - staffGap/4; y -= staffGap) {
        ledgerYs.push(y);
      }
    }

    for (const ly of ledgerYs) {
      g.push(`<line x1="${x-16}" y1="${ly}" x2="${x+16}" y2="${ly}" stroke="#cfe0ff" stroke-width="2.5" />`);
    }
  }

  function renderAccidental(g, n, x, y, color) {
    if (n.accidental === 1) {
      g.push(`<text x="${x-30}" y="${y+7}" fill="${color}" font-size="26">#</text>`);
    } else if (n.accidental === -1) {
      g.push(`<text x="${x-30}" y="${y+7}" fill="${color}" font-size="26">♭</text>`);
    }
  }

  function renderNoteHead(g, x, y, w, h, color) {
    g.push(`<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${h}" fill="${color}" stroke="#7fa2c4" stroke-width="1" filter="url(#soft)" />`);
  }

  function renderNoteStem(g, n, x, y, w, color) {
    const staff = STAVES[n.staffIndex];
    // Stem direction based on note position relative to middle of staff
    const staffTop = getStaffTop(n.staffIndex);
    const staffMiddle = staffTop + staffHeight / 2;
    const up = y > staffMiddle;

    if (up) {
      g.push(`<line x1="${x+w-3}" y1="${y}" x2="${x+w-3}" y2="${y-55}" stroke="${color}" stroke-width="2.5" />`);
    } else {
      g.push(`<line x1="${x-w+3}" y1="${y}" x2="${x-w+3}" y2="${y+55}" stroke="${color}" stroke-width="2.5" />`);
    }
  }

  function renderDurationIndicator(g, n, x, y) {
    const durTxt = durationText(n.durBeats);
    g.push(`<text x="${x-10}" y="${y+38}" fill="#5a7a9a" font-size="14">${durTxt}</text>`);
  }

  function durationText(d) {
    if (d >= 4) return 'w';
    if (d >= 2) return 'h';
    if (d >= 1) return 'q';
    if (d >= 0.5) return 'e';
    return 's';
  }

  /* === EVENT HANDLING === */

  function handleStaffClick(e) {
    const pt = clientPoint(e);
    const tool = document.getElementById('tool').value;
    const acc = parseInt(document.getElementById('accidental').value, 10);

    if (pt.x < PADDING.l || pt.x > W - PADDING.r) return;

    // Determine which staff was clicked
    const clickedStaff = getStaffForY(pt.y);
    activeStaff = clickedStaff;
    updateStaffSelector();

    const beat = beatForX(pt.x);
    const midi = quantizeYToMidi(pt.y, clickedStaff);

    // Check if clicking on existing note
    const near = findNearbyNote(beat, midi, clickedStaff);

    if (tool === 'erase') {
      handleEraseAction(near);
      return;
    }

    if (near) {
      selectedId = near.id;
      render();
      return;
    }

    createNewNote(beat, midi, acc, clickedStaff);
  }

  function findNearbyNote(beat, midi, staffIndex) {
    return notes.find(n =>
      n.staffIndex === staffIndex &&
      Math.abs(n.startBeat - beat) < 0.1 &&
      Math.abs(midiToStaffY(n.midi, staffIndex) - midiToStaffY(midi, staffIndex)) < 10
    );
  }

  function handleEraseAction(note) {
    if (note) {
      pushHistory();
      notes = notes.filter(n => n !== note);
      selectedId = null;
      render();
    }
  }

  function createNewNote(beat, midi, accidental, staffIndex) {
    pushHistory();
    const snap = parseInt(document.getElementById('snap').value, 10);
    const durBeats = 4 / snap;
    const n = {
      id: nextId++,
      midi,
      startBeat: beat,
      durBeats,
      accidental,
      staffIndex
    };
    notes.push(n);
    selectedId = n.id;
    render();
  }

  function handleKeyDown(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelectedNote();
    }
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      undo();
    }
    // Number keys to switch active staff
    if (e.key === '1') { activeStaff = 0; updateStaffSelector(); render(); }
    if (e.key === '2') { activeStaff = 1; updateStaffSelector(); render(); }
    if (e.key === '3') { activeStaff = 2; updateStaffSelector(); render(); }
  }

  function deleteSelectedNote() {
    if (selectedId != null) {
      pushHistory();
      notes = notes.filter(n => n.id !== selectedId);
      selectedId = null;
      render();
    }
  }

  function updateStaffSelector() {
    const selector = document.getElementById('activeStaff');
    if (selector) {
      selector.value = activeStaff;
    }
  }

  /* === PLAYBACK FUNCTIONS === */

  let audio = null;
  let masterGain = null;
  let isPlaying = false;
  let isLooping = false;
  let activeOscillators = [];
  let playbackTimeout = null;
  let masterVolume = 0.7;

  function togglePlay() {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }

  function startPlayback() {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audio.createGain();
      masterGain.connect(audio.destination);
      masterGain.gain.value = masterVolume;
    }
    if (!notes.length) return;

    if (audio.state === 'suspended') {
      audio.resume();
    }

    isPlaying = true;
    updatePlayButton();
    playOnce();
  }

  function playOnce() {
    if (!isPlaying) return;

    const bpm = parseInt(document.getElementById('bpm').value, 10);
    const secPerBeat = 60 / bpm;
    const startT = audio.currentTime + 0.05;
    const totalDuration = TOTAL_BEATS * secPerBeat;

    for (const n of notes) {
      const oscData = playNoteAudio(n, startT, secPerBeat);
      activeOscillators.push(oscData);
    }

    if (isLooping) {
      playbackTimeout = setTimeout(() => {
        if (isPlaying && isLooping) {
          playOnce();
        }
      }, totalDuration * 1000);
    } else {
      playbackTimeout = setTimeout(() => {
        if (isPlaying && !isLooping) {
          stopPlayback();
        }
      }, totalDuration * 1000 + 100);
    }
  }

  function stopPlayback() {
    isPlaying = false;

    if (playbackTimeout) {
      clearTimeout(playbackTimeout);
      playbackTimeout = null;
    }

    const now = audio ? audio.currentTime : 0;
    for (const oscData of activeOscillators) {
      try {
        oscData.gain.gain.cancelScheduledValues(now);
        oscData.gain.gain.setValueAtTime(oscData.gain.gain.value, now);
        oscData.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        oscData.osc.stop(now + 0.06);
      } catch (e) {}
    }
    activeOscillators = [];

    updatePlayButton();
  }

  function toggleLoop() {
    isLooping = !isLooping;
    updateLoopButton();
  }

  function updatePlayButton() {
    const btn = document.getElementById('play');
    if (isPlaying) {
      btn.textContent = 'Stop';
      btn.classList.remove('green');
      btn.classList.add('playing');
    } else {
      btn.textContent = 'Play';
      btn.classList.add('green');
      btn.classList.remove('playing');
    }
  }

  function updateLoopButton() {
    const btn = document.getElementById('loop');
    if (btn) {
      btn.classList.toggle('active', isLooping);
    }
  }

  function playNoteAudio(note, startTime, secPerBeat) {
    const staff = STAVES[note.staffIndex];
    const t0 = startTime + note.startBeat * secPerBeat;
    const t1 = t0 + note.durBeats * secPerBeat;
    const freq = 440 * Math.pow(2, (note.midi - 69) / 12);

    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.frequency.value = freq;
    osc.type = staff.waveform;

    // Adjust volume based on waveform (sawtooth is louder)
    const baseVol = staff.waveform === 'sawtooth' ? 0.1 : 0.2;

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(baseVol, t0 + 0.01);
    gain.gain.setValueAtTime(baseVol, t1 - 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);

    osc.connect(gain).connect(masterGain || audio.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);

    return { osc, gain };
  }

  /* === MIDI EXPORT FUNCTIONS === */

  function exportMIDI() {
    if (!notes.length) {
      downloadBytes(new Uint8Array([]), 'empty.mid');
      return;
    }

    const bpm = parseInt(document.getElementById('bpm').value, 10);
    const microPerQuarter = Math.round(60000000 / bpm);

    // Build Format 1 MIDI with separate tracks for each staff
    const midiData = buildMultiTrackMIDI(microPerQuarter);

    downloadBytes(midiData, 'score.mid');
  }

  function vlq(value) {
    const bytes = [];
    let val = Math.max(0, (value|0) >>> 0);
    const stack = [];
    do {
      stack.push(val & 0x7F);
      val >>>= 7;
    } while (val > 0);
    while (stack.length) {
      const b = stack.pop();
      bytes.push(stack.length ? (b | 0x80) : b);
    }
    return bytes;
  }

  function beatToTicks(b) {
    return Math.round(b * TPQ);
  }

  function buildMultiTrackMIDI(microPerQuarter) {
    // Create tempo/conductor track (Track 0)
    const tempoTrack = buildTempoTrack(microPerQuarter);

    // Create one track per staff (Tracks 1-3)
    const staffTracks = STAVES.map((staff, staffIndex) => {
      const staffNotes = notes.filter(n => n.staffIndex === staffIndex);
      return buildStaffTrack(staffNotes, staff, staffIndex);
    });

    // Combine all tracks
    const allTracks = [tempoTrack, ...staffTracks];

    return wrapInSMFFormat1(allTracks);
  }

  function buildTempoTrack(microPerQuarter) {
    const events = [];

    function pushBytes(...arr) {
      for (const x of arr) events.push(x);
    }

    // Set tempo at delta time 0
    pushBytes(...vlq(0), 0xFF, 0x51, 0x03,
               (microPerQuarter>>16)&255,
               (microPerQuarter>>8)&255,
               microPerQuarter&255);

    // Time signature 4/4
    pushBytes(...vlq(0), 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

    // End of track
    pushBytes(...vlq(0), 0xFF, 0x2F, 0x00);

    return new Uint8Array(events);
  }

  function buildStaffTrack(staffNotes, staff, staffIndex) {
    const events = [];

    function pushBytes(...arr) {
      for (const x of arr) events.push(x);
    }

    // Track name meta event
    const trackName = staff.name;
    const nameBytes = [];
    for (let i = 0; i < trackName.length; i++) {
      nameBytes.push(trackName.charCodeAt(i));
    }
    pushBytes(...vlq(0), 0xFF, 0x03, nameBytes.length, ...nameBytes);

    // Program change to set instrument (optional, helps DAWs distinguish tracks)
    // Channel 0 = Piano (program 0), Channel 1 = Strings (program 48), Channel 2 = Bass (program 32)
    const programs = [0, 48, 32]; // Piano, Strings, Acoustic Bass
    const channel = staff.channel;
    pushBytes(...vlq(0), 0xC0 | channel, programs[staffIndex] || 0);

    if (staffNotes.length === 0) {
      // No notes, just end the track
      pushBytes(...vlq(0), 0xFF, 0x2F, 0x00);
      return new Uint8Array(events);
    }

    // Sort notes by start time
    const sortedNotes = [...staffNotes].sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);

    // Create all note events
    const allEvents = [];
    for (const n of sortedNotes) {
      const onTick = beatToTicks(n.startBeat);
      const offTick = beatToTicks(n.startBeat + n.durBeats);
      const velocity = 96;
      const midiVal = Math.max(0, Math.min(127, (n.midi + (n.accidental||0))|0));

      allEvents.push({ tick: onTick, type: 'on', midi: midiVal, velocity });
      allEvents.push({ tick: offTick, type: 'off', midi: midiVal });
    }

    // Sort by tick time, with note-offs before note-ons at same tick
    allEvents.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      // Note-offs before note-ons at same tick
      if (a.type === 'off' && b.type === 'on') return -1;
      if (a.type === 'on' && b.type === 'off') return 1;
      return 0;
    });

    // Convert to delta times and write events
    let cursor = 0;
    for (const evt of allEvents) {
      const delta = Math.max(0, evt.tick - cursor);
      if (evt.type === 'on') {
        pushBytes(...vlq(delta), 0x90 | channel, evt.midi, evt.velocity);
      } else {
        pushBytes(...vlq(delta), 0x80 | channel, evt.midi, 0x40);
      }
      cursor = evt.tick;
    }

    // End of track
    pushBytes(...vlq(0), 0xFF, 0x2F, 0x00);

    return new Uint8Array(events);
  }

  function wrapInSMFFormat1(tracks) {
    function u32(n) { return [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]; }
    function u16(n) { return [(n>>>8)&255,n&255]; }

    // Header chunk for Format 1
    const header = [
      0x4d, 0x54, 0x68, 0x64,  // "MThd"
      ...u32(6),                // Header length
      ...u16(1),                // Format type 1 (multiple tracks, synchronous)
      ...u16(tracks.length),    // Number of tracks
      ...u16(TPQ),              // Ticks per quarter note
    ];

    // Calculate total size
    let totalSize = header.length;
    for (const track of tracks) {
      totalSize += 8 + track.length; // 8 bytes for track header
    }

    const full = new Uint8Array(totalSize);
    let offset = 0;

    // Write header
    full.set(header, offset);
    offset += header.length;

    // Write each track
    for (const trackData of tracks) {
      const trackHeader = [
        0x4d, 0x54, 0x72, 0x6b,  // "MTrk"
        ...u32(trackData.length),
      ];
      full.set(trackHeader, offset);
      offset += trackHeader.length;
      full.set(trackData, offset);
      offset += trackData.length;
    }

    return full;
  }

  /* === UTILITY FUNCTIONS === */

  function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], {type: 'audio/midi'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function clientPoint(evt) {
    const rect = svg.getBoundingClientRect();
    const x = (evt.clientX - rect.left) * (W / rect.width);
    const y = (evt.clientY - rect.top) * (H / rect.height);
    return {x, y};
  }

  function clearAllNotes() {
    pushHistory();
    notes = [];
    selectedId = null;
    render();
  }

  /* === PHRASE-AWARE MELODY GENERATION === */

  // Get the current Magic mode from UI
  function getMagicMode() {
    const selector = document.getElementById('magicMode');
    return selector ? selector.value : 'phrase';
  }

  // Determine which phrase section a beat falls into (for 8-bar phrases)
  // Returns: 'establish' (bars 1-2), 'vary' (bars 3-4), 'contrast' (bars 5-6), 'resolve' (bars 7-8)
  function getPhraseSection(beat) {
    const bar = Math.floor(beat / 4);
    if (bar < 2) return 'establish';
    if (bar < 4) return 'vary';
    if (bar < 6) return 'contrast';
    return 'resolve';
  }

  function generateRandomMelody() {
    pushHistory();
    notes = [];
    selectedId = null;

    const mode = getMagicMode();

    // Generate for all three staves with mode-aware logic
    generateMelodyStaff(mode);
    generateRightHandStaff(mode);
    generateBassStaff(mode);

    render();
  }

  // Staff 0: Melody - phrase-aware melodic line
  function generateMelodyStaff(mode) {
    const scale = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81]; // C major

    // Different rhythm patterns for different sections
    const rhythmsBySection = {
      establish: [[1, 1, 1, 1], [2, 1, 1], [1, 0.5, 0.5, 1, 1]],
      vary: [[1, 1, 2], [0.5, 0.5, 1, 0.5, 0.5, 1], [1, 1, 1, 1]],
      contrast: [[2, 2], [1, 1, 1, 1], [0.5, 0.5, 0.5, 0.5, 1, 1]],
      resolve: [[2, 1, 1], [4], [2, 2], [1, 1, 2]]
    };

    // Mode-specific behavior
    const modeConfig = {
      loop: { restChance: 0.15, motifRepeat: true, densityMultiplier: 1.2 },
      phrase: { restChance: 0.2, motifRepeat: false, densityMultiplier: 1.0 },
      drift: { restChance: 0.4, motifRepeat: false, densityMultiplier: 0.6 }
    };
    const config = modeConfig[mode];

    let currentBeat = 0;
    let lastIndex = Math.floor(scale.length / 2);
    let motif = []; // Store first 2 bars for potential repeat

    // In loop mode, first generate the motif (bars 1-2), then copy it
    if (mode === 'loop') {
      // Generate bars 1-2 (beats 0-7)
      while (currentBeat < 8) {
        const patterns = rhythmsBySection.establish;
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];

        for (const dur of pattern) {
          if (currentBeat >= 8) break;

          if (Math.random() < config.restChance) {
            currentBeat += dur;
            continue;
          }

          const step = Math.random() < 0.5 ? -1 : 1;
          const jump = Math.floor(Math.random() * 2) + 1;
          lastIndex = Math.max(0, Math.min(scale.length - 1, lastIndex + step * jump));

          const midi = scale[lastIndex];
          const actualDur = Math.min(dur, 8 - currentBeat);

          if (actualDur > 0) {
            notes.push({
              id: nextId++,
              midi,
              startBeat: currentBeat,
              durBeats: actualDur,
              accidental: 0,
              staffIndex: 0
            });
            motif.push({ midi, startBeat: currentBeat, durBeats: actualDur });
          }
          currentBeat += dur;
        }
      }

      // Copy motif to bars 3-4 (beats 8-15), 5-6 (beats 16-23), 7-8 (beats 24-31)
      for (let repeatOffset of [8, 16, 24]) {
        for (const m of motif) {
          // Slight variation chance
          const newMidi = m.midi + (Math.random() < 0.2 ? (Math.random() < 0.5 ? 2 : -2) : 0);
          notes.push({
            id: nextId++,
            midi: Math.max(60, Math.min(81, newMidi)),
            startBeat: m.startBeat + repeatOffset,
            durBeats: m.durBeats,
            accidental: 0,
            staffIndex: 0
          });
        }
      }
      return; // Done with loop mode
    }

    // Phrase and Drift modes - generate section by section
    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];

      for (const dur of pattern) {
        if (currentBeat >= TOTAL_BEATS) break;

        // Rest chance varies by section and mode
        let restChance = config.restChance;
        if (section === 'resolve') restChance += 0.15; // More space at end
        if (section === 'contrast' && mode === 'phrase') restChance += 0.1;

        if (Math.random() < restChance) {
          currentBeat += dur;
          continue;
        }

        // Stepwise motion with occasional leaps
        const leapChance = section === 'contrast' ? 0.3 : 0.15;
        const step = Math.random() < 0.5 ? -1 : 1;
        const jump = Math.random() < leapChance ? Math.floor(Math.random() * 3) + 2 : 1;
        lastIndex = Math.max(0, Math.min(scale.length - 1, lastIndex + step * jump));

        // In resolve section, tend toward root (C)
        if (section === 'resolve' && Math.random() < 0.4) {
          lastIndex = Math.max(0, lastIndex - 1); // Move toward lower C
        }

        const midi = scale[lastIndex];
        const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

        if (actualDur > 0) {
          notes.push({
            id: nextId++,
            midi,
            startBeat: currentBeat,
            durBeats: actualDur,
            accidental: 0,
            staffIndex: 0
          });
        }
        currentBeat += dur;
      }
    }
  }

  // Staff 1: Right Hand - staggered chord accompaniment
  function generateRightHandStaff(mode) {
    const chordProgressions = {
      establish: [[60, 64, 67], [65, 69, 72]], // C, F
      vary: [[67, 71, 74], [64, 67, 71]],      // G, Em
      contrast: [[69, 72, 76], [62, 65, 69]],  // Am, Dm
      resolve: [[67, 71, 74], [60, 64, 67]]    // G, C
    };

    // Loop mode: generate 2 bars, then repeat
    if (mode === 'loop') {
      const motif = [];
      let currentBeat = 0;

      // Generate bars 1-2 (beats 0-7)
      while (currentBeat < 8) {
        const chord = chordProgressions.establish[Math.floor(Math.random() * 2)];
        const dur = 2;
        const actualDur = Math.min(dur, 8 - currentBeat);

        for (const midi of chord) {
          motif.push({ midi, startBeat: currentBeat, durBeats: actualDur });
          notes.push({
            id: nextId++,
            midi,
            startBeat: currentBeat,
            durBeats: actualDur,
            accidental: 0,
            staffIndex: 1
          });
        }
        currentBeat += dur;
      }

      // Copy to bars 3-4, 5-6, 7-8
      for (let repeatOffset of [8, 16, 24]) {
        for (const m of motif) {
          notes.push({
            id: nextId++,
            midi: m.midi,
            startBeat: m.startBeat + repeatOffset,
            durBeats: m.durBeats,
            accidental: 0,
            staffIndex: 1
          });
        }
      }
      return;
    }

    // Phrase and Drift modes
    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords = chordProgressions[section];

      // Right hand starts sparse in 'establish', builds in 'vary'/'contrast'
      let skipChance = 0;
      if (mode === 'phrase') {
        if (section === 'establish') skipChance = 0.4;
        else if (section === 'vary') skipChance = 0.2;
        else if (section === 'contrast') skipChance = 0.1;
        else skipChance = 0.3; // resolve - thin out
      } else if (mode === 'drift') {
        skipChance = 0.5;
      }

      if (Math.random() < skipChance) {
        currentBeat += 2;
        continue;
      }

      const chord = chords[Math.floor(Math.random() * chords.length)];
      const dur = section === 'resolve' ? 4 : 2;
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      // Vary number of chord tones
      let notesToPlay;
      if (section === 'contrast' && mode === 'phrase') {
        notesToPlay = chord; // Full chord in contrast
      } else if (Math.random() < 0.5) {
        notesToPlay = chord.slice(0, 2);
      } else {
        notesToPlay = [chord[0], chord[2]]; // Root and fifth
      }

      for (const midi of notesToPlay) {
        notes.push({
          id: nextId++,
          midi,
          startBeat: currentBeat,
          durBeats: actualDur,
          accidental: 0,
          staffIndex: 1
        });
      }
      currentBeat += dur;
    }
  }

  // Staff 2: Left Hand (Bass) - anchoring bass with phrase awareness
  function generateBassStaff(mode) {
    // Bass roots that follow the chord progression
    const bassProgression = {
      establish: [48, 53],      // C, F
      vary: [55, 52],           // G, E
      contrast: [57, 50],       // A, D
      resolve: [55, 48]         // G, C
    };

    // Loop mode: generate 2 bars, then repeat
    if (mode === 'loop') {
      const motif = [];
      let currentBeat = 0;

      // Generate bars 1-2 (beats 0-7)
      while (currentBeat < 8) {
        const root = bassProgression.establish[Math.floor(Math.random() * 2)];
        const dur = 2;
        const actualDur = Math.min(dur, 8 - currentBeat);

        motif.push({ midi: root, startBeat: currentBeat, durBeats: actualDur });
        notes.push({
          id: nextId++,
          midi: root,
          startBeat: currentBeat,
          durBeats: actualDur,
          accidental: 0,
          staffIndex: 2
        });

        // Add fifth on downbeats
        if (currentBeat % 4 === 0 && root + 7 <= 64) {
          motif.push({ midi: root + 7, startBeat: currentBeat, durBeats: actualDur });
          notes.push({
            id: nextId++,
            midi: root + 7,
            startBeat: currentBeat,
            durBeats: actualDur,
            accidental: 0,
            staffIndex: 2
          });
        }
        currentBeat += dur;
      }

      // Copy to bars 3-4, 5-6, 7-8
      for (let repeatOffset of [8, 16, 24]) {
        for (const m of motif) {
          notes.push({
            id: nextId++,
            midi: m.midi,
            startBeat: m.startBeat + repeatOffset,
            durBeats: m.durBeats,
            accidental: 0,
            staffIndex: 2
          });
        }
      }
      return;
    }

    // Phrase and Drift modes
    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const roots = bassProgression[section];

      // Drift mode: occasional silence
      if (mode === 'drift' && Math.random() < 0.35) {
        currentBeat += 2;
        continue;
      }

      // In phrase mode, bass switches pattern in contrast section
      let dur = 2;
      if (mode === 'phrase' && section === 'contrast') {
        dur = 1; // More rhythmic in contrast
      } else if (section === 'resolve') {
        dur = 4; // Long notes to resolve
      }

      const root = roots[Math.floor(Math.random() * roots.length)];
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      // Octave shift in bars 5-6 for phrase mode
      let octaveShift = 0;
      if (mode === 'phrase' && section === 'contrast') {
        octaveShift = 12; // Up one octave
      }

      notes.push({
        id: nextId++,
        midi: root + octaveShift,
        startBeat: currentBeat,
        durBeats: actualDur,
        accidental: 0,
        staffIndex: 2
      });

      // Add fifth on strong beats (except in resolve or drift)
      if (section !== 'resolve' && mode !== 'drift' && currentBeat % 4 === 0 && root + 7 + octaveShift <= 64) {
        notes.push({
          id: nextId++,
          midi: root + 7 + octaveShift,
          startBeat: currentBeat,
          durBeats: actualDur,
          accidental: 0,
          staffIndex: 2
        });
      }

      currentBeat += dur;
    }
  }

  /* === EVENT LISTENERS SETUP === */

  function setupEventListeners() {
    svg.addEventListener('mousedown', handleStaffClick);
    document.addEventListener('keydown', handleKeyDown);

    document.getElementById('undo').addEventListener('click', undo);
    document.getElementById('clear').addEventListener('click', clearAllNotes);
    document.getElementById('play').addEventListener('click', togglePlay);
    document.getElementById('download').addEventListener('click', exportMIDI);
    document.getElementById('randomize').addEventListener('click', generateRandomMelody);

    const loopBtn = document.getElementById('loop');
    if (loopBtn) {
      loopBtn.addEventListener('click', toggleLoop);
    }

    const volumeSlider = document.getElementById('volume');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        masterVolume = e.target.value / 100;
        if (masterGain) {
          masterGain.gain.value = masterVolume;
        }
      });
    }

    // Staff selector
    const staffSelector = document.getElementById('activeStaff');
    if (staffSelector) {
      staffSelector.addEventListener('change', (e) => {
        activeStaff = parseInt(e.target.value, 10);
        render();
      });
    }
  }

  /* === INITIALIZATION === */

  function initialize() {
    setupEventListeners();
    render();
  }

  initialize();

})();
