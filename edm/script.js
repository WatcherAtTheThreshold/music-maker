// Enhanced floating particles
const container = document.getElementById('particles');
const colors = ['golden', 'purple', 'silver'];

for (let i = 0; i < 80; i++) {
  const particle = document.createElement('div');
  const colorType = colors[Math.floor(Math.random() * colors.length)];
  particle.className = `particle ${colorType}`;
  
  let size = Math.random() * 6 + 2;
  particle.style.width = `${size}px`;
  particle.style.height = `${size}px`;
  particle.style.left = Math.random() * 100 + '%';
  particle.style.animationDelay = Math.random() * 40 + 's';
  
  const driftRange = Math.random() * 400 - 200;
  particle.style.setProperty('--drift', driftRange + 'px');
  
  container.appendChild(particle);
}

// Musical scales and keys
const scales = {
  'C': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  'Am': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  'G': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
  'Em': ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
  'D': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
  'Bm': ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'],
  'F': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
  'Dm': ['D', 'E', 'F', 'G', 'A', 'Bb', 'C']
};

// Audio setup
let isInitialized = false;
let isPlaying = false;
let currentStep = 0;
let currentPattern = 0;
let patternLength = 32;
let currentKey = 'C';
let swingAmount = 0;
let sidechainAmount = 50;
let isEditingVelocity = false;

// Arpeggiator settings
let arpPattern = 'off';
let arpSpeed = 2; // 1=1/4, 2=1/8, 3=1/16, 4=1/32
let arpStep = 0;
let arpDirection = 1; // for up-down pattern

// Track mute/solo state
let trackStates = {};
let hasSoloedTracks = false;

// Track definitions
const drumTracks = ['kick', 'snare', 'hihat', 'openhat', 'clap', 'crash'];
const melodyTracks = ['lead', 'pad', 'bass'];
const allTracks = [...drumTracks, ...melodyTracks];

// Initialize track states
allTracks.forEach(track => {
  trackStates[track] = { muted: false, soloed: false };
});

// Patterns storage with velocity
const patterns = [
  {
    // Drum patterns (0 = off, 1-127 = velocity)
    kick: Array(32).fill(0),
    snare: Array(32).fill(0),
    hihat: Array(32).fill(0),
    openhat: Array(32).fill(0),
    clap: Array(32).fill(0),
    crash: Array(32).fill(0),
    // Melody patterns (note + velocity)
    lead: Array(32).fill().map(() => ({ note: null, velocity: 70 })),
    pad: Array(32).fill().map(() => ({ note: null, velocity: 70 })),
    bass: Array(32).fill().map(() => ({ note: null, velocity: 70 }))
  },
  {
    kick: Array(32).fill(0),
    snare: Array(32).fill(0),
    hihat: Array(32).fill(0),
    openhat: Array(32).fill(0),
    clap: Array(32).fill(0),
    crash: Array(32).fill(0),
    lead: Array(32).fill().map(() => ({ note: null, velocity: 70 })),
    pad: Array(32).fill().map(() => ({ note: null, velocity: 70 })),
    bass: Array(32).fill().map(() => ({ note: null, velocity: 70 }))
  }
];

/* === MIDI EXPORT (Multi-Track Format 1 - Both Patterns) === */

// MIDI drum mapping (General MIDI standard)
const DRUM_MIDI_MAP = {
  kick: 36,    // Bass Drum 1
  snare: 38,   // Acoustic Snare
  hihat: 42,   // Closed Hi-Hat
  openhat: 46, // Open Hi-Hat
  clap: 39,    // Hand Clap
  crash: 49    // Crash Cymbal 1
};

// Track configuration for multi-track export
const TRACK_CONFIG = {
  drums: { channel: 9, name: 'Drums' },
  lead: { channel: 0, name: 'Lead Synth', octave: 4 },
  pad: { channel: 1, name: 'Pad/Chords', octave: 3 },
  bass: { channel: 2, name: 'Bass', octave: 2 }
};

const TPQ = 480; // Ticks per quarter note

// Note to MIDI conversion
function noteToMidi(note, octave) {
  const noteMap = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
  return (octave + 1) * 12 + (noteMap[note] || 0);
}

