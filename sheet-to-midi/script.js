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

    generateMelodyStaff(mode);
    generateRightHandStaff(mode);
    generateBassStaff(mode);

    updateAllGrids();
  }

  function generateMelodyStaff(mode) {
    const scale = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81];

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
    const chordProgressions = {
      establish: [[60, 64, 67], [65, 69, 72]],
      vary: [[67, 71, 74], [64, 67, 71]],
      contrast: [[69, 72, 76], [62, 65, 69]],
      resolve: [[67, 71, 74], [60, 64, 67]]
    };

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
    const bassProgression = {
      establish: [48, 53],
      vary: [55, 52],
      contrast: [57, 50],
      resolve: [55, 48]
    };

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
