/* ====================================================
   SHEET MUSIC TO MIDI - MAIN JAVASCRIPT
   Minimal Staff Editor Logic
   ==================================================== */

(() => {
  /* === MUSICAL CONSTANTS === */
  const TPQ = 480;        // ticks per quarter note for MIDI
  const MEASURES = 4;     // visible measures
  const TIME_SIG_NUM = 4; // 4/4 time signature
  const TIME_SIG_DEN = 4;
  const TOTAL_BEATS = MEASURES * TIME_SIG_NUM;

  /* === SVG LAYOUT CONSTANTS === */
  const svg = document.getElementById('staff');
  const W = 1200, H = 420; // viewBox units
  const PADDING = { l: 40, r: 30, t: 30, b: 30 };
  const innerW = W - PADDING.l - PADDING.r;
  const innerH = H - PADDING.t - PADDING.b;

  /* === STAFF POSITIONING === */
  const staffTop = PADDING.t + 80;
  const staffGap = 12; // distance between staff lines
  const staffLines = 5;
  const staffBottom = staffTop + (staffLines - 1) * staffGap;
  const staffHeight = staffBottom - staffTop;

  /* === PITCH AND NOTE SYSTEM === */
  // Support C4..A5 range
  const PITCHES = [];
  const NOTE_ORDER = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  function midiToName(n) {
    const name = NOTE_ORDER[n % 12];
    const oct = Math.floor(n/12) - 1;
    return name + oct;
  }

  // Build supported pitch range
  function initializePitches() {
    // E4 midi = 64; C4 midi = 60; A5 midi = 81
    for (let m = 60; m <= 81; m++) PITCHES.push(m);
  }

  /* === COORDINATE MAPPING FUNCTIONS === */
  
  // Convert MIDI note to staff Y position
  function midiToStaffY(midi) {
    // Reference: Indices where each natural pitch sits relative to E4 (line index 0)
    const naturals = { 'C': -2, 'D': -1, 'E': 0, 'F': 1, 'G': 2, 'A': 3, 'B': 4 };

    const semitone = midi % 12;
    const oct = Math.floor(midi / 12) - 1;
    const baseName = NOTE_ORDER[semitone];
    const natural = baseName[0];
    const acc = baseName.length > 1 ? (baseName.includes('#') ? 1 : -1) : 0;

    // Compute diatonic steps from E4
    const NAT_TO_SEMI = { 'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11 };
    const naturalSemi = NAT_TO_SEMI[natural];
    const naturalMidi = (oct+1)*12 + naturalSemi;

    // Count diatonic steps between E4 (64) natural and this natural pitch
    const stepsFromE4 = diatonicDistance(64, naturalMidi, 'E', natural);
    // Each diatonic step is half a staffGap (lines & spaces alternating)
    let y = staffBottom - stepsFromE4 * (staffGap/2);

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
      if (steps>100) break; // safety break
    }
    return steps * ( (m2>=m1)? 1 : -1 );
  }

  // Quantize Y coordinate to closest supported MIDI note
  function quantizeYToMidi(y) {
    let best = 60; 
    let bestDist = 1e9;
    for (let m of PITCHES){
      const yy = midiToStaffY(m);
      const d = Math.abs(y-yy);
      if (d < bestDist){ 
        bestDist = d; 
        best = m; 
      }
    }
    return best;
  }

  /* === TIME GRID FUNCTIONS === */
  
  // Convert beat position to X coordinate
  function xForBeat(beat) {
    return PADDING.l + (beat / TOTAL_BEATS) * innerW;
  }

  // Convert X coordinate to beat position with snapping
  function beatForX(x) {
    const rel = (x - PADDING.l) / innerW;
    const rawBeat = rel * TOTAL_BEATS;
    const snap = parseInt(document.getElementById('snap').value, 10);
    const stepBeat = 4 / snap; // 4/4 time: if snap=8 -> each step = 0.5
    return Math.max(0, Math.min(TOTAL_BEATS, Math.round(rawBeat/stepBeat)*stepBeat));
  }

  /* === APPLICATION STATE === */
  let notes = []; // { id, midi, startBeat, durBeats, accidental: -1|0|1 }
  let selectedId = null;
  let nextId = 1;
  const history = [];

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

    // SVG definitions and filters
    renderSVGDefinitions(g);
    
    // Background panel
    renderBackgroundPanel(g);
    
    // Measure grid
    renderMeasureGrid(g);
    
    // Staff lines
    renderStaffLines(g);
    
    // Beat tick marks
    renderBeatTicks(g);
    
    // Treble clef
    renderTrebleClef(g);
    
    // All notes
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

  function renderBackgroundPanel(g) {
    g.push(`<rect x="${PADDING.l-18}" y="${staffTop-40}" width="${innerW+36}" height="${staffHeight+80}" rx="14" ry="14" fill="#0d1320" stroke="#1f2a3a"/>`);
  }

  function renderMeasureGrid(g) {
    for (let i = 0; i < MEASURES; i++) {
      const x0 = xForBeat(i*4), x1 = xForBeat((i+1)*4);
      g.push(`<rect x="${x0}" y="${staffTop-18}" width="${x1-x0}" height="${staffHeight+36}" fill="${i%2? '#0b1220':'#0a101a'}" opacity=".45"/>`);
    }
  }

  function renderStaffLines(g) {
    for (let i = 0; i < staffLines; i++) {
      const y = staffTop + i * staffGap;
      g.push(`<line x1="${PADDING.l}" y1="${y}" x2="${W-PADDING.r}" y2="${y}" stroke="#cfe0ff" stroke-opacity=".7" stroke-width="1" />`);
    }
  }

  function renderBeatTicks(g) {
    for (let b = 0; b <= TOTAL_BEATS; b++) {
      const x = xForBeat(b);
      const isBar = (b % TIME_SIG_NUM) === 0;
      g.push(`<line x1="${x}" y1="${staffTop-18}" x2="${x}" y2="${staffBottom+18}" stroke="${isBar? '#6aa2ff':'#35507a'}" stroke-opacity="${isBar? .8:.35}" stroke-width="${isBar? 1.5:1}" />`);
    }
  }

  function renderTrebleClef(g) {
    g.push(`<text x="${PADDING.l-26}" y="${staffTop + staffGap*3.2}" fill="#cfe0ff" font-size="48" font-family="'Segoe UI Symbol', 'Noto Emoji', sans-serif">𝄞</text>`);
  }

  function renderAllNotes(g) {
    for (const n of notes) {
      renderSingleNote(g, n);
    }
  }

  function renderSingleNote(g, n) {
    const x = xForBeat(n.startBeat) + 10; // slight inset
    const y = midiToStaffY(n.midi);
    const w = 14, h = 10;
    const sel = n.id === selectedId;

    // Render ledger lines if needed
    renderLedgerLines(g, n.midi, x);
    
    // Render accidental
    renderAccidental(g, n, x, y);
    
    // Render note head
    renderNoteHead(g, x, y, w, h, sel);
    
    // Render stem
    renderNoteStem(g, n, x, y, w);
    
    // Render duration indicator
    renderDurationIndicator(g, n, x, y);
  }

  function renderLedgerLines(g, midi, x) {
    const ledgerYs = getLedgerYPositions(midi);
    for (const ly of ledgerYs) {
      g.push(`<line x1="${x-8}" y1="${ly}" x2="${x+8}" y2="${ly}" stroke="#cfe0ff" stroke-width="1.2" />`);
    }
  }

  function getLedgerYPositions(midi) {
    const ly = [];
    const yNote = midiToStaffY(midi);
    
    // Below staff (C4, D4, etc.)
    if (yNote > staffBottom) {
      for (let mm = 64-2; mm >= 60; mm -= 2) { // D4 line-ish to C4 line-ish
        const yy = midiToStaffY(mm);
        if (yy >= staffBottom + 4 && yNote >= yy - 2) ly.push(yy);
      }
    } 
    // Above staff 
    else if (yNote < staffTop) {
      for (let mm = 77+2; mm <= 81; mm += 2) {
        const yy = midiToStaffY(mm);
        if (yy <= staffTop - 4 && yNote <= yy + 2) ly.push(yy);
      }
    }
    return ly;
  }

  function renderAccidental(g, n, x, y) {
    if (n.accidental === 1) {
      g.push(`<text x="${x-16}" y="${y+4}" fill="#cfe0ff" font-size="16">#</text>`);
    } else if (n.accidental === -1) {
      g.push(`<text x="${x-16}" y="${y+4}" fill="#cfe0ff" font-size="16">♭</text>`);
    }
  }

  function renderNoteHead(g, x, y, w, h, selected) {
    const color = selected ? '#a5d6a7' : '#cfe0ff';
    g.push(`<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${h}" fill="${color}" stroke="#7fa2c4" stroke-width="1" filter="url(#soft)" />`);
  }

  function renderNoteStem(g, n, x, y, w) {
    const up = n.midi < 71; // B4 = 71, stems up for notes below
    if (up) {
      g.push(`<line x1="${x+w-2}" y1="${y}" x2="${x+w-2}" y2="${y-28}" stroke="#cfe0ff" stroke-width="1.5" />`);
    } else {
      g.push(`<line x1="${x-w+2}" y1="${y}" x2="${x-w+2}" y2="${y+28}" stroke="#cfe0ff" stroke-width="1.5" />`);
    }
  }

  function renderDurationIndicator(g, n, x, y) {
    const durTxt = durationText(n.durBeats);
    g.push(`<text x="${x-6}" y="${y+24}" fill="#7fa2c4" font-size="10">${durTxt}</text>`);
  }

  function durationText(d) {
    if (d >= 4) return 'w';  // whole
    if (d >= 2) return 'h';  // half
    if (d >= 1) return 'q';  // quarter
    if (d >= 0.5) return 'e'; // eighth
    return 's';              // sixteenth
  }

  /* === EVENT HANDLING === */
  
  function handleStaffClick(e) {
    const pt = clientPoint(e);
    const tool = document.getElementById('tool').value;
    const acc = parseInt(document.getElementById('accidental').value, 10);
    
    if (pt.x < PADDING.l || pt.x > W - PADDING.r) return;

    const beat = beatForX(pt.x);
    const midi = quantizeYToMidi(pt.y);

    // Check if clicking on existing note
    const near = findNearbyNote(beat, midi);

    if (tool === 'erase') {
      handleEraseAction(near);
      return;
    }

    if (near) {
      // Select existing note
      selectedId = near.id; 
      render(); 
      return;
    }

    // Create new note
    createNewNote(beat, midi, acc);
  }

  function findNearbyNote(beat, midi) {
    return notes.find(n => 
      Math.abs(n.startBeat - beat) < 1e-6 && 
      Math.abs(midiToStaffY(n.midi) - midiToStaffY(midi)) < 8
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

  function createNewNote(beat, midi, accidental) {
    pushHistory();
    const snap = parseInt(document.getElementById('snap').value, 10);
    const durBeats = 4 / snap; // e.g., 4/4, snap=4 -> 1 beat
    const n = { 
      id: nextId++, 
      midi, 
      startBeat: beat, 
      durBeats, 
      accidental 
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
  }

  function deleteSelectedNote() {
    if (selectedId != null) { 
      pushHistory(); 
      notes = notes.filter(n => n.id !== selectedId); 
      selectedId = null; 
      render(); 
    }
  }

  /* === PLAYBACK FUNCTIONS === */
  
  let audio = null;

  function playNotes() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (!notes.length) return;
    
    const bpm = parseInt(document.getElementById('bpm').value, 10);
    const secPerBeat = 60 / bpm;
    const startT = audio.currentTime + 0.1;
    
    for (const n of notes) {
      playNoteAudio(n, startT, secPerBeat);
    }
  }

  function playNoteAudio(note, startTime, secPerBeat) {
    const t0 = startTime + note.startBeat * secPerBeat;
    const t1 = t0 + note.durBeats * secPerBeat;
    const freq = 440 * Math.pow(2, (note.midi - 69) / 12);
    
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    
    osc.frequency.value = freq;
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.01);
    gain.gain.setValueAtTime(0.2, t1 - 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    
    osc.connect(gain).connect(audio.destination);
    osc.start(t0); 
    osc.stop(t1 + 0.02);
  }

  /* === MIDI EXPORT FUNCTIONS === */
  
  function exportMIDI() {
    if (!notes.length) { 
      downloadBytes(new Uint8Array([]), 'empty.mid'); 
      return; 
    }
    
    const bpm = parseInt(document.getElementById('bpm').value, 10);
    const microPerQuarter = Math.round(60000000 / bpm);

    // Sort notes by start time
    const seq = [...notes].sort((a,b) => a.startBeat - b.startBeat || a.midi - b.midi);

    // Build MIDI track events
    const events = buildMIDIEvents(seq, microPerQuarter);
    
    // Wrap in standard MIDI file format
    const midiData = wrapInSMFFormat(events);
    
    downloadBytes(midiData, 'score.mid');
  }

  function buildMIDIEvents(sequence, microPerQuarter) {
    const events = [];
    
    function pushBytes(...arr) { 
      for (const x of arr) events.push(x); 
    }
    
    function vlq(value) {
      // Variable Length Quantity encoder
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

    // Meta event: Set tempo
    pushBytes(...vlq(0), 0xFF, 0x51, 0x03, 
               (microPerQuarter>>16)&255, 
               (microPerQuarter>>8)&255, 
               microPerQuarter&255);

    // Convert notes to MIDI events
    let cursor = 0;
    function beatToTicks(b) { 
      return Math.round(b * TPQ); 
    }

    for (const n of sequence) {
      const onTick = beatToTicks(n.startBeat);
      const offTick = beatToTicks(n.startBeat + n.durBeats);
      const channel = 0;
      const velocity = 96;
      const midiVal = Math.max(0, Math.min(127, (n.midi + (n.accidental||0))|0));
      
      // Note On
      const dOn = Math.max(0, onTick - cursor);
      pushBytes(...vlq(dOn), 0x90 | channel, midiVal, velocity);
      cursor = onTick;
      
      // Note Off
      const dOff = Math.max(0, offTick - cursor);
      pushBytes(...vlq(dOff), 0x80 | channel, midiVal, 0x40);
      cursor = offTick;
    }

    // End of track
    pushBytes(...vlq(0), 0xFF, 0x2F, 0x00);
    
    return new Uint8Array(events);
  }

  function wrapInSMFFormat(trackData) {
    const trackLen = trackData.length;

    function u32(n) { return [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]; }
    function u16(n) { return [(n>>>8)&255,n&255]; }

    const header = [
      0x4d,0x54,0x68,0x64, // MThd
      ...u32(6),           // header length
      ...u16(0),           // format 0
      ...u16(1),           // ntrks = 1
      ...u16(TPQ),         // division
    ];

    const trackHeader = [
      0x4d,0x54,0x72,0x6b, // MTrk
      ...u32(trackLen),
    ];

    const full = new Uint8Array(header.length + trackHeader.length + trackLen);
    full.set(header, 0);
    full.set(trackHeader, header.length);
    full.set(trackData, header.length + trackHeader.length);

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

  /* === EVENT LISTENERS SETUP === */
  
  function setupEventListeners() {
    // Staff interaction
    svg.addEventListener('mousedown', handleStaffClick);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
    
    // Control buttons
    document.getElementById('undo').addEventListener('click', undo);
    document.getElementById('clear').addEventListener('click', clearAllNotes);
    document.getElementById('play').addEventListener('click', playNotes);
    document.getElementById('download').addEventListener('click', exportMIDI);
  }

  /* === INITIALIZATION === */
  
  function initialize() {
    initializePitches();
    setupEventListeners();
    render();
  }

  // Start the application
  initialize();

})();