// Variable Length Quantity encoder
function encodeVLQ(value) {
  const bytes = [];
  let val = Math.max(0, Math.floor(value) >>> 0);
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

function u32ToBytes(n) { return [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]; }
function u16ToBytes(n) { return [(n>>>8)&255,n&255]; }

// Main MIDI export - exports both Pattern A and B with separate tracks
function exportToMIDI() {
  const bpm = Tone.Transport.bpm.value || 120;
  const stepsPerPattern = patternLength;
  const stepTicks = TPQ / 4; // 16th notes
  const patternTicks = stepsPerPattern * stepTicks;

  // Build separate tracks for each instrument
  const tempoTrack = buildTempoTrack(bpm);
  const drumTrack = buildDrumTrack(patternTicks, stepTicks);
  const leadTrack = buildMelodyTrack('lead', patternTicks, stepTicks);
  const padTrack = buildMelodyTrack('pad', patternTicks, stepTicks);
  const bassTrack = buildMelodyTrack('bass', patternTicks, stepTicks);

  // Combine into Format 1 MIDI file
  const tracks = [tempoTrack, drumTrack, leadTrack, padTrack, bassTrack];
  const midiData = wrapInSMFFormat1(tracks);

  // Download
  const blob = new Blob([midiData], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'edm-pattern-AB.mid';
  a.click();
  URL.revokeObjectURL(url);
}

// Build tempo track (track 0 in Format 1)
function buildTempoTrack(bpm) {
  const bytes = [];
  const microPerQuarter = Math.round(60000000 / bpm);

  // Tempo meta event
  bytes.push(...encodeVLQ(0), 0xFF, 0x51, 0x03,
    (microPerQuarter >> 16) & 255,
    (microPerQuarter >> 8) & 255,
    microPerQuarter & 255);

  // Time signature 4/4
  bytes.push(...encodeVLQ(0), 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

  // Track name
  const name = 'Pro EDM Maker';
  bytes.push(...encodeVLQ(0), 0xFF, 0x03, name.length, ...name.split('').map(c => c.charCodeAt(0)));

  // End of track
  bytes.push(...encodeVLQ(0), 0xFF, 0x2F, 0x00);

  return new Uint8Array(bytes);
}

// Build drum track from both patterns (A then B)
function buildDrumTrack(patternTicks, stepTicks) {
  const bytes = [];
  const channel = TRACK_CONFIG.drums.channel;

  // Track name
  const name = TRACK_CONFIG.drums.name;
  bytes.push(...encodeVLQ(0), 0xFF, 0x03, name.length, ...name.split('').map(c => c.charCodeAt(0)));

  // Collect events from both patterns
  const events = [];

  [0, 1].forEach((patternIndex) => {
    const pattern = patterns[patternIndex];
    const offsetTicks = patternIndex * patternTicks;

    drumTracks.forEach(track => {
      const midiNote = DRUM_MIDI_MAP[track];
      pattern[track].slice(0, patternLength).forEach((velocity, step) => {
        if (velocity > 0) {
          const tick = offsetTicks + step * stepTicks;
          events.push({ tick, type: 'noteOn', note: midiNote, velocity: Math.min(127, Math.round(velocity)) });
          events.push({ tick: tick + Math.floor(stepTicks * 0.8), type: 'noteOff', note: midiNote });
        }
      });
    });
  });

  // Sort and write events
  events.sort((a, b) => a.tick - b.tick || (a.type === 'noteOff' ? 1 : -1));

  let currentTick = 0;
  for (const event of events) {
    const delta = Math.max(0, event.tick - currentTick);
    currentTick = event.tick;

    if (event.type === 'noteOn') {
      bytes.push(...encodeVLQ(delta), 0x90 | channel, event.note, event.velocity);
    } else {
      bytes.push(...encodeVLQ(delta), 0x80 | channel, event.note, 0x40);
    }
  }

  // End of track
  bytes.push(...encodeVLQ(0), 0xFF, 0x2F, 0x00);

  return new Uint8Array(bytes);
}

// Build melodic track from both patterns (A then B)
function buildMelodyTrack(trackName, patternTicks, stepTicks) {
  const bytes = [];
  const config = TRACK_CONFIG[trackName];
  const channel = config.channel;
  const octave = config.octave;

  // Track name
  const name = config.name;
  bytes.push(...encodeVLQ(0), 0xFF, 0x03, name.length, ...name.split('').map(c => c.charCodeAt(0)));

  // Collect events from both patterns
  const events = [];

  [0, 1].forEach((patternIndex) => {
    const pattern = patterns[patternIndex];
    const offsetTicks = patternIndex * patternTicks;

    pattern[trackName].slice(0, patternLength).forEach((stepData, step) => {
      if (stepData && stepData.note) {
        const midiNote = noteToMidi(stepData.note, octave);
        const tick = offsetTicks + step * stepTicks;
        const duration = Math.floor(stepTicks * 1.5);
        const velocity = Math.min(127, Math.round(stepData.velocity));

        events.push({ tick, type: 'noteOn', note: midiNote, velocity });
        events.push({ tick: tick + duration, type: 'noteOff', note: midiNote });
      }
    });
  });

  // Sort and write events
  events.sort((a, b) => a.tick - b.tick || (a.type === 'noteOff' ? 1 : -1));

  let currentTick = 0;
  for (const event of events) {
    const delta = Math.max(0, event.tick - currentTick);
    currentTick = event.tick;

    if (event.type === 'noteOn') {
      bytes.push(...encodeVLQ(delta), 0x90 | channel, event.note, event.velocity);
    } else {
      bytes.push(...encodeVLQ(delta), 0x80 | channel, event.note, 0x40);
    }
  }

  // End of track
  bytes.push(...encodeVLQ(0), 0xFF, 0x2F, 0x00);

  return new Uint8Array(bytes);
}

// Wrap tracks in Standard MIDI File Format 1
function wrapInSMFFormat1(tracks) {
  const numTracks = tracks.length;

  // Header chunk
  const header = [
    0x4D, 0x54, 0x68, 0x64, // "MThd"
    ...u32ToBytes(6),        // Header length
    ...u16ToBytes(1),        // Format 1 (multi-track)
    ...u16ToBytes(numTracks),// Number of tracks
    ...u16ToBytes(TPQ)       // Ticks per quarter note
  ];

  // Calculate total size
  let totalSize = header.length;
  tracks.forEach(track => {
    totalSize += 8 + track.length; // Track header (8 bytes) + track data
  });

  // Build final file
  const result = new Uint8Array(totalSize);
  let offset = 0;

  // Write header
  result.set(header, offset);
  offset += header.length;

  // Write each track
  tracks.forEach(track => {
    // Track header
    result.set([0x4D, 0x54, 0x72, 0x6B], offset); // "MTrk"
    result.set(u32ToBytes(track.length), offset + 4);
    offset += 8;

    // Track data
    result.set(track, offset);
    offset += track.length;
  });

  return result;
}

// Audio components
let synths = {};
let effects = {};
let sidechainCompressor = {};
let loop;
let arpLoop;

async function initializeAudio() {
  if (isInitialized) return;
  
  await Tone.start();
  
  // Create drum synths
  synths.kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 10,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4, attackCurve: 'exponential' }
  });
  
  synths.snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
  });
  
  synths.hihat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.005, decay: 0.05, sustain: 0 }
  });

  synths.openhat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0 }
  });

  synths.clap = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0 }
  });

  synths.crash = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.01, decay: 1.5, sustain: 0 }
  });
  
  // Create melodic synths
  synths.lead = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5 },
    filter: { Q: 10, frequency: 2000, type: 'lowpass' }
  });

  synths.pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.3, decay: 0.3, sustain: 0.7, release: 2.0 }
  });

  synths.bass = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 }
  });

  // Create effects
  effects.reverb = new Tone.Reverb(1.5);
  effects.delay = new Tone.FeedbackDelay(0.25, 0.3);
  effects.filter = new Tone.Filter(4000, 'lowpass');
  effects.distortion = new Tone.Distortion(0);

  // Create sidechain compressors for melodic tracks
  melodyTracks.forEach(track => {
    sidechainCompressor[track] = new Tone.Compressor(-30, 12);
  });

  // Chain effects for drums (no sidechain)
  const drumEffectsChain = Tone.Destination;
  drumTracks.forEach(track => {
    synths[track].chain(effects.filter, effects.distortion, effects.delay, effects.reverb, drumEffectsChain);
  });

  // Chain effects for melody (with sidechain)
  melodyTracks.forEach(track => {
    synths[track].chain(sidechainCompressor[track], effects.filter, effects.distortion, effects.delay, effects.reverb, Tone.Destination);
  });

  // Create the main loop
  loop = new Tone.Loop(time => {
    const pattern = patterns[currentPattern];
    const stepTime = time;
    
    // Apply swing to off-beat steps
    let swingOffset = 0;
    if (currentStep % 2 === 1 && swingAmount > 0) {
      swingOffset = (swingAmount / 100) * 0.05; // Max 50ms swing
    }
    
    const actualTime = stepTime + swingOffset;
    
    // Check if kick hits for sidechain
    const kickHits = pattern.kick[currentStep] > 0;
    
    // Trigger drum sounds
    drumTracks.forEach(track => {
      const velocity = pattern[track][currentStep];
      if (velocity > 0 && shouldPlayTrack(track)) {
        const normalizedVelocity = velocity / 127;
        
        if (track === 'kick') {
          synths[track].triggerAttackRelease('C1', '8n', actualTime, normalizedVelocity);
          
          // Trigger sidechain compression
          if (sidechainAmount > 0) {
            triggerSidechain(actualTime);
          }
        } else {
          synths[track].triggerAttackRelease('8n', actualTime, normalizedVelocity);
        }
      }
    });

    // Trigger melodic sounds (non-arpeggiator)
    melodyTracks.forEach(track => {
      if (track === 'lead' && arpPattern !== 'off') return; // Skip lead if arpeggiator is on
      
      const stepData = pattern[track][currentStep];
      if (stepData && stepData.note && shouldPlayTrack(track)) {
        const normalizedVelocity = stepData.velocity / 127;
        const octave = track === 'bass' ? 2 : track === 'lead' ? 4 : 3;
        const noteWithOctave = stepData.note + octave;
        
        if (track === 'pad') {
          // Play chord for pad
          const chord = getChordNotes(stepData.note, octave);
          synths[track].triggerAttackRelease(chord, '4n', actualTime, normalizedVelocity);
        } else {
          synths[track].triggerAttackRelease(noteWithOctave, '8n', actualTime, normalizedVelocity);
        }
      }
    });

    // Update visual step indicator
    updateStepIndicator();
    
    // Move to next step
    currentStep = (currentStep + 1) % patternLength;
  }, '16n');

  // Create arpeggiator loop
  arpLoop = new Tone.Loop(time => {
    if (arpPattern === 'off' || !shouldPlayTrack('lead')) return;
    
    // Get active notes from lead track
    const pattern = patterns[currentPattern];
    const activeNotes = [];
    
    for (let i = 0; i < patternLength; i++) {
      const stepData = pattern.lead[i];
      if (stepData && stepData.note) {
        activeNotes.push({ note: stepData.note, velocity: stepData.velocity });
      }
    }
    
    if (activeNotes.length === 0) return;
    
    // Get next note based on arp pattern
    const nextNote = getNextArpNote(activeNotes);
    if (nextNote) {
      const normalizedVelocity = nextNote.velocity / 127;
      const noteWithOctave = nextNote.note + '4';
      synths.lead.triggerAttackRelease(noteWithOctave, getArpNoteDuration(), time, normalizedVelocity);
    }
  }, getArpNoteDuration());

  isInitialized = true;
}

