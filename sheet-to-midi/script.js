/* ====================================================
   MIDI MAGIC — MIDI Forge Labs
   One-click 8-bar MIDI generator with 9 Magic Modes
   Generation engine: three-staff (Melody / Right Hand / Left Hand)
   ==================================================== */

(() => {
  /* === MUSICAL CONSTANTS === */
  const TPQ = 480;            // ticks per quarter note
  const MEASURES = 8;
  const TIME_SIG_NUM = 4;
  const TOTAL_BEATS = MEASURES * TIME_SIG_NUM; // 32 beats

  /* === STAFF CONFIGURATION === */
  const STAVES = [
    { name: 'Melody',     clef: 'treble', minMidi: 60, maxMidi: 81, channel: 0, color: '#a8c8ff', waveform: 'sine' },
    { name: 'Right Hand', clef: 'treble', minMidi: 60, maxMidi: 81, channel: 1, color: '#a8e8c0', waveform: 'triangle' },
    { name: 'Left Hand',  clef: 'bass',   minMidi: 36, maxMidi: 64, channel: 2, color: '#ffd8a0', waveform: 'sawtooth' }
  ];

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /* === MODE DEFINITIONS === */
  const MODES_DATA = [
    { id: 'phrase',    emoji: '✨', name: 'Phrase',      vibe: 'Evolving 8-bar arc',    key: 'C major',      color: '#7c9aff' },
    { id: 'loop',      emoji: '🔁', name: 'Loop',        vibe: 'Tight & repetitive',    key: 'C major',      color: '#60c8ff' },
    { id: 'drift',     emoji: '🌊', name: 'Drift',       vibe: 'Sparse & asymmetric',   key: 'C major',      color: '#50dde0' },
    { id: 'fantasy',   emoji: '🏰', name: 'Fantasy',     vibe: 'Medieval, modal',        key: 'D Dorian',     color: '#ffd27c' },
    { id: 'lofi',      emoji: '🎧', name: 'Lo-fi',       vibe: 'Jazzy Nujabes vibes',   key: 'C jazz/blues', color: '#c8a8ff' },
    { id: 'adventure', emoji: '⚔️', name: 'Adventure',  vibe: 'Heroic & driving',      key: 'E minor',      color: '#7ee8a8' },
    { id: 'boss',      emoji: '💀', name: 'Boss Battle', vibe: 'Dark & intense',         key: 'D Phrygian',   color: '#ff7c7c' },
    { id: 'mystic',    emoji: '🌫️', name: 'Mystic',      vibe: 'Dark ambient, ritual',  key: 'D Dorian',     color: '#9a80ff' },
    { id: 'victory',   emoji: '🏆', name: 'Victory',     vibe: 'Upbeat fanfare',        key: 'C major',      color: '#ffe87c' },
  ];

  /* === APPLICATION STATE === */
  let notes = []; // { id, midi, startBeat, durBeats, accidental, staffIndex }
  let nextId = 1;
  const history = [];
  let selectedModeId = 'phrase';

  /* === UTILITY FUNCTIONS === */

  function hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function getSnap() {
    return parseInt(document.getElementById('snap').value, 10);
  }

  /* === KEY TRANSPOSITION UTILITIES === */

  function getKeyOffset() {
    const el = document.getElementById('keyShift');
    return el ? parseInt(el.value, 10) : 0;
  }

  function transposeArr(arr, n) {
    return n === 0 ? arr : arr.map(v => v + n);
  }

  function transposeChords(sections, n) {
    if (n === 0) return sections;
    const out = {};
    for (const [key, chords] of Object.entries(sections)) {
      out[key] = chords.map(chord => chord.map(v => v + n));
    }
    return out;
  }

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
      updateCompositionInfo();
    }
  }

  /* === COMPOSITION DISPLAY === */

  function updateCompositionInfo() {
    const mode = MODES_DATA.find(m => m.id === selectedModeId);
    const infoEl = document.getElementById('compInfo');
    if (!infoEl || !mode) return;

    if (notes.length > 0) {
      const melodyCount  = notes.filter(n => n.staffIndex === 0).length;
      const rightCount   = notes.filter(n => n.staffIndex === 1).length;
      const bassCount    = notes.filter(n => n.staffIndex === 2).length;
      infoEl.textContent = `${mode.name}  \u2022  ${mode.key}  \u2022  8 bars  \u2022  ${notes.length} notes  (M:${melodyCount} / RH:${rightCount} / LH:${bassCount})`;
    } else {
      infoEl.textContent = 'No composition \u2014 pick a mode and generate';
    }

    // Flash the composition panel
    const panel = document.querySelector('.composition-panel');
    if (panel && notes.length > 0) {
      panel.classList.add('flash');
      setTimeout(() => panel.classList.remove('flash'), 400);
    }
  }

  // Kept as alias so all generation call-sites still work
  function updateAllGrids() {
    updateCompositionInfo();
  }

  function clearAllNotes() {
    pushHistory();
    notes = [];
    updateCompositionInfo();
  }

  /* === MODE CARDS === */

  function buildModeCards() {
    const container = document.getElementById('modeCards');
    if (!container) return;
    container.innerHTML = '';

    for (const mode of MODES_DATA) {
      const card = document.createElement('div');
      card.className = 'mode-card' + (mode.id === selectedModeId ? ' selected' : '');
      card.dataset.mode = mode.id;

      card.style.setProperty('--card-color', mode.color);
      card.style.setProperty('--card-glow',  hexToRgba(mode.color, 0.22));
      card.style.setProperty('--card-bg',    hexToRgba(mode.color, 0.22));

      card.innerHTML = `
        <div class="card-emoji">${mode.emoji}</div>
        <div class="card-name">${mode.name}</div>
        <div class="card-vibe">${mode.vibe}</div>
        <div class="card-key">${mode.key}</div>
      `;

      card.addEventListener('click', () => selectMode(mode.id));
      container.appendChild(card);
    }
  }

  function selectMode(modeId) {
    selectedModeId = modeId;

    document.querySelectorAll('.mode-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.mode === modeId);
    });

    const mode = MODES_DATA.find(m => m.id === modeId);
    const genBtn = document.getElementById('generateBtn');
    if (genBtn && mode) {
      genBtn.innerHTML = `&#10022; GENERATE &mdash; ${mode.name}`;
    }

    generateRandomMelody();
  }

  /* === PLAYBACK FUNCTIONS === */

  let audio = null;
  let masterGain = null;
  let isPlaying = false;
  let isLooping = false;
  let activeOscillators = [];
  let playbackTimeout = null;
  let playbackStartTime = 0;
  let totalPlayDuration = 0;
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

    if (audio.state === 'suspended') audio.resume();

    isPlaying = true;
    updatePlayButton();
    playOnce();
  }

  function playOnce() {
    if (!isPlaying) return;

    const bpm = parseInt(document.getElementById('bpm').value, 10);
    const secPerBeat = 60 / bpm;
    playbackStartTime = audio.currentTime + 0.05;
    totalPlayDuration = TOTAL_BEATS * secPerBeat;

    for (const n of notes) {
      const oscData = playNoteAudio(n, playbackStartTime, secPerBeat);
      activeOscillators.push(oscData);
    }

    if (isLooping) {
      playbackTimeout = setTimeout(() => {
        if (isPlaying && isLooping) playOnce();
      }, totalPlayDuration * 1000);
    } else {
      playbackTimeout = setTimeout(() => {
        if (isPlaying && !isLooping) stopPlayback();
      }, totalPlayDuration * 1000 + 100);
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
    const btn = document.getElementById('loop');
    if (btn) btn.classList.toggle('active', isLooping);
  }

  function updatePlayButton() {
    const btn = document.getElementById('play');
    if (!btn) return;
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

  function playNoteAudio(note, startTime, secPerBeat) {
    const staff = STAVES[note.staffIndex];
    const t0 = startTime + note.startBeat * secPerBeat;
    const t1 = t0 + note.durBeats * secPerBeat;
    const freq = 440 * Math.pow(2, (note.midi - 69) / 12);

    const osc  = audio.createOscillator();
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

  /* === WAVEFORM CANVAS === */

  function initWaveform() {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;

    const BAR_COUNT = 48;
    const phases = Array.from({ length: BAR_COUNT }, () => Math.random() * Math.PI * 2);
    const speeds = Array.from({ length: BAR_COUNT }, () => 0.6 + Math.random() * 1.8);
    const noiseSeeds = Array.from({ length: BAR_COUNT }, () => Math.random());

    function resizeCanvas() {
      canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth : 800;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function drawWaveform() {
      const W = canvas.width;
      const H = canvas.height;
      const ctx = canvas.getContext('2d');
      const t = performance.now() / 1000;

      ctx.clearRect(0, 0, W, H);

      const gap   = 2;
      const barW  = Math.max(2, (W - gap * (BAR_COUNT - 1)) / BAR_COUNT);
      const mode  = MODES_DATA.find(m => m.id === selectedModeId);
      const color = mode ? mode.color : '#7c9aff';
      const cr    = parseInt(color.slice(1, 3), 16);
      const cg    = parseInt(color.slice(3, 5), 16);
      const cb    = parseInt(color.slice(5, 7), 16);

      let progress = 0;
      if (isPlaying && audio && totalPlayDuration > 0) {
        const elapsed = audio.currentTime - playbackStartTime;
        progress = (elapsed / totalPlayDuration) % 1;
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        const phase = phases[i];
        const speed = speeds[i];
        let h;

        if (isPlaying) {
          const wave          = Math.abs(Math.sin(t * speed + phase));
          const barPos        = i / BAR_COUNT;
          const distFromHead  = Math.abs(barPos - progress);
          const near          = Math.max(0, 1 - distFromHead * 10);
          h  = H * (0.1 + 0.38 * wave + 0.28 * near);
          h += (noiseSeeds[i] - 0.5) * H * 0.08;
        } else {
          // Idle: very gentle breathing
          const wave = Math.abs(Math.sin(t * 0.35 * speeds[i] * 0.25 + phase));
          h = H * (0.04 + 0.07 * wave);
        }

        h = Math.max(3, Math.min(H - 2, h));

        const x         = i * (barW + gap);
        const y         = (H - h) / 2;
        const intensity  = h / H;
        const alpha      = isPlaying ? (0.25 + 0.7 * intensity) : 0.18;

        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
        ctx.fillRect(x, y, barW, h);
      }

      // Playhead line
      if (isPlaying && totalPlayDuration > 0) {
        const px = progress * W;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, H);
        ctx.stroke();
        ctx.restore();
      }

      requestAnimationFrame(drawWaveform);
    }

    drawWaveform();
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

    const mode = MODES_DATA.find(m => m.id === selectedModeId);
    const filename = mode
      ? `midi-magic-${mode.name.toLowerCase().replace(/\s+/g, '-')}.mid`
      : 'midi-magic.mid';
    downloadBytes(midiData, filename);
  }

  function vlq(value) {
    const bytes = [];
    let val = Math.max(0, (value | 0) >>> 0);
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
    function pushBytes(...arr) { for (const x of arr) events.push(x); }

    pushBytes(...vlq(0), 0xFF, 0x51, 0x03,
      (microPerQuarter >> 16) & 255,
      (microPerQuarter >> 8) & 255,
       microPerQuarter & 255);

    pushBytes(...vlq(0), 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);
    pushBytes(...vlq(0), 0xFF, 0x2F, 0x00);

    return new Uint8Array(events);
  }

  function buildStaffTrack(staffNotes, staff, staffIndex) {
    const events = [];
    function pushBytes(...arr) { for (const x of arr) events.push(x); }

    const nameBytes = [];
    for (let i = 0; i < staff.name.length; i++) nameBytes.push(staff.name.charCodeAt(i));
    pushBytes(...vlq(0), 0xFF, 0x03, nameBytes.length, ...nameBytes);

    const programs = [0, 48, 32];
    const channel  = staff.channel;
    pushBytes(...vlq(0), 0xC0 | channel, programs[staffIndex] || 0);

    if (staffNotes.length === 0) {
      pushBytes(...vlq(0), 0xFF, 0x2F, 0x00);
      return new Uint8Array(events);
    }

    const sortedNotes = [...staffNotes].sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);

    const allEvents = [];
    for (const n of sortedNotes) {
      const onTick   = beatToTicks(n.startBeat);
      const offTick  = beatToTicks(n.startBeat + n.durBeats);
      const velocity = 96;
      const midiVal  = Math.max(0, Math.min(127, (n.midi + (n.accidental || 0)) | 0));

      allEvents.push({ tick: onTick,  type: 'on',  midi: midiVal, velocity });
      allEvents.push({ tick: offTick, type: 'off', midi: midiVal });
    }

    allEvents.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      if (a.type === 'off' && b.type === 'on') return -1;
      if (a.type === 'on'  && b.type === 'off') return 1;
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
    function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
    function u16(n) { return [(n >>> 8) & 255, n & 255]; }

    const header = [
      0x4d, 0x54, 0x68, 0x64,
      ...u32(6),
      ...u16(1),
      ...u16(tracks.length),
      ...u16(TPQ),
    ];

    let totalSize = header.length;
    for (const track of tracks) totalSize += 8 + track.length;

    const full = new Uint8Array(totalSize);
    let offset = 0;

    full.set(header, offset);
    offset += header.length;

    for (const trackData of tracks) {
      const trackHeader = [0x4d, 0x54, 0x72, 0x6b, ...u32(trackData.length)];
      full.set(trackHeader, offset);
      offset += trackHeader.length;
      full.set(trackData, offset);
      offset += trackData.length;
    }

    return full;
  }

  function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: 'audio/midi' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* === MAGIC GENERATION === */

  function getMagicMode() {
    return selectedModeId;
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

    updateCompositionInfo();
  }

  function generateMelodyStaff(mode) {
    const scale = transposeArr([60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81], getKeyOffset());

    const rhythmsBySection = {
      establish: [[1, 1, 1, 1], [2, 1, 1], [1, 0.5, 0.5, 1, 1]],
      vary:      [[1, 1, 2], [0.5, 0.5, 1, 0.5, 0.5, 1], [1, 1, 1, 1]],
      contrast:  [[2, 2], [1, 1, 1, 1], [0.5, 0.5, 0.5, 0.5, 1, 1]],
      resolve:   [[2, 1, 1], [4], [2, 2], [1, 1, 2]]
    };

    const modeConfig = {
      loop:   { restChance: 0.15, motifRepeat: true,  densityMultiplier: 1.2 },
      phrase: { restChance: 0.2,  motifRepeat: false, densityMultiplier: 1.0 },
      drift:  { restChance: 0.4,  motifRepeat: false, densityMultiplier: 0.6 }
    };
    const config = modeConfig[mode];

    let currentBeat = 0;
    let lastIndex   = Math.floor(scale.length / 2);
    let motif       = [];

    if (mode === 'loop') {
      while (currentBeat < 8) {
        const patterns = rhythmsBySection.establish;
        const pattern  = patterns[Math.floor(Math.random() * patterns.length)];

        for (const dur of pattern) {
          if (currentBeat >= 8) break;

          if (Math.random() < config.restChance) {
            currentBeat += dur;
            continue;
          }

          const step  = Math.random() < 0.5 ? -1 : 1;
          const jump  = Math.floor(Math.random() * 2) + 1;
          lastIndex   = Math.max(0, Math.min(scale.length - 1, lastIndex + step * jump));

          const midi      = scale[lastIndex];
          const actualDur = Math.min(dur, 8 - currentBeat);

          if (actualDur > 0) {
            notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 0 });
            motif.push({ midi, startBeat: currentBeat, durBeats: actualDur });
          }
          currentBeat += dur;
        }
      }

      for (const repeatOffset of [8, 16, 24]) {
        for (const m of motif) {
          const newMidi = m.midi + (Math.random() < 0.2 ? (Math.random() < 0.5 ? 2 : -2) : 0);
          notes.push({ id: nextId++, midi: Math.max(60, Math.min(81, newMidi)), startBeat: m.startBeat + repeatOffset, durBeats: m.durBeats, accidental: 0, staffIndex: 0 });
        }
      }
      return;
    }

    while (currentBeat < TOTAL_BEATS) {
      const section  = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern  = patterns[Math.floor(Math.random() * patterns.length)];

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
        lastIndex  = Math.max(0, Math.min(scale.length - 1, lastIndex + step * jump));

        if (section === 'resolve' && Math.random() < 0.4) {
          lastIndex = Math.max(0, lastIndex - 1);
        }

        const midi      = scale[lastIndex];
        const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

        if (actualDur > 0) {
          notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 0 });
        }
        currentBeat += dur;
      }
    }
  }

  function generateRightHandStaff(mode) {
    const chordProgressions = transposeChords({
      establish: [[60, 64, 67], [65, 69, 72]],
      vary:      [[67, 71, 74], [64, 67, 71]],
      contrast:  [[69, 72, 76], [62, 65, 69]],
      resolve:   [[67, 71, 74], [60, 64, 67]]
    }, getKeyOffset());

    if (mode === 'loop') {
      const motif = [];
      let currentBeat = 0;

      while (currentBeat < 8) {
        const chord     = chordProgressions.establish[Math.floor(Math.random() * 2)];
        const dur       = 2;
        const actualDur = Math.min(dur, 8 - currentBeat);

        for (const midi of chord) {
          motif.push({ midi, startBeat: currentBeat, durBeats: actualDur });
          notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 1 });
        }
        currentBeat += dur;
      }

      for (const repeatOffset of [8, 16, 24]) {
        for (const m of motif) {
          notes.push({ id: nextId++, midi: m.midi, startBeat: m.startBeat + repeatOffset, durBeats: m.durBeats, accidental: 0, staffIndex: 1 });
        }
      }
      return;
    }

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords  = chordProgressions[section];

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

      const chord     = chords[Math.floor(Math.random() * chords.length)];
      const dur       = section === 'resolve' ? 4 : 2;
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
        notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 1 });
      }
      currentBeat += dur;
    }
  }

  function generateBassStaff(mode) {
    const bassProgression = transposeRoots({
      establish: [48, 53],
      vary:      [55, 52],
      contrast:  [57, 50],
      resolve:   [55, 48]
    }, getKeyOffset());

    if (mode === 'loop') {
      const motif = [];
      let currentBeat = 0;

      while (currentBeat < 8) {
        const root      = bassProgression.establish[Math.floor(Math.random() * 2)];
        const dur       = 2;
        const actualDur = Math.min(dur, 8 - currentBeat);

        motif.push({ midi: root, startBeat: currentBeat, durBeats: actualDur });
        notes.push({ id: nextId++, midi: root, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });

        if (currentBeat % 4 === 0 && root + 7 <= 64) {
          motif.push({ midi: root + 7, startBeat: currentBeat, durBeats: actualDur });
          notes.push({ id: nextId++, midi: root + 7, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });
        }
        currentBeat += dur;
      }

      for (const repeatOffset of [8, 16, 24]) {
        for (const m of motif) {
          notes.push({ id: nextId++, midi: m.midi, startBeat: m.startBeat + repeatOffset, durBeats: m.durBeats, accidental: 0, staffIndex: 2 });
        }
      }
      return;
    }

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const roots   = bassProgression[section];

      if (mode === 'drift' && Math.random() < 0.35) {
        currentBeat += 2;
        continue;
      }

      let dur = 2;
      if (mode === 'phrase' && section === 'contrast') dur = 1;
      else if (section === 'resolve') dur = 4;

      const root      = roots[Math.floor(Math.random() * roots.length)];
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      let octaveShift = 0;
      if (mode === 'phrase' && section === 'contrast') octaveShift = 12;

      notes.push({ id: nextId++, midi: root + octaveShift, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });

      if (section !== 'resolve' && mode !== 'drift' && currentBeat % 4 === 0 && root + 7 + octaveShift <= 64) {
        notes.push({ id: nextId++, midi: root + 7 + octaveShift, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });
      }

      currentBeat += dur;
    }
  }

  /* === FANTASY / MEDIEVAL GENERATION === */

  function generateFantasyMelody() {
    const DORIAN_MELODY = transposeArr([62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81], getKeyOffset());

    const rhythmsBySection = {
      establish: [[2, 2], [2, 1, 1], [1, 1, 2]],
      vary:      [[1, 1, 1, 1], [2, 1, 0.5, 0.5], [1, 0.5, 0.5, 1, 1]],
      contrast:  [[1, 1, 1, 1], [0.5, 0.5, 1, 1, 1], [2, 1, 1]],
      resolve:   [[2, 2], [4], [1, 1, 2]]
    };

    let currentBeat = 0;
    let lastIndex   = 3;

    while (currentBeat < TOTAL_BEATS) {
      const section  = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern  = patterns[Math.floor(Math.random() * patterns.length)];

      for (const dur of pattern) {
        if (currentBeat >= TOTAL_BEATS) break;

        let restChance = 0.15;
        if (section === 'resolve')  restChance = 0.25;
        if (section === 'contrast') restChance = 0.1;

        if (Math.random() < restChance) {
          currentBeat += dur;
          continue;
        }

        const leapChance = section === 'contrast' ? 0.25 : 0.1;
        const dir  = Math.random() < 0.5 ? -1 : 1;
        const jump = Math.random() < leapChance ? 2 : 1;
        lastIndex  = Math.max(0, Math.min(DORIAN_MELODY.length - 1, lastIndex + dir * jump));

        if (section === 'resolve' && Math.random() < 0.5) {
          const target = Math.random() < 0.6 ? 0 : 4;
          lastIndex += lastIndex > target ? -1 : (lastIndex < target ? 1 : 0);
        }
        if (section === 'contrast' && Math.random() < 0.3) {
          lastIndex = Math.min(DORIAN_MELODY.length - 1, lastIndex + 1);
        }

        const midi      = DORIAN_MELODY[lastIndex];
        const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

        if (actualDur > 0) {
          notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 0 });
        }
        currentBeat += dur;
      }
    }
  }

  function generateFantasyRightHand() {
    const chordsBySection = transposeChords({
      establish: [[62, 69], [67, 74]],
      vary:      [[69, 76], [65, 72]],
      contrast:  [[64, 71], [67, 74]],
      resolve:   [[69, 76], [62, 69]]
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords  = chordsBySection[section];

      let skipChance = 0.2;
      if (section === 'establish') skipChance = 0.35;
      if (section === 'contrast')  skipChance = 0.1;
      if (section === 'resolve')   skipChance = 0.3;

      if (Math.random() < skipChance) {
        currentBeat += 2;
        continue;
      }

      const chord     = chords[Math.floor(Math.random() * chords.length)];
      const dur       = section === 'resolve' ? 4 : 2;
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);
      const arpeggiate = Math.random() < 0.3;

      for (let i = 0; i < chord.length; i++) {
        const offset  = arpeggiate ? i * 0.5 : 0;
        const noteBeat = currentBeat + offset;
        const noteDur  = Math.max(0.5, actualDur - offset);

        if (noteBeat < TOTAL_BEATS && noteDur > 0) {
          notes.push({ id: nextId++, midi: chord[i], startBeat: noteBeat, durBeats: noteDur, accidental: 0, staffIndex: 1 });
        }
      }

      if (Math.random() < 0.2 && chord[0] - 12 >= 60) {
        notes.push({ id: nextId++, midi: chord[0] - 12, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 1 });
      }

      currentBeat += dur;
    }
  }

  function generateFantasyBass() {
    const droneRoots = transposeRoots({
      establish: [38, 50],
      vary:      [38, 45],
      contrast:  [45, 43],
      resolve:   [45, 38]
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const roots   = droneRoots[section];

      let dur;
      if (section === 'establish' || section === 'resolve') dur = 4;
      else if (section === 'contrast') dur = 2;
      else dur = Math.random() < 0.5 ? 4 : 2;

      const root      = roots[Math.floor(Math.random() * roots.length)];
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      notes.push({ id: nextId++, midi: root, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });

      if (currentBeat % 4 === 0 && Math.random() < 0.6) {
        const fifth = root + 7;
        if (fifth <= 64) {
          notes.push({ id: nextId++, midi: fifth, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });
        }
      }

      currentBeat += dur;
    }
  }

  /* === LO-FI / NUJABES GENERATION === */

  function generateLofiMelody() {
    const LOFI_MELODY = transposeArr([60, 62, 64, 65, 67, 69, 70, 71, 72, 74, 76, 77, 79, 81], getKeyOffset());
    const pentatonicIndices = [0, 1, 2, 4, 5, 8, 9, 10, 12];

    const rhythmsBySection = {
      establish: [[0.5, 1, 0.5, 1, 1], [1, 0.5, 0.5, 1, 1], [1.5, 0.5, 1, 1]],
      vary:      [[0.5, 0.5, 1, 0.5, 0.5, 1], [0.5, 1.5, 1, 1], [1, 0.5, 0.5, 0.5, 0.5, 1]],
      contrast:  [[0.5, 0.5, 0.5, 0.5, 1, 1], [1, 1, 0.5, 0.5, 1], [2, 0.5, 0.5, 1]],
      resolve:   [[1.5, 0.5, 2], [1, 1, 2], [2, 2]]
    };

    let currentBeat = 0;
    let lastIndex   = 5;
    let lastWasPentatonic = true;

    while (currentBeat < TOTAL_BEATS) {
      const section  = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern  = patterns[Math.floor(Math.random() * patterns.length)];

      for (const dur of pattern) {
        if (currentBeat >= TOTAL_BEATS) break;

        let restChance = 0.2;
        if (section === 'resolve') restChance = 0.3;
        if (currentBeat % 2 === 0 && Math.random() < 0.15) restChance += 0.15;

        if (Math.random() < restChance) {
          currentBeat += dur;
          continue;
        }

        if (lastWasPentatonic && Math.random() < 0.3) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          lastIndex = Math.max(0, Math.min(LOFI_MELODY.length - 1, lastIndex + dir));
          lastWasPentatonic = false;
        } else {
          const targetPool = pentatonicIndices.filter(i => Math.abs(i - lastIndex) <= 3);
          if (targetPool.length > 0) {
            lastIndex = targetPool[Math.floor(Math.random() * targetPool.length)];
          } else {
            const dir = Math.random() < 0.5 ? -1 : 1;
            lastIndex = Math.max(0, Math.min(LOFI_MELODY.length - 1, lastIndex + dir * 2));
          }
          lastWasPentatonic = true;
        }

        if (section === 'resolve' && Math.random() < 0.5) {
          const target = Math.random() < 0.6 ? 5 : 8;
          lastIndex += lastIndex > target ? -1 : (lastIndex < target ? 1 : 0);
        }

        const midi      = LOFI_MELODY[lastIndex];
        const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

        if (actualDur > 0) {
          notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 0 });
        }
        currentBeat += dur;
      }
    }
  }

  function generateLofiRightHand() {
    const chordsBySection = transposeChords({
      establish: [[69, 72, 76, 79], [62, 65, 69, 72]],
      vary:      [[65, 69, 72, 76], [67, 71, 74, 77]],
      contrast:  [[64, 67, 71, 74], [60, 64, 67, 71]],
      resolve:   [[62, 65, 69, 72], [69, 72, 76, 79]]
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords  = chordsBySection[section];

      let skipChance = 0.15;
      if (section === 'establish') skipChance = 0.25;
      if (section === 'resolve')   skipChance = 0.2;

      if (Math.random() < skipChance) {
        currentBeat += 2;
        continue;
      }

      const chord     = chords[Math.floor(Math.random() * chords.length)];
      const dur       = section === 'resolve' ? 4 : 2;
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      let voicing;
      const roll = Math.random();
      if (roll < 0.4) {
        voicing = chord;
      } else if (roll < 0.7) {
        voicing = [chord[0], chord[2], chord[3]];
      } else {
        voicing = [chord[0], chord[1], chord[3]];
      }

      const offset    = Math.random() < 0.3 ? -0.5 : 0;
      const chordBeat = Math.max(0, currentBeat + offset);

      for (const midi of voicing) {
        if (chordBeat >= 0 && chordBeat < TOTAL_BEATS) {
          notes.push({ id: nextId++, midi, startBeat: chordBeat, durBeats: Math.min(actualDur, TOTAL_BEATS - chordBeat), accidental: 0, staffIndex: 1 });
        }
      }

      currentBeat += dur;
    }
  }

  function generateLofiBass() {
    const bassRoots = transposeRoots({
      establish: [45, 50],
      vary:      [53, 55],
      contrast:  [52, 48],
      resolve:   [50, 45]
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const roots   = bassRoots[section];

      let dur = section === 'resolve' ? 2 : (Math.random() < 0.6 ? 1 : 2);

      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);
      if (actualDur <= 0) break;

      const targetRoot = roots[Math.floor(Math.random() * roots.length)];
      let midi;
      const roll = Math.random();
      if (roll < 0.5) {
        midi = targetRoot;
      } else if (roll < 0.75) {
        midi = targetRoot + 7;
      } else {
        midi = targetRoot + (Math.random() < 0.5 ? -1 : 1);
      }
      midi = Math.max(36, Math.min(64, midi));

      notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });

      if (dur === 1 && Math.random() < 0.25 && midi + 12 <= 64) {
        const ghostBeat = currentBeat + 0.5;
        if (ghostBeat < TOTAL_BEATS) {
          notes.push({ id: nextId++, midi: midi + 12, startBeat: ghostBeat, durBeats: 0.5, accidental: 0, staffIndex: 2 });
        }
      }

      currentBeat += dur;
    }
  }

  /* === ADVENTURE / HEROIC GENERATION === */

  function generateAdventureMelody() {
    const ADVENTURE_SCALE = transposeArr([64, 66, 67, 69, 71, 72, 74, 76, 78, 79, 81], getKeyOffset());

    const rhythmsBySection = {
      establish: [[1, 1, 1, 1], [1.5, 0.5, 1, 1], [2, 1, 1]],
      vary:      [[0.5, 0.5, 1, 0.5, 0.5, 1], [1, 0.5, 0.5, 1, 1], [1.5, 0.5, 0.5, 0.5, 1]],
      contrast:  [[0.5, 0.5, 0.5, 0.5, 1, 1], [1, 0.5, 0.5, 0.5, 0.5, 1], [0.5, 0.5, 1, 1, 1]],
      resolve:   [[2, 1, 1], [4], [1.5, 0.5, 2]]
    };

    let currentBeat = 0;
    let lastIndex   = 4;

    while (currentBeat < TOTAL_BEATS) {
      const section  = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern  = patterns[Math.floor(Math.random() * patterns.length)];

      for (const dur of pattern) {
        if (currentBeat >= TOTAL_BEATS) break;

        let restChance = 0.1;
        if (section === 'resolve') restChance = 0.2;

        if (Math.random() < restChance) {
          currentBeat += dur;
          continue;
        }

        const leapChance = section === 'contrast' ? 0.45 : 0.25;
        const dir  = Math.random() < 0.55 ? 1 : -1;
        let jump;
        if (Math.random() < leapChance) {
          jump = Math.random() < 0.5 ? 3 : 4;
        } else {
          jump = 1;
        }
        lastIndex = Math.max(0, Math.min(ADVENTURE_SCALE.length - 1, lastIndex + dir * jump));

        if (section === 'contrast') {
          lastIndex = Math.min(ADVENTURE_SCALE.length - 1, lastIndex + (Math.random() < 0.35 ? 1 : 0));
        }
        if (section === 'resolve' && Math.random() < 0.5) {
          lastIndex = Math.max(0, lastIndex - 1);
        }

        const midi      = ADVENTURE_SCALE[lastIndex];
        const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

        if (actualDur > 0) {
          notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 0 });
        }
        currentBeat += dur;
      }
    }
  }

  function generateAdventureRightHand() {
    const chordsBySection = transposeChords({
      establish: [[64, 67, 71], [67, 71, 74]],
      vary:      [[69, 72, 76], [67, 71, 74]],
      contrast:  [[71, 74, 78], [60, 64, 67]],
      resolve:   [[64, 67, 71], [67, 71, 74]]
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords  = chordsBySection[section];

      const skipChance = section === 'establish' ? 0.15 : 0.05;
      if (Math.random() < skipChance) {
        currentBeat += 2;
        continue;
      }

      const chord  = chords[Math.floor(Math.random() * chords.length)];
      const dur    = section === 'resolve' ? 4 : (Math.random() < 0.6 ? 2 : 1);
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      const offset    = (section !== 'resolve' && Math.random() < 0.25) ? 0.5 : 0;
      const chordBeat = currentBeat + offset;

      for (const midi of chord) {
        if (chordBeat < TOTAL_BEATS) {
          notes.push({ id: nextId++, midi, startBeat: chordBeat, durBeats: Math.min(actualDur, TOTAL_BEATS - chordBeat), accidental: 0, staffIndex: 1 });
        }
      }

      currentBeat += dur;
    }
  }

  function generateAdventureBass() {
    const bassRoots = transposeRoots({
      establish: [40, 43],
      vary:      [45, 43],
      contrast:  [47, 48],
      resolve:   [47, 40]
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const roots   = bassRoots[section];

      const dur       = Math.random() < 0.75 ? 1 : 2;
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);
      if (actualDur <= 0) break;

      const root = roots[Math.floor(Math.random() * roots.length)];
      notes.push({ id: nextId++, midi: root, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });

      if (currentBeat % 2 === 0 && Math.random() < 0.5) {
        const fifth = root + 7;
        if (fifth <= 64) {
          notes.push({ id: nextId++, midi: fifth, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });
        }
      }

      currentBeat += dur;
    }
  }

  /* === BOSS BATTLE GENERATION === */

  function generateBossMelody() {
    const BOSS_SCALE = transposeArr([62, 63, 65, 67, 68, 70, 72, 74, 75, 77, 79, 80], getKeyOffset());

    const rhythmsBySection = {
      establish: [[1, 1, 1, 1], [1.5, 0.5, 1, 1], [2, 0.5, 0.5, 1]],
      vary:      [[0.5, 0.5, 1, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [1, 0.5, 0.5, 1, 1]],
      contrast:  [[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 1, 0.5, 1], [1, 0.5, 0.5, 0.5, 0.5, 1]],
      resolve:   [[2, 1, 1], [1.5, 0.5, 1, 1], [2, 0.5, 0.5, 1]]
    };

    let currentBeat = 0;
    let lastIndex   = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section  = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern  = patterns[Math.floor(Math.random() * patterns.length)];

      for (const dur of pattern) {
        if (currentBeat >= TOTAL_BEATS) break;

        let restChance = 0.08;
        if (section === 'establish') restChance = 0.12;

        if (Math.random() < restChance) {
          currentBeat += dur;
          continue;
        }

        const roll = Math.random();
        if (roll < 0.2) {
          lastIndex = 4;
        } else if (roll < 0.35) {
          const dir = Math.random() < 0.5 ? 1 : -1;
          lastIndex = Math.max(0, Math.min(BOSS_SCALE.length - 1, lastIndex + dir));
        } else if (roll < 0.6) {
          const dir = Math.random() < 0.45 ? 1 : -1;
          lastIndex = Math.max(0, Math.min(BOSS_SCALE.length - 1, lastIndex + dir));
        } else {
          const dir  = Math.random() < 0.5 ? 1 : -1;
          const jump = Math.floor(Math.random() * 3) + 2;
          lastIndex  = Math.max(0, Math.min(BOSS_SCALE.length - 1, lastIndex + dir * jump));
        }

        if (section === 'contrast' && Math.random() < 0.4) {
          lastIndex = Math.min(BOSS_SCALE.length - 1, lastIndex + 1);
        }

        const midi      = BOSS_SCALE[lastIndex];
        const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

        if (actualDur > 0) {
          notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 0 });
        }
        currentBeat += dur;
      }
    }
  }

  function generateBossRightHand() {
    const chordsBySection = transposeChords({
      establish: [[62, 65, 68], [62, 68]],
      vary:      [[62, 65, 68, 71], [63, 67, 70]],
      contrast:  [[65, 68, 72], [62, 65, 68, 71]],
      resolve:   [[63, 68], [62, 65, 68]]
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords  = chordsBySection[section];

      if (Math.random() < 0.08) {
        currentBeat += 1;
        continue;
      }

      const chord = chords[Math.floor(Math.random() * chords.length)];
      const dur   = section === 'contrast'
        ? (Math.random() < 0.6 ? 1 : 0.5)
        : (Math.random() < 0.5 ? 2 : 1);
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      for (const midi of chord) {
        notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 1 });
      }

      currentBeat += dur;
    }
  }

  function generateBossBass() {
    const bassNotes = transposeRoots({
      establish: [38, 39],
      vary:      [38, 44],
      contrast:  [44, 46],
      resolve:   [39, 38]
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const pool    = bassNotes[section];

      let dur;
      if (section === 'contrast') {
        dur = Math.random() < 0.6 ? 1 : 2;
      } else {
        dur = Math.random() < 0.4 ? 2 : (Math.random() < 0.5 ? 1 : 4);
      }

      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);
      if (actualDur <= 0) break;

      const root = pool[Math.floor(Math.random() * pool.length)];
      notes.push({ id: nextId++, midi: root, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });

      if (currentBeat % 4 === 0 && Math.random() < 0.45) {
        const tritone = root + 6;
        if (tritone <= 64) {
          notes.push({ id: nextId++, midi: tritone, startBeat: currentBeat, durBeats: Math.min(actualDur, 1), accidental: 0, staffIndex: 2 });
        }
      }

      currentBeat += dur;
    }
  }

  /* === MYSTIC GENERATION === */

  function generateMystic() {
    const melodyScale = transposeArr([62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81], getKeyOffset());
    let currentBeat = 0;
    let lastIndex   = 3;

    while (currentBeat < TOTAL_BEATS) {
      const section    = getPhraseSection(currentBeat);
      const durOptions = section === 'resolve' ? [4, 6] : [2, 3, 4];
      const dur        = durOptions[Math.floor(Math.random() * durOptions.length)];

      if (Math.random() < 0.35) {
        currentBeat += dur;
        continue;
      }

      const dir  = Math.random() < 0.5 ? -1 : 1;
      const jump = Math.random() < 0.25 ? 2 : 1;
      lastIndex  = Math.max(0, Math.min(melodyScale.length - 1, lastIndex + dir * jump));

      const midi      = melodyScale[lastIndex];
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

      notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 0 });

      if (Math.random() < 0.6) {
        const fifth = midi + 7;
        if (fifth <= STAVES[1].maxMidi) {
          notes.push({ id: nextId++, midi: fifth, startBeat: currentBeat, durBeats: Math.max(1, actualDur - 0.5), accidental: 0, staffIndex: 1 });
        }
      }

      const bassRoot = Math.max(STAVES[2].minMidi, midi - 24);
      notes.push({ id: nextId++, midi: bassRoot, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });

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
    const VICTORY_SCALE = transposeArr([60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81], getKeyOffset());

    const rhythmsBySection = {
      establish: [[1.5, 0.5, 1, 1], [1, 1, 1, 1], [0.5, 0.5, 1, 0.5, 0.5, 1]],
      vary:      [[0.5, 0.5, 1, 0.5, 0.5, 1], [1.5, 0.5, 0.5, 0.5, 1], [1, 0.5, 0.5, 1, 1]],
      contrast:  [[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1], [0.5, 0.5, 1, 1, 1], [1, 0.5, 0.5, 0.5, 0.5, 1]],
      resolve:   [[2, 1, 1], [4], [1.5, 0.5, 2]]
    };

    let currentBeat = 0;
    let lastIndex   = 4;

    while (currentBeat < TOTAL_BEATS) {
      const section  = getPhraseSection(currentBeat);
      const patterns = rhythmsBySection[section];
      const pattern  = patterns[Math.floor(Math.random() * patterns.length)];

      for (const dur of pattern) {
        if (currentBeat >= TOTAL_BEATS) break;

        let restChance = 0.08;
        if (section === 'resolve') restChance = 0.15;

        if (Math.random() < restChance) {
          currentBeat += dur;
          continue;
        }

        const dir       = Math.random() < 0.65 ? 1 : -1;
        const leapChance = section === 'contrast' ? 0.4 : 0.2;
        const jump      = Math.random() < leapChance ? (Math.random() < 0.5 ? 3 : 4) : 1;
        lastIndex       = Math.max(0, Math.min(VICTORY_SCALE.length - 1, lastIndex + dir * jump));

        if (section === 'contrast' && Math.random() < 0.3) {
          lastIndex = Math.min(VICTORY_SCALE.length - 1, lastIndex + 1);
        }
        if (section === 'resolve' && Math.random() < 0.6) {
          const target = lastIndex >= 7 ? 7 : 0;
          lastIndex += lastIndex > target ? -1 : (lastIndex < target ? 1 : 0);
        }

        const midi      = VICTORY_SCALE[lastIndex];
        const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);

        if (actualDur > 0) {
          notes.push({ id: nextId++, midi, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 0 });
        }
        currentBeat += dur;
      }
    }
  }

  function generateVictoryRightHand() {
    const chordsBySection = transposeChords({
      establish: [[60, 64, 67], [67, 71, 74]],
      vary:      [[65, 69, 72], [67, 71, 74]],
      contrast:  [[69, 72, 76], [62, 65, 69]],
      resolve:   [[67, 71, 74], [60, 64, 67]]
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const chords  = chordsBySection[section];

      const skipChance = section === 'establish' ? 0.1 : 0.05;
      if (Math.random() < skipChance) {
        currentBeat += 2;
        continue;
      }

      const chord     = chords[Math.floor(Math.random() * chords.length)];
      const dur       = section === 'resolve' ? 4 : (Math.random() < 0.6 ? 2 : 1);
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);
      const arpeggiate = Math.random() < 0.25;

      for (let i = 0; i < chord.length; i++) {
        const offset  = arpeggiate ? i * 0.25 : 0;
        const noteBeat = currentBeat + offset;
        const noteDur  = Math.max(0.5, actualDur - offset);

        if (noteBeat < TOTAL_BEATS && noteDur > 0) {
          notes.push({ id: nextId++, midi: chord[i], startBeat: noteBeat, durBeats: noteDur, accidental: 0, staffIndex: 1 });
        }
      }

      currentBeat += dur;
    }
  }

  function generateVictoryBass() {
    const bassRoots = transposeRoots({
      establish: [36, 43],
      vary:      [41, 43],
      contrast:  [45, 50],
      resolve:   [43, 36]
    }, getKeyOffset());

    let currentBeat = 0;

    while (currentBeat < TOTAL_BEATS) {
      const section = getPhraseSection(currentBeat);
      const roots   = bassRoots[section];

      const dur       = Math.random() < 0.7 ? 1 : 2;
      const actualDur = Math.min(dur, TOTAL_BEATS - currentBeat);
      if (actualDur <= 0) break;

      const root = roots[Math.floor(Math.random() * roots.length)];
      notes.push({ id: nextId++, midi: root, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });

      if (currentBeat % 2 === 0 && Math.random() < 0.45) {
        const octave = root + 12;
        if (octave <= 64) {
          notes.push({ id: nextId++, midi: octave, startBeat: currentBeat, durBeats: actualDur, accidental: 0, staffIndex: 2 });
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
    document.getElementById('generateBtn').addEventListener('click', () => generateRandomMelody());

    const loopBtn = document.getElementById('loop');
    if (loopBtn) loopBtn.addEventListener('click', toggleLoop);

    const volumeSlider = document.getElementById('volume');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        masterVolume = e.target.value / 100;
        if (masterGain) masterGain.gain.value = masterVolume;
      });
    }
  }

  /* === INITIALIZATION === */

  function initialize() {
    buildModeCards();
    setupEventListeners();
    initWaveform();
    generateRandomMelody(); // Auto-generate on load
  }

  initialize();

})();
