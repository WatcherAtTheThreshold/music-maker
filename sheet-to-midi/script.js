/* ====================================================
   SHEET MUSIC TO MIDI - STEP SEQUENCER GRID VERSION
   Three-staff piano roll editor
   ==================================================== */

(() => {
  /* === MUSICAL CONSTANTS === */
  const TPQ = 480;        // ticks per quarter note for MIDI
  const MEASURES = 8;     // visible measures
  const TIME_SIG_NUM = 4; // 4/4 time signature
  const TOTAL_BEATS = MEASURES * TIME_SIG_NUM; // 32 beats

  /* === STAFF CONFIGURATION === */
  const STAVES = [
    { name: 'Melody', clef: 'treble', minMidi: 60, maxMidi: 81, channel: 0, color: '#a8c8ff', waveform: 'sine' },
    { name: 'Right Hand', clef: 'treble', minMidi: 60, maxMidi: 81, channel: 1, color: '#a8e8c0', waveform: 'triangle' },
    { name: 'Left Hand', clef: 'bass', minMidi: 36, maxMidi: 64, channel: 2, color: '#ffd8a0', waveform: 'sawtooth' }
  ];

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /* === GRID CONFIGURATION === */
  const GRID_IDS = ['melodyGrid', 'rightHandGrid', 'leftHandGrid'];

  /* === APPLICATION STATE === */
  let notes = []; // { id, midi, startBeat, durBeats, accidental, staffIndex }
  let nextId = 1;
  const history = [];

  /* === UTILITY FUNCTIONS === */

  function midiToNoteName(midi) {
    const note = NOTE_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return note + octave;
  }

  function isNaturalNote(midi) {
    const semitone = midi % 12;
    return [0, 2, 4, 5, 7, 9, 11].includes(semitone); // C, D, E, F, G, A, B
  }

  function getSnap() {
    return parseInt(document.getElementById('snap').value, 10);
  }

  function getStepsCount() {
    const snap = getSnap();
    return (TOTAL_BEATS * snap) / 4; // 32 at quarter, 64 at eighth, 128 at sixteenth
  }

  function stepToBeat(step) {
    const snap = getSnap();
    return (step * 4) / snap;
  }

  function beatToStep(beat) {
    const snap = getSnap();
    return Math.round((beat * snap) / 4);
  }

  /* === KEY TRANSPOSITION UTILITIES === */

  function getKeyOffset() {
    const el = document.getElementById('keyShift');
    return el ? parseInt(el.value, 10) : 0;
  }

  // Shift every note in a flat array by n semitones
  function transposeArr(arr, n) {
    return n === 0 ? arr : arr.map(v => v + n);
  }

  // Shift every note in a { section: [[midi, ...], ...] } chord map
  function transposeChords(sections, n) {
    if (n === 0) return sections;
    const out = {};
    for (const [key, chords] of Object.entries(sections)) {
      out[key] = chords.map(chord => chord.map(v => v + n));
    }
    return out;
  }

  // Shift every note in a { section: [midi, ...] } roots map
  function transposeRoots(sections, n) {
    if (n === 0) return sections;
    const out = {};
    for (const [key, roots] of Object.entries(sections)) {
      out[key] = roots.map(v => v + n);
    }
    return out;
  }

  /* === HISTORY MANAGEMENT === */

  function pushHistory() {
    history.push(JSON.stringify(notes));
    if (history.length > 100) history.shift();
  }

  function undo() {
    if (history.length) {
      notes = JSON.parse(history.pop());
      updateAllGrids();
    }
  }

  /* === GRID GENERATION === */

  function createStaffGrid(staffIndex) {
    const staff = STAVES[staffIndex];
    const container = document.getElementById(GRID_IDS[staffIndex]);
    if (!container) return;

    container.innerHTML = '';

    const stepsCount = getStepsCount();
    const snap = getSnap();

    // Create rows from HIGH pitch to LOW (visual top to bottom)
    for (let midi = staff.maxMidi; midi >= staff.minMidi; midi--) {
      const row = document.createElement('div');
      row.className = 'pitch-row';
      row.classList.add(isNaturalNote(midi) ? 'natural' : 'accidental');
      row.dataset.midi = midi;
      row.dataset.staff = staffIndex;

      // Pitch label
      const label = document.createElement('div');
      label.className = 'pitch-label';
      if (midi % 12 === 0) label.classList.add('c-note'); // Highlight C notes
      label.textContent = midiToNoteName(midi);
      row.appendChild(label);

      // Steps container
      const stepsContainer = document.createElement('div');
      stepsContainer.className = 'steps-container';

      for (let step = 0; step < stepsCount; step++) {
        const cell = document.createElement('div');
        cell.className = 'step-cell';
        cell.dataset.step = step;
        cell.dataset.midi = midi;
        cell.dataset.staff = staffIndex;

        // Beat and measure markers
        // At sixteenth resolution: measure every 16 steps, beat every 4 steps
        // At eighth resolution: measure every 8 steps, beat every 2 steps
        // At quarter resolution: measure every 4 steps, beat every 1 step
        const stepsPerBeat = snap / 4;
        const stepsPerMeasure = stepsPerBeat * 4;

        if (step % stepsPerMeasure === 0 && step > 0) {
          cell.classList.add('measure-marker');
        } else if (step % stepsPerBeat === 0 && step > 0) {
          cell.classList.add('beat-marker');
        }

        // Click handler
        cell.addEventListener('click', () => toggleGridCell(staffIndex, midi, step));
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          clearGridCell(staffIndex, midi, step);
        });

        stepsContainer.appendChild(cell);
      }

      row.appendChild(stepsContainer);
      container.appendChild(row);
    }
  }

  function initializeGrids() {
    STAVES.forEach((_, index) => createStaffGrid(index));
    updateAllGrids();
  }

  /* === GRID INTERACTION === */

  function toggleGridCell(staffIndex, midi, step) {
    const beatPosition = stepToBeat(step);
    const snap = getSnap();
    const durBeats = 4 / snap;

    // Check if note exists at this position
    const existingIndex = notes.findIndex(n =>
      n.staffIndex === staffIndex &&
      n.midi === midi &&
      Math.abs(n.startBeat - beatPosition) < 0.01
    );

    pushHistory();

    if (existingIndex >= 0) {
      // Remove note
      notes.splice(existingIndex, 1);
    } else {
      // Add note
      notes.push({
        id: nextId++,
        midi: midi,
        startBeat: beatPosition,
        durBeats: durBeats,
        accidental: 0,
        staffIndex: staffIndex
      });
    }

    updateAllGrids();
  }

  function clearGridCell(staffIndex, midi, step) {
    const beatPosition = stepToBeat(step);

    const existingIndex = notes.findIndex(n =>
      n.staffIndex === staffIndex &&
      n.midi === midi &&
      Math.abs(n.startBeat - beatPosition) < 0.01
    );

    if (existingIndex >= 0) {
      pushHistory();
      notes.splice(existingIndex, 1);
      updateAllGrids();
    }
  }

  function updateAllGrids() {
    // Clear all active states
    document.querySelectorAll('.step-cell.active').forEach(cell => {
      cell.classList.remove('active');
    });

    // Set active states based on notes data
    for (const note of notes) {
      const step = beatToStep(note.startBeat);
      const cell = document.querySelector(
        `.step-cell[data-staff="${note.staffIndex}"][data-midi="${note.midi}"][data-step="${step}"]`
      );
      if (cell) {
        cell.classList.add('active');
      }
    }
  }

  function clearAllNotes() {
    pushHistory();
    notes = [];
    updateAllGrids();
  }

  /* === PLAYBACK FUNCTIONS === */

  let audio = null;
  let masterGain = null;
  let isPlaying = false;
  let isLooping = false;
  let activeOscillators = [];
  let playbackTimeout = null;
  let playbackStartTime = 0;
  let playheadInterval = null;
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
    playbackStartTime = audio.currentTime + 0.05;
    const totalDuration = TOTAL_BEATS * secPerBeat;

    // Schedule all notes
    for (const n of notes) {
      const oscData = playNoteAudio(n, playbackStartTime, secPerBeat);
      activeOscillators.push(oscData);
    }

    // Start playhead animation
    startPlayheadAnimation(totalDuration);

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

    if (playheadInterval) {
      cancelAnimationFrame(playheadInterval);
      playheadInterval = null;
    }

    // Clear playhead indicators
    document.querySelectorAll('.step-cell.current').forEach(cell => {
      cell.classList.remove('current');
    });

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

  function startPlayheadAnimation(totalDuration) {
    const stepsCount = getStepsCount();
    let lastStep = -1;

    // Clear previous playhead
    document.querySelectorAll('.step-cell.current').forEach(cell => {
      cell.classList.remove('current');
    });

    function updatePlayhead() {
      if (!isPlaying) {
        document.querySelectorAll('.step-cell.current').forEach(cell => {
          cell.classList.remove('current');
        });
        return;
      }

      // Calculate current step based on actual audio time
      const elapsed = audio.currentTime - playbackStartTime;
      const progress = elapsed / totalDuration;

      // Handle looping - wrap progress to 0-1 range
      const wrappedProgress = isLooping ? (progress % 1) : Math.min(progress, 0.9999);
      const currentStep = Math.floor(wrappedProgress * stepsCount);

      // Only update DOM if step changed
      if (currentStep !== lastStep && currentStep >= 0 && currentStep < stepsCount) {
        // Clear previous
        document.querySelectorAll('.step-cell.current').forEach(cell => {
          cell.classList.remove('current');
        });

        // Highlight current column
        document.querySelectorAll(`.step-cell[data-step="${currentStep}"]`).forEach(cell => {
          cell.classList.add('current');
        });

        lastStep = currentStep;
      }

      // Continue animation
      if (isPlaying) {
        playheadInterval = requestAnimationFrame(updatePlayhead);
      }
    }

    playheadInterval = requestAnimationFrame(updatePlayhead);
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
    const tempoTrack = buildTempoTrack(microPerQuarter);
    const staffTracks = STAVES.map((staff, staffIndex) => {
      const staffNotes = notes.filter(n => n.staffIndex === staffIndex);
      return buildStaffTrack(staffNotes, staff, staffIndex);
    });

    return wrapInSMFFormat1([tempoTrack, ...staffTracks]);
  }

  function buildTempoTrack(microPerQuarter) {
    const events = [];

    function pushBytes(...arr) {
      for (const x of arr) events.push(x);
    }

    pushBytes(...vlq(0), 0xFF, 0x51, 0x03,
               (microPerQuarter>>16)&255,
               (microPerQuarter>>8)&255,
               microPerQuarter&255);

    pushBytes(...vlq(0), 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);
    pushBytes(...vlq(0), 0xFF, 0x2F, 0x00);

    return new Uint8Array(events);
  }

  function buildStaffTrack(staffNotes, staff, staffIndex) {
    const events = [];

    function pushBytes(...arr) {
      for (const x of arr) events.push(x);
    }

    const trackName = staff.name;
    const nameBytes = [];
    for (let i = 0; i < trackName.length; i++) {
      nameBytes.push(trackName.charCodeAt(i));
    }
    pushBytes(...vlq(0), 0xFF, 0x03, nameBytes.length, ...nameBytes);

    const programs = [0, 48, 32];
    const channel = staff.channel;
    pushBytes(...vlq(0), 0xC0 | channel, programs[staffIndex] || 0);

    if (staffNotes.length === 0) {
      pushBytes(...vlq(0), 0xFF, 0x2F, 0x00);
      return new Uint8Array(events);
    }

    const sortedNotes = [...staffNotes].sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);

    const allEvents = [];
    for (const n of sortedNotes) {
      const onTick = beatToTicks(n.startBeat);
      const offTick = beatToTicks(n.startBeat + n.durBeats);
      const velocity = 96;
      const midiVal = Math.max(0, Math.min(127, (n.midi + (n.accidental||0))|0));

      allEvents.push({ tick: onTick, type: 'on', midi: midiVal, velocity });
      allEvents.push({ tick: offTick, type: 'off', midi: midiVal });
    }

    allEvents.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      if (a.type === 'off' && b.type === 'on') return -1;
      if (a.type === 'on' && b.type === 'off') return 1;
      return 0;
    });

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

    pushBytes(...vlq(0), 0xFF, 0x2F, 0x00);
    return new Uint8Array(events);
  }

  function wrapInSMFFormat1(tracks) {
    function u32(n) { return [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]; }
    function u16(n) { return [(n>>>8)&255,n&255]; }

    const header = [
      0x4d, 0x54, 0x68, 0x64,
      ...u32(6),
      ...u16(1),
      ...u16(tracks.length),
      ...u16(TPQ),
    ];

    let totalSize = header.length;
    for (const track of tracks) {
      totalSize += 8 + track.length;
    }

    const full = new Uint8Array(totalSize);
    let offset = 0;

    full.set(header, offset);
    offset += header.length;

    for (const trackData of tracks) {
      const trackHeader = [
        0x4d, 0x54, 0x72, 0x6b,
        ...u32(trackData.length),
      ];
      full.set(trackHeader, offset);
      offset += trackHeader.length;
      full.set(trackData, offset);
      offset += trackData.length;
    }

    return full;
  }

  function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], {type: 'audio/midi'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* === MAGIC GENERATION === */

  function getMagicMode() {
    const selector = document.getElementById('magicMode');
    return selector ? selector.value : 'phrase';
  }

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

    const mode = getMagicMode();

    if (mode === 'fantasy') {
      generateFantasyMelody();
      generateFantasyRightHand();
      generateFantasyBass();
    } else if (mode === 'lofi') {
      generateLofiMelody();
      generateLofiRightHand();
      generateLofiBass();
    } else if (mode === 'adventure') {
      generateAdventureMelody();
      generateAdventureRightHand();
      generateAdventureBass();
    } else if (mode === 'boss') {
      generateBossMelody();
      generateBossRightHand();
      generateBossBass();
    } else if (mode === 'mystic') {
      generateMystic();
    } else if (mode === 'victory') {
      generateVictoryMelody();
      generateVictoryRightHand();
      generateVictoryBass();
    } else {
      generateMelodyStaff(mode);
      generateRightHandStaff(mode);
      generateBassStaff(mode);
    }

    updateAllGrids();
  }

  function generateMelodyStaff(mode) {
    const scale = transposeArr([60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81], getKeyOffset());

    const rhythmsBySection = {
      establish: [[1, 1, 1, 1], [2, 1, 1], [1, 0.5, 0.5, 1, 1]],
      vary: [[1, 1, 2], [0.5, 0.5, 1, 0.5, 0.5, 1], [1, 1, 1, 1]],
      contrast: [[2, 2], [1, 1, 1, 1], [0.5, 0.5, 0.5, 0.5, 1, 1]],
      resolve: [[2, 1, 1], [4], [2, 2], [1, 1, 2]]
    };

    const modeConfig = {
      loop: { restChance: 0.15, motifRepeat: true, densityMultiplier: 1.2 },
      phrase: { restChance: 0.2, motifRepeat: false, densityMultiplier: 1.0 },
      drift: { restChance: 0.4, motifRepeat: false, densityMultiplier: 0.6 }
    };
    const config = modeConfig[mode];

    let currentBeat = 0;
    let lastIndex = Math.floor(scale.length / 2);
    let motif = [];

    if (mode === 'loop') {
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

      for (let repeatOffset of [8, 16, 24]) {
        for (const m of motif) {
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
      return;
    }

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];

      for (const dur of pattern) {
        if (currentBeat >= TOTAL_BEATS) break;

        let restChance = config.restChance;
        if (section === 'resolve') restChance += 0.15;
        if (section === 'contrast' && mode === 'phrase') restChance += 0.1;

        if (Math.random() < restChance) {
          currentBeat += dur;
          continue;
        }

        const leapChance = section === 'contrast' ? 0.3 : 0.15;
        const step = Math.random() < 0.5 ? -1 : 1;
        const jump = Math.random() < leapChance ? Math.floor(Math.random() * 3) + 2 : 1;
        lastIndex = Math.max(0, Math.min(scale.length - 1, lastIndex + step * jump));

        if (section === 'resolve' && Math.random() < 0.4) {
          lastIndex = Math.max(0, lastIndex - 1);
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

  function generateRightHandStaff(mode) {
    const chordProgressions = transposeChords({
      establish: [[60, 64, 67], [65, 69, 72]],
      vary: [[67, 71, 74], [64, 67, 71]],
      contrast: [[69, 72, 76], [62, 65, 69]],
      resolve: [[67, 71, 74], [60, 64, 67]]
    }, getKeyOffset());

    if (mode === 'loop') {
      const motif = [];
      let currentBeat = 0;

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

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords = chordProgressions[section];

      let skipChance = 0;
      if (mode === 'phrase') {
        if (section === 'establish') skipChance = 0.4;
        else if (section === 'vary') skipChance = 0.2;
        else if (section === 'contrast') skipChance = 0.1;
        else skipChance = 0.3;
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

      let notesToPlay;
      if (section === 'contrast' && mode === 'phrase') {
        notesToPlay = chord;
      } else if (Math.random() < 0.5) {
        notesToPlay = chord.slice(0, 2);
      } else {
        notesToPlay = [chord[0], chord[2]];
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

  function generateBassStaff(mode) {
    const bassProgression = transposeRoots({
      establish: [48, 53],
      vary: [55, 52],
      contrast: [57, 50],
      resolve: [55, 48]
    }, getKeyOffset());

    if (mode === 'loop') {
      const motif = [];
      let currentBeat = 0;

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

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const roots = bassProgression[section];

      if (mode === 'drift' && Math.random() < 0.35) {
        currentBeat += 2;
        continue;
      }

      let dur = 2;
      if (mode === 'phrase' && section === 'contrast') {
        dur = 1;
      } else if (section === 'resolve') {
        dur = 4;
      }

      const root = roots[Math.floor(Math.random() * roots.length)];
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      let octaveShift = 0;
      if (mode === 'phrase' && section === 'contrast') {
        octaveShift = 12;
      }

      notes.push({
        id: nextId++,
        midi: root + octaveShift,
        startBeat: currentBeat,
        durBeats: actualDur,
        accidental: 0,
        staffIndex: 2
      });

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

  /* === FANTASY / MEDIEVAL GENERATION === */

  function generateFantasyMelody() {
    // D Dorian scale — the quintessential medieval mode
    const DORIAN_MELODY = transposeArr([62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81], getKeyOffset());
    // Medieval melody: stepwise motion, occasional ornamental turns,
    // longer note values, phrase arcs that cadence on D or A

    const rhythmsBySection = {
      establish: [[2, 2], [2, 1, 1], [1, 1, 2]],
      vary:      [[1, 1, 1, 1], [2, 1, 0.5, 0.5], [1, 0.5, 0.5, 1, 1]],
      contrast:  [[1, 1, 1, 1], [0.5, 0.5, 1, 1, 1], [2, 1, 1]],
      resolve:   [[2, 2], [4], [1, 1, 2]]
    };

    let currentBeat = 0;
    let lastIndex = 3; // Start around G4 — middle of the Dorian range

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];

      for (const dur of pattern) {
        if (currentBeat >= TOTAL_BEATS) break;

        // Medieval melodies breathe — rest between phrases
        let restChance = 0.15;
        if (section === 'resolve') restChance = 0.25;
        if (section === 'contrast') restChance = 0.1;

        if (Math.random() < restChance) {
          currentBeat += dur;
          continue;
        }

        // Mostly stepwise with occasional 3rds (very medieval)
        const leapChance = section === 'contrast' ? 0.25 : 0.1;
        const dir = Math.random() < 0.5 ? -1 : 1;
        const jump = Math.random() < leapChance ? 2 : 1;
        lastIndex = Math.max(0, Math.min(DORIAN_MELODY.length - 1, lastIndex + dir * jump));

        // Resolve sections pull toward D (index 0) or A (index 4)
        if (section === 'resolve' && Math.random() < 0.5) {
          const target = Math.random() < 0.6 ? 0 : 4;
          lastIndex += lastIndex > target ? -1 : (lastIndex < target ? 1 : 0);
        }

        // Contrast section ventures higher — more tension
        if (section === 'contrast' && Math.random() < 0.3) {
          lastIndex = Math.min(DORIAN_MELODY.length - 1, lastIndex + 1);
        }

        const midi = DORIAN_MELODY[lastIndex];
        const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

        if (actualDur > 0) {
          notes.push({
            id: nextId++, midi,
            startBeat: currentBeat, durBeats: actualDur,
            accidental: 0, staffIndex: 0
          });
        }
        currentBeat += dur;
      }
    }
  }

  function generateFantasyRightHand() {
    // Medieval harmony: open fifths, fourths, and octaves (no thirds!)
    // Sparse harp-like accompaniment with occasional parallel motion

    // Open-voiced chords built on Dorian scale degrees
    const chordsBySection = transposeChords({
      // [root, fifth] or [root, fourth, fifth] — no thirds
      establish: [[62, 69], [67, 74]],           // D5, G5 (i, IV)
      vary:      [[69, 76], [65, 72]],           // A5, F5 (v, III)
      contrast:  [[64, 71], [67, 74]],           // E5, G5 (ii, IV)
      resolve:   [[69, 76], [62, 69]]            // A5, D5 (v, i)
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords = chordsBySection[section];

      // Harp-like: sometimes skip beats for a sparse, airy feel
      let skipChance = 0.2;
      if (section === 'establish') skipChance = 0.35;
      if (section === 'contrast') skipChance = 0.1;
      if (section === 'resolve') skipChance = 0.3;

      if (Math.random() < skipChance) {
        currentBeat += 2;
        continue;
      }

      const chord = chords[Math.floor(Math.random() * chords.length)];
      const dur = section === 'resolve' ? 4 : 2;
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      // Sometimes arpeggiate (stagger the notes by half a beat)
      const arpeggiate = Math.random() < 0.3;

      for (let i = 0; i < chord.length; i++) {
        const offset = arpeggiate ? i * 0.5 : 0;
        const noteBeat = currentBeat + offset;
        const noteDur = Math.max(0.5, actualDur - offset);

        if (noteBeat < TOTAL_BEATS && noteDur > 0) {
          notes.push({
            id: nextId++, midi: chord[i],
            startBeat: noteBeat, durBeats: noteDur,
            accidental: 0, staffIndex: 1
          });
        }
      }

      // Occasionally add an octave doubling for fullness
      if (Math.random() < 0.2 && chord[0] - 12 >= 60) {
        notes.push({
          id: nextId++, midi: chord[0] - 12,
          startBeat: currentBeat, durBeats: actualDur,
          accidental: 0, staffIndex: 1
        });
      }

      currentBeat += dur;
    }
  }

  function generateFantasyBass() {
    // Medieval bass: sustained drone on D, with occasional movement to A (the 5th)
    // Think hurdy-gurdy or bagpipe drone

    // D2=38, A2=45, D3=50, A3=57
    const droneRoots = transposeRoots({
      establish: [38, 50],    // D2, D3 — pure drone
      vary:      [38, 45],    // D2, A2 — root and fifth
      contrast:  [45, 43],    // A2, G2 — tension
      resolve:   [45, 38]     // A2→D2 — cadence home
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const roots = droneRoots[section];

      // Bass in medieval music is very sustained
      let dur;
      if (section === 'establish' || section === 'resolve') {
        dur = 4; // Whole bar drones
      } else if (section === 'contrast') {
        dur = 2; // Slightly more motion
      } else {
        dur = Math.random() < 0.5 ? 4 : 2;
      }

      const root = roots[Math.floor(Math.random() * roots.length)];
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      notes.push({
        id: nextId++, midi: root,
        startBeat: currentBeat, durBeats: actualDur,
        accidental: 0, staffIndex: 2
      });

      // Add a fifth above for a fuller drone (on strong beats)
      if (currentBeat % 4 === 0 && Math.random() < 0.6) {
        const fifth = root + 7;
        if (fifth <= 64) {
          notes.push({
            id: nextId++, midi: fifth,
            startBeat: currentBeat, durBeats: actualDur,
            accidental: 0, staffIndex: 2
          });
        }
      }

      currentBeat += dur;
    }
  }

  /* === LO-FI / NUJABES GENERATION === */

  function generateLofiMelody() {
    // A minor pentatonic + jazz color tones for that lo-fi feel
    // Core: A C D E G | Color: Bb, F, B (blue notes, 7ths)
    const LOFI_MELODY = transposeArr([60, 62, 64, 65, 67, 69, 70, 71, 72, 74, 76, 77, 79, 81], getKeyOffset());
    //                                C4  D4  E4  F4  G4  A4  Bb4 B4  C5  D5  E5  F5  G5  A5
    // Nujabes-style melody: pentatonic core with chromatic passing tones,
    // syncopated rhythms that land on off-beats, breathing space

    // Pentatonic "home" indices (A minor pentatonic within the scale)
    // A=5, C=0/8, D=1/9, E=2/10, G=4/12
    const pentatonicIndices = [0, 1, 2, 4, 5, 8, 9, 10, 12];

    const rhythmsBySection = {
      // Syncopated — lots of off-beat entries (0.5 = eighth note offsets)
      establish: [[0.5, 1, 0.5, 1, 1], [1, 0.5, 0.5, 1, 1], [1.5, 0.5, 1, 1]],
      vary:      [[0.5, 0.5, 1, 0.5, 0.5, 1], [0.5, 1.5, 1, 1], [1, 0.5, 0.5, 0.5, 0.5, 1]],
      contrast:  [[0.5, 0.5, 0.5, 0.5, 1, 1], [1, 1, 0.5, 0.5, 1], [2, 0.5, 0.5, 1]],
      resolve:   [[1.5, 0.5, 2], [1, 1, 2], [2, 2]]
    };

    let currentBeat = 0;
    let lastIndex = 5; // Start on A4
    let lastWasPentatonic = true;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];

      for (const dur of pattern) {
        if (currentBeat >= TOTAL_BEATS) break;

        // Lo-fi breathes — generous rests, especially on downbeats
        let restChance = 0.2;
        if (section === 'resolve') restChance = 0.3;
        // Rest more on strong beats for that laid-back feel
        if (currentBeat % 2 === 0 && Math.random() < 0.15) restChance += 0.15;

        if (Math.random() < restChance) {
          currentBeat += dur;
          continue;
        }

        // Movement: mostly stepwise, occasionally leap to a pentatonic tone
        if (lastWasPentatonic && Math.random() < 0.3) {
          // Chromatic approach: step to a neighbor tone
          const dir = Math.random() < 0.5 ? -1 : 1;
          lastIndex = Math.max(0, Math.min(LOFI_MELODY.length - 1, lastIndex + dir));
          lastWasPentatonic = false;
        } else {
          // Jump to a pentatonic tone (the core sound)
          const targetPool = pentatonicIndices.filter(i => Math.abs(i - lastIndex) <= 3);
          if (targetPool.length > 0) {
            lastIndex = targetPool[Math.floor(Math.random() * targetPool.length)];
          } else {
            const dir = Math.random() < 0.5 ? -1 : 1;
            lastIndex = Math.max(0, Math.min(LOFI_MELODY.length - 1, lastIndex + dir * 2));
          }
          lastWasPentatonic = true;
        }

        // Resolve pulls toward A (index 5) or C (index 0/8)
        if (section === 'resolve' && Math.random() < 0.5) {
          const target = Math.random() < 0.6 ? 5 : 8;
          lastIndex += lastIndex > target ? -1 : (lastIndex < target ? 1 : 0);
        }

        const midi = LOFI_MELODY[lastIndex];
        const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

        if (actualDur > 0) {
          notes.push({
            id: nextId++, midi,
            startBeat: currentBeat, durBeats: actualDur,
            accidental: 0, staffIndex: 0
          });
        }
        currentBeat += dur;
      }
    }
  }

  function generateLofiRightHand() {
    // Jazz chords: minor 7ths, major 7ths, dominant 9ths
    // Voiced in the treble range with 3rds and 7ths — the Nujabes harmonic palette

    const chordsBySection = transposeChords({
      // Am7, Dm7, Fmaj7, Em7 — classic lo-fi progression
      establish: [
        [69, 72, 76, 79],   // Am7: A C E G
        [62, 65, 69, 72]    // Dm7: D F A C
      ],
      vary: [
        [65, 69, 72, 76],   // Fmaj7: F A C E
        [67, 71, 74, 77]    // G7: G B D F
      ],
      contrast: [
        [64, 67, 71, 74],   // Em7: E G B D
        [60, 64, 67, 71]    // Cmaj7: C E G B
      ],
      resolve: [
        [62, 65, 69, 72],   // Dm7: D F A C
        [69, 72, 76, 79]    // Am7: A C E G
      ]
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords = chordsBySection[section];

      // Lo-fi chords are laid-back — skip some hits
      let skipChance = 0.15;
      if (section === 'establish') skipChance = 0.25;
      if (section === 'resolve') skipChance = 0.2;

      if (Math.random() < skipChance) {
        currentBeat += 2;
        continue;
      }

      const chord = chords[Math.floor(Math.random() * chords.length)];
      const dur = section === 'resolve' ? 4 : 2;
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      // Vary voicing: sometimes drop a note for a thinner texture
      let voicing;
      const roll = Math.random();
      if (roll < 0.4) {
        voicing = chord; // Full 4-note chord
      } else if (roll < 0.7) {
        voicing = [chord[0], chord[2], chord[3]]; // Root, 5th, 7th (drop 3rd sometimes for open sound)
      } else {
        voicing = [chord[0], chord[1], chord[3]]; // Root, 3rd, 7th (shell voicing — very jazz)
      }

      // Syncopated chord placement — sometimes start half a beat early
      const offset = Math.random() < 0.3 ? -0.5 : 0;
      const chordBeat = Math.max(0, currentBeat + offset);

      for (const midi of voicing) {
        if (chordBeat >= 0 && chordBeat < TOTAL_BEATS) {
          notes.push({
            id: nextId++, midi,
            startBeat: chordBeat, durBeats: Math.min(actualDur, TOTAL_BEATS - chordBeat),
            accidental: 0, staffIndex: 1
          });
        }
      }

      currentBeat += dur;
    }
  }

  function generateLofiBass() {
    // Lo-fi bass: mellow walking lines with chromatic approach tones
    // Sits in a low pocket, emphasis on roots and 5ths with passing tones

    // A minor walking bass notes (MIDI values in bass range)
    // A2=45, B2=47, C3=48, D3=50, E3=52, F3=53, G3=55, A3=57
    const bassRoots = transposeRoots({
      establish: [45, 50],    // A2, D3
      vary:      [53, 55],    // F3, G3
      contrast:  [52, 48],    // E3, C3
      resolve:   [50, 45]     // D3, A2
    }, getKeyOffset());

    let currentBeat = 0;
    let lastRoot = 45; // Start on A2

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const roots = bassRoots[section];

      // Bass in lo-fi is steady but not mechanical
      let dur;
      if (section === 'resolve') {
        dur = 2; // Slower to wind down
      } else {
        // Mix of quarter and half notes for walking feel
        dur = Math.random() < 0.6 ? 1 : 2;
      }

      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);
      if (actualDur <= 0) break;

      // Choose note: root, or walk toward the next root
      let midi;
      const targetRoot = roots[Math.floor(Math.random() * roots.length)];

      const roll = Math.random();
      if (roll < 0.5) {
        // Play the root
        midi = targetRoot;
      } else if (roll < 0.75) {
        // Play the fifth above root
        midi = targetRoot + 7;
      } else {
        // Chromatic approach: one semitone above or below the target
        const approach = Math.random() < 0.5 ? -1 : 1;
        midi = targetRoot + approach;
      }

      // Keep bass in range
      midi = Math.max(36, Math.min(64, midi));

      notes.push({
        id: nextId++, midi,
        startBeat: currentBeat, durBeats: actualDur,
        accidental: 0, staffIndex: 2
      });

      // Occasional octave ghost note for rhythmic bounce
      if (dur === 1 && Math.random() < 0.25 && midi + 12 <= 64) {
        const ghostBeat = currentBeat + 0.5;
        if (ghostBeat < TOTAL_BEATS) {
          notes.push({
            id: nextId++, midi: midi + 12,
            startBeat: ghostBeat, durBeats: 0.5,
            accidental: 0, staffIndex: 2
          });
        }
      }

      lastRoot = midi;
      currentBeat += dur;
    }
  }

  /* === ADVENTURE / HEROIC GENERATION === */

  function generateAdventureMelody() {
    // E natural minor — the classic action/adventure game key
    // E4=64, F#4=66, G4=67, A4=69, B4=71, C5=72, D5=74, E5=76, F#5=78, G5=79, A5=81
    const ADVENTURE_SCALE = transposeArr([64, 66, 67, 69, 71, 72, 74, 76, 78, 79, 81], getKeyOffset());
    // Heroic melodic lines: rising phrases, bold leaps of 4ths and 5ths,
    // driving dotted rhythms. Think Zelda overworld, Chrono Trigger.

    const rhythmsBySection = {
      // Establish: clear, rhythmically punchy opening phrases
      establish: [[1, 1, 1, 1], [1.5, 0.5, 1, 1], [2, 1, 1]],
      // Vary: more motion, building energy
      vary:      [[0.5, 0.5, 1, 0.5, 0.5, 1], [1, 0.5, 0.5, 1, 1], [1.5, 0.5, 0.5, 0.5, 1]],
      // Contrast: peak energy, fast runs or big leaps
      contrast:  [[0.5, 0.5, 0.5, 0.5, 1, 1], [1, 0.5, 0.5, 0.5, 0.5, 1], [0.5, 0.5, 1, 1, 1]],
      // Resolve: triumphant landing, longer notes
      resolve:   [[2, 1, 1], [4], [1.5, 0.5, 2]]
    };

    let currentBeat = 0;
    let lastIndex = 4; // Start on B4 — the 5th, a strong heroic tone

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];

      for (const dur of pattern) {
        if (currentBeat >= TOTAL_BEATS) break;

        // Adventure melodies keep moving — fewer rests than other modes
        let restChance = 0.1;
        if (section === 'resolve') restChance = 0.2;

        if (Math.random() < restChance) {
          currentBeat += dur;
          continue;
        }

        // Heroic = bold leaps. 4ths and 5ths are characteristically heroic
        const leapChance = section === 'contrast' ? 0.45 : 0.25;
        const dir = Math.random() < 0.55 ? 1 : -1; // Bias upward for energy
        let jump;
        if (Math.random() < leapChance) {
          jump = Math.random() < 0.5 ? 3 : 4; // 4th or 5th in scale steps
        } else {
          jump = 1; // Stepwise
        }
        lastIndex = Math.max(0, Math.min(ADVENTURE_SCALE.length - 1, lastIndex + dir * jump));

        // Contrast climbs high — tension before resolve
        if (section === 'contrast') {
          lastIndex = Math.min(ADVENTURE_SCALE.length - 1, lastIndex + (Math.random() < 0.35 ? 1 : 0));
        }

        // Resolve: fall back toward E (index 0) — the triumphant home
        if (section === 'resolve' && Math.random() < 0.5) {
          lastIndex = Math.max(0, lastIndex - 1);
        }

        const midi = ADVENTURE_SCALE[lastIndex];
        const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

        if (actualDur > 0) {
          notes.push({
            id: nextId++, midi,
            startBeat: currentBeat, durBeats: actualDur,
            accidental: 0, staffIndex: 0
          });
        }
        currentBeat += dur;
      }
    }
  }

  function generateAdventureRightHand() {
    // Heroic chord hits: Em, G, Am, D, Bm, C — the classic minor adventure progression
    // Punchy, on-beat chord stabs with occasional held voicings

    const chordsBySection = transposeChords({
      establish: [[64, 67, 71], [67, 71, 74]],   // Em, G
      vary:      [[69, 72, 76], [67, 71, 74]],   // Am, G
      contrast:  [[71, 74, 78], [60, 64, 67]],   // Bm, C
      resolve:   [[64, 67, 71], [67, 71, 74]]    // Em, G — home
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords = chordsBySection[section];

      // Adventure chords drive hard — not many skips
      const skipChance = section === 'establish' ? 0.15 : 0.05;
      if (Math.random() < skipChance) {
        currentBeat += 2;
        continue;
      }

      const chord = chords[Math.floor(Math.random() * chords.length)];

      // Mix of stabs (short) and held chords for rhythmic variety
      const dur = section === 'resolve' ? 4 :
                  (Math.random() < 0.6 ? 2 : 1);
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      // Syncopation on off-beats for forward momentum
      const offset = (section !== 'resolve' && Math.random() < 0.25) ? 0.5 : 0;
      const chordBeat = currentBeat + offset;

      for (const midi of chord) {
        if (chordBeat < TOTAL_BEATS) {
          notes.push({
            id: nextId++, midi,
            startBeat: chordBeat,
            durBeats: Math.min(actualDur, TOTAL_BEATS - chordBeat),
            accidental: 0, staffIndex: 1
          });
        }
      }

      currentBeat += dur;
    }
  }

  function generateAdventureBass() {
    // Driving bass in E minor — quarter note pulse with occasional leaps.
    // Mirrors the chord roots with energy. Like a galloping horse.

    // E2=40, B2=47, A2=45, G2=43, D3=50, C3=48, F#2=42
    const bassRoots = transposeRoots({
      establish: [40, 43],   // E2, G2
      vary:      [45, 43],   // A2, G2
      contrast:  [47, 48],   // B2, C3
      resolve:   [47, 40]    // B2 → E2 (classic V-i cadence)
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const roots = bassRoots[section];

      // Bass drives in quarters — very few half notes
      const dur = Math.random() < 0.75 ? 1 : 2;
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);
      if (actualDur <= 0) break;

      const root = roots[Math.floor(Math.random() * roots.length)];

      notes.push({
        id: nextId++, midi: root,
        startBeat: currentBeat, durBeats: actualDur,
        accidental: 0, staffIndex: 2
      });

      // Add power-fifth on strong downbeats
      if (currentBeat % 2 === 0 && Math.random() < 0.5) {
        const fifth = root + 7;
        if (fifth <= 64) {
          notes.push({
            id: nextId++, midi: fifth,
            startBeat: currentBeat, durBeats: actualDur,
            accidental: 0, staffIndex: 2
          });
        }
      }

      currentBeat += dur;
    }
  }

  /* === BOSS BATTLE GENERATION === */

  function generateBossMelody() {
    // D Phrygian Dominant — the "devil's scale", dark and menacing
    // Characteristic: flat 2nd (Eb) creates extreme tension against the root
    // D4=62, Eb4=63, F4=65, G4=67, Ab4=68, Bb4=70, C5=72, D5=74, Eb5=75, F5=77, G5=79, Ab5=80
    const BOSS_SCALE = transposeArr([62, 63, 65, 67, 68, 70, 72, 74, 75, 77, 79, 80], getKeyOffset());
    //                               D4  Eb4 F4  G4  Ab4 Bb4 C5  D5  Eb5 F5  G5  Ab5
    // Menacing, relentless. Chromatic descents, tritone leaps (D→Ab = the "devil's interval"),
    // sudden silences followed by aggressive bursts.

    const rhythmsBySection = {
      // Establish: heavy, pounding, announces the threat
      establish: [[1, 1, 1, 1], [1.5, 0.5, 1, 1], [2, 0.5, 0.5, 1]],
      // Vary: faster, more frantic
      vary:      [[0.5, 0.5, 1, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [1, 0.5, 0.5, 1, 1]],
      // Contrast: peak chaos — rapid chromatic runs
      contrast:  [[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 1, 0.5, 1], [1, 0.5, 0.5, 0.5, 0.5, 1]],
      // Resolve: doesn't resolve peacefully — ends on a threat
      resolve:   [[2, 1, 1], [1.5, 0.5, 1, 1], [2, 0.5, 0.5, 1]]
    };

    let currentBeat = 0;
    let lastIndex = 0; // Start on D4

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];

      for (const dur of pattern) {
        if (currentBeat >= TOTAL_BEATS) break;

        // Boss music is relentless — minimal rests
        let restChance = 0.08;
        if (section === 'establish') restChance = 0.12; // Dramatic pauses

        if (Math.random() < restChance) {
          currentBeat += dur;
          continue;
        }

        // Chromatic and tritone-heavy movement
        const roll = Math.random();
        if (roll < 0.2) {
          // Leap to tritone (index 4 = Ab is tritone above D root)
          lastIndex = 4;
        } else if (roll < 0.35) {
          // Chromatic step (very boss-like)
          const dir = Math.random() < 0.5 ? 1 : -1;
          lastIndex = Math.max(0, Math.min(BOSS_SCALE.length - 1, lastIndex + dir));
        } else if (roll < 0.6) {
          // Scale step
          const dir = Math.random() < 0.45 ? 1 : -1; // Slight descending bias
          lastIndex = Math.max(0, Math.min(BOSS_SCALE.length - 1, lastIndex + dir));
        } else {
          // Larger leap for drama
          const dir = Math.random() < 0.5 ? 1 : -1;
          const jump = Math.floor(Math.random() * 3) + 2;
          lastIndex = Math.max(0, Math.min(BOSS_SCALE.length - 1, lastIndex + dir * jump));
        }

        // Contrast section: drive upward relentlessly
        if (section === 'contrast' && Math.random() < 0.4) {
          lastIndex = Math.min(BOSS_SCALE.length - 1, lastIndex + 1);
        }

        const midi = BOSS_SCALE[lastIndex];
        const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

        if (actualDur > 0) {
          notes.push({
            id: nextId++, midi,
            startBeat: currentBeat, durBeats: actualDur,
            accidental: 0, staffIndex: 0
          });
        }
        currentBeat += dur;
      }
    }
  }

  function generateBossRightHand() {
    // Dissonant, crushing chords. Tritones, diminished 7ths, flat-2 clusters.
    // No redemption — every chord is a threat.

    const chordsBySection = transposeChords({
      // Diminished and tritone voicings — all menace
      establish: [
        [62, 65, 68],        // Ddim: D F Ab (stacked minor 3rds)
        [62, 68]             // Tritone: D Ab (maximum tension)
      ],
      vary: [
        [62, 65, 68, 71],    // Ddim7: D F Ab B (fully diminished 7th)
        [63, 67, 70]         // Ebmaj: Eb G Bb (the menacing flat-2 chord)
      ],
      contrast: [
        [65, 68, 72],        // F Ab C (half-dim feel)
        [62, 65, 68, 71]     // Ddim7 again — maximum darkness
      ],
      resolve: [
        [63, 68],            // Eb Ab — tritone over flat-2, no resolution
        [62, 65, 68]         // Back to Ddim — no escape
      ]
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords = chordsBySection[section];

      // Boss chords hit hard and often
      const skipChance = 0.08;
      if (Math.random() < skipChance) {
        currentBeat += 1;
        continue;
      }

      const chord = chords[Math.floor(Math.random() * chords.length)];

      // Short stabs of dissonance for percussive impact
      const dur = section === 'contrast'
        ? (Math.random() < 0.6 ? 1 : 0.5)
        : (Math.random() < 0.5 ? 2 : 1);
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      for (const midi of chord) {
        notes.push({
          id: nextId++, midi,
          startBeat: currentBeat, durBeats: actualDur,
          accidental: 0, staffIndex: 1
        });
      }

      currentBeat += dur;
    }
  }

  function generateBossBass() {
    // Low, grinding bass. Pedal on D with chromatic stalking motion,
    // occasional burst up to Ab (the tritone) for maximum dread.

    // D2=38, Eb2=39, F2=41, G2=43, Ab2=44, Bb2=46, C3=48, D3=50
    const bassNotes = transposeRoots({
      establish: [38, 39],    // D2, Eb2 — pedal with chromatic grind
      vary:      [38, 44],    // D2, Ab2 — root and tritone
      contrast:  [44, 46],    // Ab2, Bb2 — away from root, maximum tension
      resolve:   [39, 38]     // Eb2 → D2 — chromatic "resolve" that still feels wrong
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const pool = bassNotes[section];

      // Boss bass: longer grinding notes, occasional fast chromatic
      let dur;
      if (section === 'contrast') {
        dur = Math.random() < 0.6 ? 1 : 2; // More motion in contrast
      } else {
        dur = Math.random() < 0.4 ? 2 : (Math.random() < 0.5 ? 1 : 4); // Big sustained slabs
      }

      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);
      if (actualDur <= 0) break;

      const root = pool[Math.floor(Math.random() * pool.length)];

      notes.push({
        id: nextId++, midi: root,
        startBeat: currentBeat, durBeats: actualDur,
        accidental: 0, staffIndex: 2
      });

      // Add tritone stab on strong beats for extra dread
      if (currentBeat % 4 === 0 && Math.random() < 0.45) {
        const tritone = root + 6; // Augmented 4th = tritone
        if (tritone <= 64) {
          notes.push({
            id: nextId++, midi: tritone,
            startBeat: currentBeat, durBeats: Math.min(actualDur, 1),
            accidental: 0, staffIndex: 2
          });
        }
      }

      currentBeat += dur;
    }
  }

  /* --- Mystic --- */
  function generateMystic() {
    // Sparse, breathing dark-ambient feel — slow melody drives right-hand fifths and bass drones
    // D Dorian/Phrygian hybrid: root movement and tritone stabs create ritual tension
    const melodyScale = transposeArr([62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81], getKeyOffset());
    let currentBeat = 0;
    let lastIndex = 3;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const durOptions = section === 'resolve' ? [4, 6] : [2, 3, 4];
      const dur = durOptions[Math.floor(Math.random() * durOptions.length)];

      // 35% chance of silence — lots of breathing space
      if (Math.random() < 0.35) {
        currentBeat += dur;
        continue;
      }

      const dir = Math.random() < 0.5 ? -1 : 1;
      const jump = Math.random() < 0.25 ? 2 : 1;
      lastIndex = Math.max(0, Math.min(melodyScale.length - 1, lastIndex + dir * jump));

      const midi = melodyScale[lastIndex];
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      // Melody (staff 0)
      notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 0 });

      // Right hand: open fifth above melody — swell slightly shorter for trailing resonance
      if (Math.random() < 0.6) {
        const fifth = midi + 7;
        if (fifth <= STAVES[1].maxMidi) {
          notes.push({ id: nextId++, midi: fifth, startBeat: currentBeat, durBeats: Math.max(1, actualDur - 0.5), accidental: 0, staffIndex: 1 });
        }
      }

      // Bass: deep sustained root, two octaves below melody
      const bassRoot = Math.max(STAVES[2].minMidi, midi - 24);
      notes.push({ id: nextId++, midi: bassRoot, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });

      // Occasional tritone stab in bass for dread
      if (Math.random() < 0.3) {
        const tritone = bassRoot + 6;
        if (tritone <= STAVES[2].maxMidi && currentBeat + 1 < TOTAL_BEATS) {
          notes.push({ id: nextId++, midi: tritone, startBeat: currentBeat + 1, durBeats: 2, accidental: 0, staffIndex: 2 });
        }
      }

      currentBeat += dur;
    }
  }

  /* === VICTORY / FANFARE GENERATION === */

  function generateVictoryMelody() {
    // C major — the brightest, most triumphant key
    // C4=60 D4=62 E4=64 F4=65 G4=67 A4=69 B4=71 C5=72 D5=74 E5=76 F5=77 G5=79 A5=81
    const VICTORY_SCALE = transposeArr([60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81], getKeyOffset());
    // Fanfare-style: dotted rhythms, rising phrases, strong upward bias.
    // Think JRPG victory theme — punchy, celebratory, resolves cleanly to C.

    const rhythmsBySection = {
      // Establish: signature fanfare figure — dotted quarter + eighth patterns
      establish: [[1.5, 0.5, 1, 1], [1, 1, 1, 1], [0.5, 0.5, 1, 0.5, 0.5, 1]],
      // Vary: more motion, rising runs
      vary:      [[0.5, 0.5, 1, 0.5, 0.5, 1], [1.5, 0.5, 0.5, 0.5, 1], [1, 0.5, 0.5, 1, 1]],
      // Contrast: peak energy — short bursts and big leaps
      contrast:  [[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1], [0.5, 0.5, 1, 1, 1], [1, 0.5, 0.5, 0.5, 0.5, 1]],
      // Resolve: triumphant landing — long held tones
      resolve:   [[2, 1, 1], [4], [1.5, 0.5, 2]]
    };

    let currentBeat = 0;
    let lastIndex = 4; // Start on G4 — the 5th, a classic fanfare opener

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];

      for (const dur of pattern) {
        if (currentBeat >= TOTAL_BEATS) break;

        // Victory melodies keep moving — very few rests
        let restChance = 0.08;
        if (section === 'resolve') restChance = 0.15;

        if (Math.random() < restChance) {
          currentBeat += dur;
          continue;
        }

        // Upward bias — rising phrases feel triumphant
        const dir = Math.random() < 0.65 ? 1 : -1;
        // Fanfare leaps: 4ths and 5ths are characteristically heroic/bright
        const leapChance = section === 'contrast' ? 0.4 : 0.2;
        const jump = Math.random() < leapChance
          ? (Math.random() < 0.5 ? 3 : 4) // 4th or 5th in scale steps
          : 1;
        lastIndex = Math.max(0, Math.min(VICTORY_SCALE.length - 1, lastIndex + dir * jump));

        // Contrast climbs to the top of the range
        if (section === 'contrast' && Math.random() < 0.3) {
          lastIndex = Math.min(VICTORY_SCALE.length - 1, lastIndex + 1);
        }

        // Resolve falls home to C (index 0 = C4, index 7 = C5)
        if (section === 'resolve' && Math.random() < 0.6) {
          const target = lastIndex >= 7 ? 7 : 0;
          lastIndex += lastIndex > target ? -1 : (lastIndex < target ? 1 : 0);
        }

        const midi = VICTORY_SCALE[lastIndex];
        const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

        if (actualDur > 0) {
          notes.push({
            id: nextId++, midi,
            startBeat: currentBeat, durBeats: actualDur,
            accidental: 0, staffIndex: 0
          });
        }
        currentBeat += dur;
      }
    }
  }

  function generateVictoryRightHand() {
    // Bright major chord stabs — I, IV, V, vi.
    // Punchy hits with occasional arpeggiated flourishes.

    const chordsBySection = transposeChords({
      establish: [[60, 64, 67], [67, 71, 74]],   // C, G — I V opening
      vary:      [[65, 69, 72], [67, 71, 74]],   // F, G — IV V build
      contrast:  [[69, 72, 76], [62, 65, 69]],   // Am, Dm — brief emotion
      resolve:   [[67, 71, 74], [60, 64, 67]]    // G→C — V-I cadence home
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords = chordsBySection[section];

      // Victory chords hit confidently — minimal skips
      const skipChance = section === 'establish' ? 0.1 : 0.05;
      if (Math.random() < skipChance) {
        currentBeat += 2;
        continue;
      }

      const chord = chords[Math.floor(Math.random() * chords.length)];
      const dur = section === 'resolve' ? 4 : (Math.random() < 0.6 ? 2 : 1);
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      // Occasionally arpeggiate for a bright harp/keyboard flourish
      const arpeggiate = Math.random() < 0.25;

      for (let i = 0; i < chord.length; i++) {
        const offset = arpeggiate ? i * 0.25 : 0;
        const noteBeat = currentBeat + offset;
        const noteDur = Math.max(0.5, actualDur - offset);

        if (noteBeat < TOTAL_BEATS && noteDur > 0) {
          notes.push({
            id: nextId++, midi: chord[i],
            startBeat: noteBeat, durBeats: noteDur,
            accidental: 0, staffIndex: 1
          });
        }
      }

      currentBeat += dur;
    }
  }

  function generateVictoryBass() {
    // Bouncy, energetic bass. Strong root hits on beat 1, walking/leaping motion.
    // C2=36 G2=43 F2=41 A2=45 D3=50 E3=52 B2=47

    const bassRoots = transposeRoots({
      establish: [36, 43],   // C2, G2 — I V
      vary:      [41, 43],   // F2, G2 — IV V
      contrast:  [45, 50],   // A2, D3 — vi ii
      resolve:   [43, 36]    // G2 → C2 — V-I
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const roots = bassRoots[section];

      // Bouncy quarter-note drive — faster than adventure, lighter than boss
      const dur = Math.random() < 0.7 ? 1 : 2;
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);
      if (actualDur <= 0) break;

      const root = roots[Math.floor(Math.random() * roots.length)];

      notes.push({
        id: nextId++, midi: root,
        startBeat: currentBeat, durBeats: actualDur,
        accidental: 0, staffIndex: 2
      });

      // Add octave on strong downbeats for a full, bright sound
      if (currentBeat % 2 === 0 && Math.random() < 0.45) {
        const octave = root + 12;
        if (octave <= 64) {
          notes.push({
            id: nextId++, midi: octave,
            startBeat: currentBeat, durBeats: actualDur,
            accidental: 0, staffIndex: 2
          });
        }
      }

      currentBeat += dur;
    }
  }

  /* === EVENT LISTENERS === */

  function handleKeyDown(e) {
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      undo();
    }
  }

  function setupEventListeners() {
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

    // Snap selector - rebuild grids when changed
    const snapSelector = document.getElementById('snap');
    if (snapSelector) {
      snapSelector.addEventListener('change', () => {
        initializeGrids();
      });
    }
  }

  /* === INITIALIZATION === */

  function initialize() {
    setupEventListeners();
    initializeGrids();
  }

  initialize();

})();