// Sidechain compression trigger
function triggerSidechain(time) {
  melodyTracks.forEach(track => {
    const compressor = sidechainCompressor[track];
    const intensity = sidechainAmount / 100;
    
    // Create envelope to duck the volume
    compressor.threshold.setValueAtTime(-10 - (intensity * 20), time);
    compressor.threshold.exponentialRampToValueAtTime(-5, time + 0.1);
    compressor.threshold.exponentialRampToValueAtTime(-30, time + 0.3);
  });
}

// Arpeggiator functions
function getArpNoteDuration() {
  const durations = ['4n', '8n', '16n', '32n'];
  return durations[arpSpeed - 1];
}

function getNextArpNote(activeNotes) {
  if (activeNotes.length === 0) return null;
  
  switch (arpPattern) {
    case 'up':
      const upNote = activeNotes[arpStep % activeNotes.length];
      arpStep++;
      return upNote;
      
    case 'down':
      const downNote = activeNotes[(activeNotes.length - 1 - (arpStep % activeNotes.length))];
      arpStep++;
      return downNote;
      
    case 'updown':
      let index;
      const totalSteps = (activeNotes.length - 1) * 2;
      const normalizedStep = arpStep % totalSteps;
      
      if (normalizedStep < activeNotes.length) {
        index = normalizedStep;
      } else {
        index = (activeNotes.length - 1) - (normalizedStep - (activeNotes.length - 1));
      }
      
      arpStep++;
      return activeNotes[index];
      
    case 'random':
      return activeNotes[Math.floor(Math.random() * activeNotes.length)];
      
    default:
      return null;
  }
}

// Track mute/solo functions
function shouldPlayTrack(track) {
  const state = trackStates[track];
  
  // If track is muted, don't play
  if (state.muted) return false;
  
  // If there are soloed tracks and this isn't one of them, don't play
  if (hasSoloedTracks && !state.soloed) return false;
  
  return true;
}

function toggleMute(track) {
  trackStates[track].muted = !trackStates[track].muted;
  updateTrackUI(track);
}

function toggleSolo(track) {
  trackStates[track].soloed = !trackStates[track].soloed;
  
  // Update solo state
  hasSoloedTracks = allTracks.some(t => trackStates[t].soloed);
  
  // Update all track UIs
  allTracks.forEach(updateTrackUI);
}

function updateTrackUI(track) {
  const muteBtn = document.querySelector(`[data-track="${track}"].mute-btn`);
  const soloBtn = document.querySelector(`[data-track="${track}"].solo-btn`);
  const volumeControl = muteBtn?.closest('.volume-control');
  
  if (muteBtn) {
    muteBtn.classList.toggle('active', trackStates[track].muted);
  }
  
  if (soloBtn) {
    soloBtn.classList.toggle('active', trackStates[track].soloed);
  }
  
  if (volumeControl) {
    volumeControl.classList.toggle('muted', trackStates[track].muted);
    volumeControl.classList.toggle('soloed', trackStates[track].soloed);
  }
}

// Get chord notes for pad track
function getChordNotes(rootNote, octave) {
  const scale = scales[currentKey];
  const rootIndex = scale.indexOf(rootNote);
  if (rootIndex === -1) return [rootNote + octave];
  
  const third = scale[(rootIndex + 2) % scale.length];
  const fifth = scale[(rootIndex + 4) % scale.length];
  
  return [
    rootNote + octave,
    third + octave,
    fifth + (octave + 1)
  ];
}

// Create drum sequencer
function createDrumSequencer() {
  const sequencer = document.getElementById('drumSequencer');
  sequencer.innerHTML = '';
  
  drumTracks.forEach(track => {
    const row = document.createElement('div');
    row.className = 'sequencer-row';
    
    const label = document.createElement('div');
    label.className = 'track-label';
    label.textContent = track.charAt(0).toUpperCase() + track.slice(1);
    row.appendChild(label);
    
    const steps = document.createElement('div');
    steps.className = 'steps';
    
    for (let i = 0; i < patternLength; i++) {
      const step = document.createElement('div');
      step.className = 'step';
      if (i % 4 === 0) step.classList.add(`beat-${i + 1}`);
      step.dataset.track = track;
      step.dataset.step = i;
      
      // Add velocity bar
      const velocityBar = document.createElement('div');
      velocityBar.className = 'velocity-bar';
      const velocityFill = document.createElement('div');
      velocityFill.className = 'velocity-fill';
      velocityBar.appendChild(velocityFill);
      step.appendChild(velocityBar);
      
      step.addEventListener('click', (e) => {
        if (e.shiftKey || isEditingVelocity) {
          // Edit velocity
          editStepVelocity(track, i, e);
        } else {
          // Toggle step
          toggleDrumStep(track, i);
        }
      });

      step.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        resetStepVelocity(track, i);
      });
      
      steps.appendChild(step);
    }
    
    row.appendChild(steps);
    sequencer.appendChild(row);
  });
}

// Create melody sequencer
function createMelodySequencer() {
  const sequencer = document.getElementById('melodySequencer');
  sequencer.innerHTML = '';
  
  melodyTracks.forEach(track => {
    const row = document.createElement('div');
    row.className = 'sequencer-row';
    
    const label = document.createElement('div');
    label.className = 'track-label';
    label.textContent = track.charAt(0).toUpperCase() + track.slice(1);
    row.appendChild(label);
    
    const steps = document.createElement('div');
    steps.className = 'steps';
    
    for (let i = 0; i < patternLength; i++) {
      const step = document.createElement('div');
      step.className = 'step melodic';
      if (i % 4 === 0) step.classList.add(`beat-${i + 1}`);
      step.dataset.track = track;
      step.dataset.step = i;
      
      const noteDisplay = document.createElement('div');
      noteDisplay.className = 'note-display';
      step.appendChild(noteDisplay);

      // Add velocity bar
      const velocityBar = document.createElement('div');
      velocityBar.className = 'velocity-bar';
      const velocityFill = document.createElement('div');
      velocityFill.className = 'velocity-fill';
      velocityBar.appendChild(velocityFill);
      step.appendChild(velocityBar);
      
      step.addEventListener('click', (e) => {
        if (e.shiftKey || isEditingVelocity) {
          editStepVelocity(track, i, e);
        } else {
          selectMelodyNote(track, i);
        }
      });

      step.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        clearMelodyStep(track, i);
      });
      
      steps.appendChild(step);
    }
    
    row.appendChild(steps);
    sequencer.appendChild(row);
  });
}

// Toggle drum step
function toggleDrumStep(track, stepIndex) {
  const pattern = patterns[currentPattern];
  const currentVelocity = pattern[track][stepIndex];
  pattern[track][stepIndex] = currentVelocity > 0 ? 0 : 70;
  updateSequencerDisplay();
}

// Select melody note
function selectMelodyNote(track, stepIndex) {
  const scale = scales[currentKey];
  const pattern = patterns[currentPattern];
  const currentStep = pattern[track][stepIndex];
  
  if (!currentStep.note) {
    // Set to root note if empty
    pattern[track][stepIndex] = { note: scale[0], velocity: 70 };
  } else {
    // Cycle through scale notes
    const currentIndex = scale.indexOf(currentStep.note);
    const nextIndex = (currentIndex + 1) % scale.length;
    pattern[track][stepIndex] = { note: scale[nextIndex], velocity: currentStep.velocity };
  }
  
  updateSequencerDisplay();
}

// Clear melody step
function clearMelodyStep(track, stepIndex) {
  const pattern = patterns[currentPattern];
  pattern[track][stepIndex] = { note: null, velocity: 70 };
  updateSequencerDisplay();
}

// Edit step velocity
function editStepVelocity(track, stepIndex, event) {
  const rect = event.target.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const height = rect.height;
  const velocity = Math.max(1, Math.min(127, Math.round((1 - y / height) * 127)));
  
  const pattern = patterns[currentPattern];
  
  if (drumTracks.includes(track)) {
    pattern[track][stepIndex] = pattern[track][stepIndex] > 0 ? velocity : 0;
  } else {
    if (pattern[track][stepIndex].note) {
      pattern[track][stepIndex].velocity = velocity;
    }
  }
  
  updateSequencerDisplay();
}

// Reset step velocity
function resetStepVelocity(track, stepIndex) {
  const pattern = patterns[currentPattern];
  
  if (drumTracks.includes(track)) {
    if (pattern[track][stepIndex] > 0) {
      pattern[track][stepIndex] = 70;
    }
  } else {
    pattern[track][stepIndex].velocity = 70;
  }
  
  updateSequencerDisplay();
}

// Update sequencer display
function updateSequencerDisplay() {
  const pattern = patterns[currentPattern];
  
  // Update drum tracks
  drumTracks.forEach(track => {
    pattern[track].slice(0, patternLength).forEach((velocity, i) => {
      const step = document.querySelector(`[data-track="${track}"][data-step="${i}"]`);
      if (step) {
        step.classList.toggle('active', velocity > 0);
        const velocityFill = step.querySelector('.velocity-fill');
        if (velocityFill) {
          velocityFill.style.setProperty('--velocity', `${(velocity / 127) * 100}%`);
        }
      }
    });
  });
  
  // Update melody tracks
  melodyTracks.forEach(track => {
    pattern[track].slice(0, patternLength).forEach((stepData, i) => {
      const step = document.querySelector(`[data-track="${track}"][data-step="${i}"]`);
      if (step) {
        step.classList.toggle('active', !!stepData.note);
        const noteDisplay = step.querySelector('.note-display');
        if (noteDisplay) {
          noteDisplay.textContent = stepData.note || '';
        }
        const velocityFill = step.querySelector('.velocity-fill');
        if (velocityFill) {
          velocityFill.style.setProperty('--velocity', `${(stepData.velocity / 127) * 100}%`);
        }
      }
    });
  });
}

// Update step indicator
function updateStepIndicator() {
  document.querySelectorAll('.step.current').forEach(step => {
    step.classList.remove('current');
  });
  
  allTracks.forEach(track => {
    const step = document.querySelector(`[data-track="${track}"][data-step="${currentStep}"]`);
    if (step) step.classList.add('current');
  });
}

// Initialize sequencers
function initializeSequencers() {
  createDrumSequencer();
  createMelodySequencer();
  loadDefaultPattern();
  updateSequencerDisplay();
}

// Load default pattern
function loadDefaultPattern() {
  const pattern = patterns[0];

  // Default drum pattern
  pattern.kick = [70,0,0,0, 70,0,0,0, 70,0,0,0, 70,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
  pattern.snare = [0,0,0,0, 70,0,0,0, 0,0,0,0, 70,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
  pattern.hihat = [50,0,50,0, 50,0,50,0, 50,0,50,0, 50,0,50,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];

  // Default melody pattern
  const scale = scales[currentKey];
  pattern.bass[0] = { note: scale[0], velocity: 80 };
  pattern.bass[4] = { note: scale[2], velocity: 70 };
  pattern.bass[8] = { note: scale[4], velocity: 80 };
  pattern.bass[12] = { note: scale[2], velocity: 70 };

  // Default pad pattern (chords on beats)
  pattern.pad[0] = { note: scale[0], velocity: 60 };
  pattern.pad[8] = { note: scale[4], velocity: 55 };
}

// Event Listeners
document.getElementById('playButton').addEventListener('click', async () => {
  await initializeAudio();
  
  const button = document.getElementById('playButton');
  
  if (!isPlaying) {
    loop.start(0);
    if (arpPattern !== 'off') {
      arpLoop.start(0);
    }
    Tone.Transport.start();
    button.textContent = '⏸';
    button.classList.add('playing');
    isPlaying = true;
  } else {
    loop.stop();
    arpLoop.stop();
    Tone.Transport.stop();
    button.textContent = '▶';
    button.classList.remove('playing');
    isPlaying = false;
    currentStep = 0;
    arpStep = 0;
    updateStepIndicator();
  }
});

// Tempo control
const tempoSlider = document.getElementById('tempoSlider');
const tempoValue = document.getElementById('tempoValue');

tempoSlider.addEventListener('input', (e) => {
  Tone.Transport.bpm.value = e.target.value;
  tempoValue.textContent = e.target.value;
});

// Swing control
const swingSlider = document.getElementById('swingSlider');
const swingValue = document.getElementById('swingValue');

swingSlider.addEventListener('input', (e) => {
  swingAmount = parseInt(e.target.value);
  swingValue.textContent = e.target.value;
});

// Sidechain control
const sidechainSlider = document.getElementById('sidechainSlider');
const sidechainValue = document.getElementById('sidechainValue');

sidechainSlider.addEventListener('input', (e) => {
  sidechainAmount = parseInt(e.target.value);
  sidechainValue.textContent = e.target.value;
});

// Master volume
const masterVolume = document.getElementById('masterVolume');
const masterVolumeValue = document.getElementById('masterVolumeValue');

masterVolume.addEventListener('input', async (e) => {
  if (!isInitialized) await initializeAudio();
  const volume = (e.target.value / 100) * 0.7 - 0.3;
  Tone.Destination.volume.value = volume;
  masterVolumeValue.textContent = e.target.value;
});

// Key selection
const keySelect = document.getElementById('keySelect');
keySelect.addEventListener('change', (e) => {
  currentKey = e.target.value;
  updateSequencerDisplay();
});

// Pattern length
const patternLengthSelect = document.getElementById('patternLength');
patternLengthSelect.addEventListener('change', (e) => {
  patternLength = parseInt(e.target.value);
  createDrumSequencer();
  createMelodySequencer();
  updateSequencerDisplay();
});

// Arpeggiator controls
const arpPatternSelect = document.getElementById('arpPattern');
const arpSpeedSlider = document.getElementById('arpSpeed');
const arpSpeedValue = document.getElementById('arpSpeedValue');

arpPatternSelect.addEventListener('change', async (e) => {
  arpPattern = e.target.value;
  arpStep = 0;
  
  if (isInitialized && isPlaying) {
    arpLoop.stop();
    if (arpPattern !== 'off') {
      arpLoop.interval = getArpNoteDuration();
      arpLoop.start(0);
    }
  }
});

arpSpeedSlider.addEventListener('input', async (e) => {
  arpSpeed = parseInt(e.target.value);
  const speedNames = ['4', '8', '16', '32'];
  arpSpeedValue.textContent = speedNames[arpSpeed - 1];
  
  if (isInitialized && isPlaying && arpPattern !== 'off') {
    arpLoop.stop();
    arpLoop.interval = getArpNoteDuration();
    arpLoop.start(0);
  }
});

// Mute/Solo buttons
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('mute-btn')) {
    const track = e.target.dataset.track;
    toggleMute(track);
  } else if (e.target.classList.contains('solo-btn')) {
    const track = e.target.dataset.track;
    toggleSolo(track);
  }
});

// Individual track volumes
allTracks.forEach(track => {
  const slider = document.getElementById(`${track}Volume`);
  if (slider) {
    slider.addEventListener('input', async (e) => {
      if (!isInitialized) await initializeAudio();
      const volume = (e.target.value / 100) * 0.5 - 0.2;
      synths[track].volume.value = volume;
    });
  }
});

// Effects controls
const effectControls = {
  reverb: { element: document.getElementById('reverbSlider'), value: document.getElementById('reverbValue') },
  delay: { element: document.getElementById('delaySlider'), value: document.getElementById('delayValue') },
  filter: { element: document.getElementById('filterSlider'), value: document.getElementById('filterValue') },
  distortion: { element: document.getElementById('distortionSlider'), value: document.getElementById('distortionValue') }
};

effectControls.reverb.element.addEventListener('input', async (e) => {
  if (!isInitialized) await initializeAudio();
  const wetness = e.target.value / 100;
  effects.reverb.wet.value = wetness;
  effectControls.reverb.value.textContent = e.target.value;
});

effectControls.delay.element.addEventListener('input', async (e) => {
  if (!isInitialized) await initializeAudio();
  const wetness = e.target.value / 100;
  effects.delay.wet.value = wetness;
  effectControls.delay.value.textContent = e.target.value;
});

effectControls.filter.element.addEventListener('input', async (e) => {
  if (!isInitialized) await initializeAudio();
  effects.filter.frequency.value = e.target.value;
  effectControls.filter.value.textContent = e.target.value;
});

effectControls.distortion.element.addEventListener('input', async (e) => {
  if (!isInitialized) await initializeAudio();
  const amount = e.target.value / 100;
  effects.distortion.distortion = amount;
  effectControls.distortion.value.textContent = e.target.value;
});

// Pattern switching
document.querySelectorAll('.pattern-button').forEach(button => {
  button.addEventListener('click', () => {
    currentPattern = parseInt(button.dataset.pattern);
    document.querySelectorAll('.pattern-button').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    updateSequencerDisplay();
  });
});

// Clear pattern
document.getElementById('clearPattern').addEventListener('click', () => {
  const pattern = patterns[currentPattern];
  
  drumTracks.forEach(track => {
    pattern[track] = Array(32).fill(0);
  });
  
  melodyTracks.forEach(track => {
    pattern[track] = Array(32).fill().map(() => ({ note: null, velocity: 70 }));
  });
  
  updateSequencerDisplay();
});

// Randomize pattern - Phrase-aware generation for professional EDM
document.getElementById('randomizePattern').addEventListener('click', () => {
  generatePhraseAwareEDM();
  updateSequencerDisplay();
});

// Phrase-aware EDM pattern generation (8-bar structure)
function generatePhraseAwareEDM() {
  const pattern = patterns[currentPattern];
  const scale = scales[currentKey];

  // Helper: get phrase section for a step (32 steps = 8 bars of 4 steps)
  function getPhraseSection(step) {
    const bar = Math.floor(step / 4);
    if (bar < 2) return 'buildup';    // Bars 1-2: intro/buildup
    if (bar < 4) return 'drop';       // Bars 3-4: main drop
    if (bar < 6) return 'breakdown';  // Bars 5-6: breakdown/contrast
    return 'outro';                    // Bars 7-8: outro/transition
  }

  // EDM-style four-on-the-floor kick with phrase variation
  pattern.kick = Array(32).fill(0).map((_, i) => {
    const section = getPhraseSection(i);
    const onBeat = i % 4 === 0;

    if (section === 'buildup') {
      // Sparse kick building up
      if (i < 4) return onBeat ? 75 + Math.random() * 25 : 0;
      return onBeat ? 85 + Math.random() * 25 : (i % 2 === 0 && Math.random() > 0.7 ? 60 : 0);
    } else if (section === 'drop') {
      // Full four-on-the-floor
      return onBeat ? 100 + Math.random() * 20 : 0;
    } else if (section === 'breakdown') {
      // Half-time or sparse
      if (i % 8 === 0) return 85 + Math.random() * 25;
      return 0;
    } else { // outro
      // Building back up
      return onBeat ? 90 + Math.random() * 25 : 0;
    }
  });

  // Snare/clap on 2 and 4
  pattern.snare = Array(32).fill(0).map((_, i) => {
    const section = getPhraseSection(i);
    const isBackbeat = i % 8 === 4;

    if (section === 'buildup') {
      if (i >= 4 && isBackbeat) return 70 + Math.random() * 30;
      if (i >= 6 && i % 4 === 2) return Math.random() > 0.6 ? 55 + Math.random() * 20 : 0;
      return 0;
    } else if (section === 'drop') {
      if (isBackbeat) return 90 + Math.random() * 30;
      if (i % 4 === 2 && Math.random() > 0.7) return 60 + Math.random() * 25;
      return 0;
    } else if (section === 'breakdown') {
      return isBackbeat ? 75 + Math.random() * 25 : 0;
    } else { // outro - fill
      if (i >= 28) return 70 + Math.random() * 40; // Build-up fill
      return isBackbeat ? 85 + Math.random() * 25 : 0;
    }
  });

  // Offbeat hihat pattern
  pattern.hihat = Array(32).fill(0).map((_, i) => {
    const section = getPhraseSection(i);
    const offBeat = i % 2 === 1;

    if (section === 'buildup') {
      if (i < 4) return 0;
      return offBeat ? 50 + Math.random() * 30 : 0;
    } else if (section === 'drop') {
      // Classic EDM offbeat hihat
      return offBeat ? 60 + Math.random() * 35 : (Math.random() > 0.8 ? 40 + Math.random() * 20 : 0);
    } else if (section === 'breakdown') {
      return Math.random() > 0.6 ? 45 + Math.random() * 30 : 0;
    } else { // outro
      return offBeat ? 55 + Math.random() * 30 : 0;
    }
  });

  // Open hihat accents
  pattern.openhat = Array(32).fill(0).map((_, i) => {
    const section = getPhraseSection(i);
    if (section === 'drop' && i % 4 === 3) return Math.random() > 0.5 ? 60 + Math.random() * 30 : 0;
    if (section === 'outro' && i === 31) return 75 + Math.random() * 25;
    return 0;
  });

  // Clap layers
  pattern.clap = Array(32).fill(0).map((_, i) => {
    const section = getPhraseSection(i);
    const isBackbeat = i % 8 === 4;
    if (section === 'drop' && isBackbeat) return 85 + Math.random() * 30;
    if (section === 'outro' && i >= 28) return 70 + Math.random() * 35;
    return 0;
  });

  // Crash on transitions
  pattern.crash = Array(32).fill(0).map((_, i) => {
    if (i === 0) return 80 + Math.random() * 30;  // Intro
    if (i === 8) return 100 + Math.random() * 20; // Drop!
    if (i === 16) return 75 + Math.random() * 25; // Breakdown
    if (i === 24) return 85 + Math.random() * 25; // Outro build
    return 0;
  });

  // EDM Bass - pumping bassline
  const bassNotes = [0, 0, 4, 3]; // I-I-V-IV progression common in EDM
  let lastBassNote = 0;

  pattern.bass = Array(32).fill().map((_, i) => {
    const section = getPhraseSection(i);
    const bar = Math.floor(i / 4);
    const onBeat = i % 4 === 0;

    if (section === 'buildup') {
      if (i < 4) return { note: null, velocity: 70 };
      if (onBeat) {
        const degree = bassNotes[bar % 4];
        lastBassNote = degree;
        return { note: scale[degree], velocity: 75 + Math.random() * 25 };
      }
      return { note: null, velocity: 70 };
    } else if (section === 'drop') {
      // Pumping eighth note bass
      if (i % 2 === 0) {
        const degree = bassNotes[bar % 4];
        lastBassNote = degree;
        return { note: scale[degree], velocity: 90 + Math.random() * 25 };
      }
      return { note: null, velocity: 70 };
    } else if (section === 'breakdown') {
      // Sparse, sustained
      if (onBeat && i % 8 === 0) {
        const degree = bassNotes[bar % 4];
        lastBassNote = degree;
        return { note: scale[degree], velocity: 70 + Math.random() * 20 };
      }
      return { note: null, velocity: 70 };
    } else { // outro
      if (onBeat) {
        const degree = bar === 6 ? 4 : 0; // V - I resolution
        lastBassNote = degree;
        return { note: scale[degree], velocity: 85 + Math.random() * 25 };
      }
      if (i >= 28 && i % 2 === 0) {
        return { note: scale[0], velocity: 95 };
      }
      return { note: null, velocity: 70 };
    }
  });

  // Lead melody/synth - for arpeggiator or direct play
  let lastLeadNote = 0;

  pattern.lead = Array(32).fill().map((_, i) => {
    const section = getPhraseSection(i);

    if (section === 'buildup') {
      // Rising notes building tension
      if (i % 4 === 0 && i >= 4) {
        const step = Math.min(6, Math.floor(i / 4));
        lastLeadNote = step;
        return { note: scale[step % 7], velocity: 60 + (i * 2) };
      }
      return { note: null, velocity: 70 };
    } else if (section === 'drop') {
      // Catchy hook pattern
      if (i % 2 === 0 || (i % 4 === 1 && Math.random() > 0.5)) {
        const step = (lastLeadNote + (Math.random() > 0.6 ? 2 : 1)) % 7;
        lastLeadNote = step;
        return { note: scale[step], velocity: 75 + Math.random() * 35 };
      }
      return { note: null, velocity: 70 };
    } else if (section === 'breakdown') {
      // Melodic, emotional
      if (i % 4 === 0 || i % 4 === 2) {
        const step = [0, 2, 4, 2][Math.floor((i % 16) / 4)]; // Arpeggiated feel
        lastLeadNote = step;
        return { note: scale[step], velocity: 65 + Math.random() * 25 };
      }
      return { note: null, velocity: 70 };
    } else { // outro
      // Echo of the drop hook
      if (i % 4 === 0) {
        const step = i >= 28 ? 0 : lastLeadNote;
        return { note: scale[step], velocity: 70 + Math.random() * 30 };
      }
      return { note: null, velocity: 70 };
    }
  });

  // Pad - sustained atmospheric chords
  pattern.pad = Array(32).fill().map((_, i) => {
    if (i === 0) return { note: scale[0], velocity: 55 };  // I
    if (i === 8) return { note: scale[0], velocity: 50 };  // Still I (drop)
    if (i === 16) return { note: scale[3], velocity: 60 }; // IV (breakdown - emotional)
    if (i === 24) return { note: scale[4], velocity: 55 }; // V (building)
    return { note: null, velocity: 70 };
  });
}

// Velocity presets
document.querySelectorAll('.velocity-preset').forEach(button => {
  button.addEventListener('click', () => {
    const preset = button.dataset.preset;
    applyVelocityPreset(preset);
  });
});

function applyVelocityPreset(preset) {
  const pattern = patterns[currentPattern];
  
  switch (preset) {
    case 'soft':
      drumTracks.forEach(track => {
        pattern[track] = pattern[track].map(v => v > 0 ? 40 + Math.random() * 20 : 0);
      });
      break;
    case 'medium':
      drumTracks.forEach(track => {
        pattern[track] = pattern[track].map(v => v > 0 ? 60 + Math.random() * 20 : 0);
      });
      break;
    case 'hard':
      drumTracks.forEach(track => {
        pattern[track] = pattern[track].map(v => v > 0 ? 90 + Math.random() * 20 : 0);
      });
      break;
    case 'accent':
      drumTracks.forEach(track => {
        pattern[track] = pattern[track].map((v, i) => {
          if (v > 0) {
            return (i % 4 === 0) ? 100 + Math.random() * 27 : 50 + Math.random() * 30;
          }
          return 0;
        });
      });
      break;
  }
  
  updateSequencerDisplay();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    document.getElementById('playButton').click();
  }
  
  if (e.key === 'v' || e.key === 'V') {
    isEditingVelocity = !isEditingVelocity;
    document.body.style.cursor = isEditingVelocity ? 'crosshair' : 'default';
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'v' || e.key === 'V') {
    isEditingVelocity = false;
    document.body.style.cursor = 'default';
  }
});

// MIDI Export button
const exportButton = document.getElementById('exportMIDI');
if (exportButton) {
  exportButton.addEventListener('click', () => {
    exportToMIDI();
  });
}

// Initialize everything
initializeSequencers();