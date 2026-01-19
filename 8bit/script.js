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

// Audio components
let synths = {};
let effects = {};
let sidechainCompressor = {};
let loop;
let arpLoop;

/* === MIDI EXPORT FUNCTIONS === */

// MIDI drum mapping (General MIDI standard)
const DRUM_MIDI_MAP = {
  'kick': 36,     // Bass Drum 1
  'snare': 38,    // Acoustic Snare
  'hihat': 42,    // Closed Hi Hat
  'openhat': 46,  // Open Hi-Hat
  'clap': 39,     // Hand Clap
  'crash': 49     // Crash Cymbal 1
};

// Convert note name to MIDI number
function noteToMidi(noteName, octave) {
  const NOTE_VALUES = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11
  };
  
  return (octave + 1) * 12 + NOTE_VALUES[noteName];
}

// Variable Length Quantity encoder
function encodeVLQ(value) {
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

// Create 32-bit and 16-bit byte arrays
function u32ToBytes(n) { return [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]; }
function u16ToBytes(n) { return [(n>>>8)&255,n&255]; }

// Main MIDI export function
function exportPatternToMIDI() {
  const currentPatternData = patterns[currentPattern];
  const bpm = parseInt(document.getElementById('tempoSlider').value, 10);
  const microPerQuarter = Math.round(60000000 / bpm);
  
  // Convert pattern to MIDI events
  const events = buildMIDIEventsFromPattern(currentPatternData, microPerQuarter);
  
  // Wrap in standard MIDI file format
  const midiData = wrapInSMFFormat(events);
  
  // Download the file
  downloadMIDIFile(midiData, '8bit-loop.mid');
}

// Build MIDI events from 8-bit pattern data
function buildMIDIEventsFromPattern(patternData, microPerQuarter) {
  const events = [];
  const TPQ = 480; // ticks per quarter note
  
  function pushBytes(...arr) { 
    for (const x of arr) events.push(x); 
  }
  
  // Add tempo meta event
  pushBytes(...encodeVLQ(0), 0xFF, 0x51, 0x03, 
             (microPerQuarter>>16)&255, 
             (microPerQuarter>>8)&255, 
             microPerQuarter&255);
  
  // Collect all MIDI events with timing
  const allEvents = [];
  const stepTicks = TPQ / 4; // 16th note steps
  
  // Process drum tracks
  drumTracks.forEach(track => {
    const midiNote = DRUM_MIDI_MAP[track];
    patternData[track].slice(0, patternLength).forEach((velocity, step) => {
      if (velocity > 0) {
        const tick = step * stepTicks;
        allEvents.push({
          tick: tick,
          type: 'noteOn',
          channel: 9, // MIDI drum channel
          note: midiNote,
          velocity: velocity
        });
        allEvents.push({
          tick: tick + (stepTicks * 0.9), // Short drum hit
          type: 'noteOff',
          channel: 9,
          note: midiNote,
          velocity: 0
        });
      }
    });
  });
  
  // Process melody tracks
  melodyTracks.forEach((track, trackIndex) => {
    const channel = trackIndex; // Use different channels for each melodic track
    patternData[track].slice(0, patternLength).forEach((stepData, step) => {
      if (stepData && stepData.note) {
        const octave = track === 'bass' ? 2 : track === 'lead' ? 4 : 3;
        const midiNote = noteToMidi(stepData.note, octave);
        const tick = step * stepTicks;
        const duration = stepTicks * 1.5; // Note duration
        
        allEvents.push({
          tick: tick,
          type: 'noteOn',
          channel: channel,
          note: midiNote,
          velocity: stepData.velocity
        });
        allEvents.push({
          tick: tick + duration,
          type: 'noteOff',
          channel: channel,
          note: midiNote,
          velocity: 0
        });
      }
    });
  });
  
  // Sort events by tick time
  allEvents.sort((a, b) => a.tick - b.tick || (a.type === 'noteOff' ? 1 : -1));
  
  // Convert to MIDI delta time format
  let currentTick = 0;
  for (const event of allEvents) {
    const deltaTime = Math.max(0, event.tick - currentTick);
    currentTick = event.tick;
    
    if (event.type === 'noteOn') {
      pushBytes(...encodeVLQ(deltaTime), 0x90 | event.channel, event.note, event.velocity);
    } else {
      pushBytes(...encodeVLQ(deltaTime), 0x80 | event.channel, event.note, 0x40);
    }
  }
  
  // End of track
  pushBytes(...encodeVLQ(0), 0xFF, 0x2F, 0x00);
  
  return new Uint8Array(events);
}

// Wrap MIDI events in Standard MIDI File format
function wrapInSMFFormat(trackData) {
  const trackLen = trackData.length;
  
  const header = [
    0x4d,0x54,0x68,0x64, // MThd
    ...u32ToBytes(6),     // header length
    ...u16ToBytes(0),     // format 0
    ...u16ToBytes(1),     // ntrks = 1
    ...u16ToBytes(480),   // division (TPQ)
  ];
  
  const trackHeader = [
    0x4d,0x54,0x72,0x6b, // MTrk
    ...u32ToBytes(trackLen),
  ];
  
  const full = new Uint8Array(header.length + trackHeader.length + trackLen);
  full.set(header, 0);
  full.set(trackHeader, header.length);
  full.set(trackData, header.length + trackHeader.length);
  
  return full;
}

// Download MIDI file
function downloadMIDIFile(bytes, filename) {
  const blob = new Blob([bytes], {type: 'audio/midi'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; 
  a.download = filename; 
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* === AUDIO INITIALIZATION AND PLAYBACK === */

async function initializeAudio() {
  if (isInitialized) return;
  
  await Tone.start();
  
  // Create 8-bit style drum synths
  synths.kick = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
    filter: { Q: 1, frequency: 100, type: 'lowpass' }
  });
  
  synths.snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 }
  });
  
  synths.hihat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.01, sustain: 0, release: 0.01 }
  });

  synths.openhat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.02 }
  });

  synths.clap = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 }
  });

  synths.crash = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 }
  });
  
  // Create 8-bit style melodic synths
  synths.lead = new Tone.Synth({
    oscillator: { 
      type: 'square',
      modulationType: 'square',
      modulationFrequency: 0.5
    },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0.2, release: 0.1 },
    filter: { Q: 2, frequency: 3000, type: 'lowpass' }
  });

  synths.pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { 
      type: 'square'
    },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.3 },
    filter: { Q: 1, frequency: 2000, type: 'lowpass' }
  });

  synths.bass = new Tone.Synth({
    oscillator: { 
      type: 'triangle'
    },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0.3, release: 0.1 },
    filter: { Q: 2, frequency: 800, type: 'lowpass' }
  });

  // Create retro-style effects
  effects.reverb = new Tone.Reverb(0.8);
  effects.delay = new Tone.FeedbackDelay(0.125, 0.2); // Shorter delay for 8-bit feel
  effects.filter = new Tone.Filter(4000, 'lowpass');
  effects.distortion = new Tone.Distortion(0);

  // Add bit crusher for authentic retro sound
  effects.bitCrusher = new Tone.BitCrusher(8);

  // Create simple compressors for melodic tracks (lighter sidechain)
  melodyTracks.forEach(track => {
    sidechainCompressor[track] = new Tone.Compressor(-20, 8);
  });

  // Chain effects for drums (simple chain with bit crushing)
  const drumEffectsChain = Tone.Destination;
  drumTracks.forEach(track => {
    synths[track].chain(effects.bitCrusher, effects.filter, effects.delay, effects.reverb, drumEffectsChain);
  });

  // Chain effects for melody (with light sidechain and bit crushing)
  melodyTracks.forEach(track => {
    synths[track].chain(effects.bitCrusher, sidechainCompressor[track], effects.filter, effects.delay, effects.reverb, Tone.Destination);
  });

  // Create the main loop
  loop = new Tone.Loop(time => {
    const pattern = patterns[currentPattern];
    const stepTime = time;
    
    // Apply swing to off-beat steps
    let swingOffset = 0;
    if (currentStep % 2 === 1 && swingAmount > 0) {
      swingOffset = (swingAmount / 100) * 0.03; // Lighter swing for 8-bit
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
          synths[track].triggerAttackRelease('C1', '32n', actualTime, normalizedVelocity);
          
          // Trigger light sidechain compression
          if (sidechainAmount > 0) {
            triggerSidechain(actualTime);
          }
        } else if (track === 'snare') {
          synths[track].triggerAttackRelease('32n', actualTime, normalizedVelocity);
        } else {
          synths[track].triggerAttackRelease('64n', actualTime, normalizedVelocity);
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
          // Play simple chord for pad (8-bit style)
          const chord = getChiptuneChord(stepData.note, octave);
          synths[track].triggerAttackRelease(chord, '8n', actualTime, normalizedVelocity);
        } else if (track === 'bass') {
          synths[track].triggerAttackRelease(noteWithOctave, '8n', actualTime, normalizedVelocity);
        } else {
          synths[track].triggerAttackRelease(noteWithOctave, '16n', actualTime, normalizedVelocity);
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
      synths.lead.triggerAttackRelease(noteWithOctave, '32n', time, normalizedVelocity);
    }
  }, getArpNoteDuration());

  isInitialized = true;
}

// Light sidechain compression trigger (less aggressive for 8-bit)
function triggerSidechain(time) {
  melodyTracks.forEach(track => {
    const compressor = sidechainCompressor[track];
    const intensity = sidechainAmount / 100 * 0.5; // Reduced intensity
    
    // Create gentle envelope to duck the volume
    compressor.threshold.setValueAtTime(-15 - (intensity * 10), time);
    compressor.threshold.exponentialRampToValueAtTime(-10, time + 0.05);
    compressor.threshold.exponentialRampToValueAtTime(-20, time + 0.15);
  });
}

// Arpeggiator functions
function getArpNoteDuration() {
  const durations = ['8n', '16n', '32n', '64n']; // Faster for 8-bit feel
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

// Get simple chord notes for pad track (8-bit style)
function getChiptuneChord(rootNote, octave) {
  const scale = scales[currentKey];
  const rootIndex = scale.indexOf(rootNote);
  if (rootIndex === -1) return [rootNote + octave];
  
  const third = scale[(rootIndex + 2) % scale.length];
  
  // Simple two-note "chord" for authentic 8-bit sound
  return [
    rootNote + octave,
    third + octave
  ];
}

// Create drum sequencer with chip-tune track names - IMPROVED VERSION
function createDrumSequencer() {
  const sequencer = document.getElementById('drumSequencer');
  if (!sequencer) {
    console.error('drumSequencer element not found!');
    return;
  }
  
  sequencer.innerHTML = '';
  
  const drumTrackNames = {
    'kick': 'Bass Drum',
    'snare': 'Snare',
    'hihat': 'Hi-Hat',
    'openhat': 'Open Hat',
    'clap': 'Hand Clap',
    'crash': 'Cymbal'
  };
  
  drumTracks.forEach(track => {
    const row = document.createElement('div');
    row.className = 'sequencer-row';
    
    const label = document.createElement('div');
    label.className = 'track-label';
    label.textContent = drumTrackNames[track];
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
      
      // IMPROVED event listeners - capture track and step in closure
      step.addEventListener('click', (function(currentTrack, currentStep) {
        return function(e) {
          if (e.shiftKey || isEditingVelocity) {
            // Edit velocity
            editStepVelocity(currentTrack, currentStep, e);
          } else {
            // Toggle step
            toggleDrumStep(currentTrack, currentStep);
          }
        };
      })(track, i));

      step.addEventListener('contextmenu', (function(currentTrack, currentStep) {
        return function(e) {
          e.preventDefault();
          resetStepVelocity(currentTrack, currentStep);
        };
      })(track, i));
      
      steps.appendChild(step);
    }
    
    row.appendChild(steps);
    sequencer.appendChild(row);
  });
}

// Create melody sequencer with chip-tune track names - IMPROVED VERSION
function createMelodySequencer() {
  const sequencer = document.getElementById('melodySequencer');
  if (!sequencer) {
    console.error('melodySequencer element not found!');
    return;
  }
  
  sequencer.innerHTML = '';
  
  const melodyTrackNames = {
    'lead': 'Melody',
    'pad': 'Harmony',
    'bass': 'Bass'
  };
  
  melodyTracks.forEach(track => {
    const row = document.createElement('div');
    row.className = 'sequencer-row';
    
    const label = document.createElement('div');
    label.className = 'track-label';
    label.textContent = melodyTrackNames[track];
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
      
      // IMPROVED event listeners - capture track and step in closure
      step.addEventListener('click', (function(currentTrack, currentStep) {
        return function(e) {
          e.preventDefault();
          
          if (e.shiftKey || isEditingVelocity) {
            editStepVelocity(currentTrack, currentStep, e);
          } else {
            selectMelodyNote(currentTrack, currentStep);
          }
        };
      })(track, i));

      step.addEventListener('contextmenu', (function(currentTrack, currentStep) {
        return function(e) {
          e.preventDefault();
          clearMelodyStep(currentTrack, currentStep);
        };
      })(track, i));
      
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

// Apply velocity presets
function applyVelocityPreset(preset) {
  const pattern = patterns[currentPattern];
  
  switch (preset) {
    case 'soft':
      drumTracks.forEach(track => {
        pattern[track] = pattern[track].map(v => v > 0 ? 50 + Math.random() * 20 : 0);
      });
      break;
    case 'medium':
      drumTracks.forEach(track => {
        pattern[track] = pattern[track].map(v => v > 0 ? 70 + Math.random() * 20 : 0);
      });
      break;
    case 'hard':
      drumTracks.forEach(track => {
        pattern[track] = pattern[track].map(v => v > 0 ? 90 + Math.random() * 30 : 0);
      });
      break;
    case 'accent':
      drumTracks.forEach(track => {
        pattern[track] = pattern[track].map((v, i) => {
          if (v > 0) {
            return (i % 4 === 0) ? 110 + Math.random() * 17 : 60 + Math.random() * 30;
          }
          return 0;
        });
      });
      break;
  }
  
  updateSequencerDisplay();
}

// Select melody note - FIXED VERSION
function selectMelodyNote(track, stepIndex) {
  const scale = scales[currentKey];
  const pattern = patterns[currentPattern];
  const currentStep = pattern[track][stepIndex];
  
  if (!currentStep || !currentStep.note) {
    // Set to root note if empty - ENSURE object structure
    pattern[track][stepIndex] = { note: scale[0], velocity: 70 };
  } else {
    // Cycle through scale notes
    const currentIndex = scale.indexOf(currentStep.note);
    const nextIndex = (currentIndex + 1) % scale.length;
    pattern[track][stepIndex] = { note: scale[nextIndex], velocity: currentStep.velocity };
  }
  
  updateSequencerDisplay();
}

// Clear melody step - IMPROVED
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

// Update sequencer display - IMPROVED with better error checking
function updateSequencerDisplay() {
  const pattern = patterns[currentPattern];
  if (!pattern) {
    console.error('Pattern not found:', currentPattern);
    return;
  }
  
  // Update drum tracks
  drumTracks.forEach(track => {
    if (!pattern[track]) {
      console.error('Drum track not found in pattern:', track);
      return;
    }
    
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
  
  // Update melody tracks - IMPROVED
  melodyTracks.forEach(track => {
    if (!pattern[track]) {
      console.error('Melody track not found in pattern:', track);
      return;
    }
    
    pattern[track].slice(0, patternLength).forEach((stepData, i) => {
      const step = document.querySelector(`[data-track="${track}"][data-step="${i}"]`);
      if (step) {
        const hasNote = stepData && stepData.note;
        step.classList.toggle('active', hasNote);
        
        const noteDisplay = step.querySelector('.note-display');
        if (noteDisplay) {
          noteDisplay.textContent = hasNote ? stepData.note : '';
        }
        
        const velocityFill = step.querySelector('.velocity-fill');
        if (velocityFill && stepData) {
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

// Initialize sequencers - IMPROVED with validation
function initializeSequencers() {
  // Validate patterns exist and have correct structure
  patterns.forEach((pattern, index) => {
    // Ensure all melody tracks have correct structure
    melodyTracks.forEach(track => {
      if (!pattern[track]) {
        pattern[track] = Array(32).fill().map(() => ({ note: null, velocity: 70 }));
      } else {
        // Validate each step has correct structure
        pattern[track] = pattern[track].map(step => {
          if (!step || typeof step !== 'object') {
            return { note: null, velocity: 70 };
          }
          return {
            note: step.note || null,
            velocity: step.velocity || 70
          };
        });
      }
    });
    
    // Ensure all drum tracks exist
    drumTracks.forEach(track => {
      if (!pattern[track]) {
        pattern[track] = Array(32).fill(0);
      }
    });
  });
  
  createDrumSequencer();
  createMelodySequencer();
  loadDefaultChiptunePattern();
  updateSequencerDisplay();
}

// Load default 8-bit style pattern
function loadDefaultChiptunePattern() {
  const pattern = patterns[0];
  
  // Classic 8-bit drum pattern
  pattern.kick = [90,0,0,0, 90,0,0,0, 90,0,0,0, 90,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
  pattern.snare = [0,0,0,0, 80,0,0,0, 0,0,0,0, 80,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
  pattern.hihat = [60,0,60,0, 60,0,60,0, 60,0,60,0, 60,0,60,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
  
  // Simple 8-bit melody pattern
  const scale = scales[currentKey];
  
  // Bass pattern
  pattern.bass[0] = { note: scale[0], velocity: 90 };
  pattern.bass[4] = { note: scale[2], velocity: 80 };
  pattern.bass[8] = { note: scale[4], velocity: 90 };
  pattern.bass[12] = { note: scale[2], velocity: 80 };
  
  // Add some melody notes for arpeggiator (lead)
  pattern.lead[1] = { note: scale[0], velocity: 70 };
  pattern.lead[3] = { note: scale[2], velocity: 70 };
  pattern.lead[5] = { note: scale[4], velocity: 70 };
  
  // Add harmony pattern (pad) - FIXED: was missing before
  pattern.pad[0] = { note: scale[2], velocity: 60 };
  pattern.pad[8] = { note: scale[4], velocity: 60 };
  pattern.pad[16] = { note: scale[1], velocity: 55 };
  pattern.pad[24] = { note: scale[6], velocity: 55 };
}

/* === EVENT LISTENERS === */

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeSequencers();
  
  // Play button
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

  // MIDI Export button
  const exportButton = document.getElementById('exportMIDI');
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      exportPatternToMIDI();
    });
  }

  // Tempo control
  const tempoSlider = document.getElementById('tempoSlider');
  const tempoValue = document.getElementById('tempoValue');

  tempoSlider.addEventListener('input', (e) => {
    Tone.Transport.bpm.value = e.target.value;
    tempoValue.textContent = e.target.value;
  });

  // Groove control (was swing)
  const swingSlider = document.getElementById('swingSlider');
  const swingValue = document.getElementById('swingValue');

  swingSlider.addEventListener('input', (e) => {
    swingAmount = parseInt(e.target.value);
    swingValue.textContent = e.target.value;
  });

  // Ducking control (was sidechain)
  const sidechainSlider = document.getElementById('sidechainSlider');
  const sidechainValue = document.getElementById('sidechainValue');

  sidechainSlider.addEventListener('input', (e) => {
    sidechainAmount = parseInt(e.target.value);
    sidechainValue.textContent = e.target.value;
  });

  // Master volume
  const masterVolume = document.getElementById('masterVolume');
  const masterVolumeValue = document.getElementById('masterVolumeValue');

  masterVolume.addEventListener('input', (e) => {
    const volume = (e.target.value / 100) * 0.7 - 0.3;
    Tone.Destination.volume.value = volume;
    masterVolumeValue.textContent = e.target.value;
  });

  // Scale selection (was key)
  const keySelect = document.getElementById('keySelect');
  keySelect.addEventListener('change', (e) => {
    currentKey = e.target.value;
    updateSequencerDisplay();
  });

  // Loop length (was pattern length)
  const patternLengthSelect = document.getElementById('patternLength');
  patternLengthSelect.addEventListener('change', (e) => {
    patternLength = parseInt(e.target.value);
    createDrumSequencer();
    createMelodySequencer();
    updateSequencerDisplay();
  });

  // Melody Magic controls (was arpeggiator)
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
    const speedNames = ['8', '16', '32', '64']; // Updated for 8-bit feel
    arpSpeedValue.textContent = speedNames[arpSpeed - 1];
    
    if (isInitialized && isPlaying && arpPattern !== 'off') {
      arpLoop.stop();
      arpLoop.interval = getArpNoteDuration();
      arpLoop.start(0);
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

  // Loop switching (was pattern switching)
  document.querySelectorAll('.pattern-button').forEach(button => {
    button.addEventListener('click', () => {
      currentPattern = parseInt(button.dataset.pattern);
      document.querySelectorAll('.pattern-button').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      updateSequencerDisplay();
    });
  });

  // Clear loop
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

  // Magic Dice (was randomize)
  document.getElementById('randomizePattern').addEventListener('click', () => {
    const pattern = patterns[currentPattern];
    const scale = scales[currentKey];
    
    // Randomize drums with 8-bit style probability - ALL DRUM TRACKS
    pattern.kick = Array(32).fill(0).map((_, i) => 
      (i % 4 === 0) ? (Math.random() > 0.2 ? 80 + Math.random() * 40 : 0) : 
      (Math.random() > 0.85 ? 60 + Math.random() * 30 : 0)
    );
    
    pattern.snare = Array(32).fill(0).map((_, i) => 
      (i % 8 === 4) ? (Math.random() > 0.1 ? 70 + Math.random() * 40 : 0) : 
      (Math.random() > 0.95 ? 50 + Math.random() * 30 : 0)
    );
    
    pattern.hihat = Array(32).fill(0).map((_, i) => 
      (i % 2 === 1) ? (Math.random() > 0.3 ? 50 + Math.random() * 30 : 0) : 
      (Math.random() > 0.7 ? 40 + Math.random() * 30 : 0)
    );
    
    // Add openhat randomization (less frequent, clashes with hihat)
    pattern.openhat = Array(32).fill(0).map((_, i) => 
      (i % 8 === 7) ? (Math.random() > 0.4 ? 60 + Math.random() * 30 : 0) : 
      (Math.random() > 0.9 ? 50 + Math.random() * 20 : 0)
    );
    
    // Add clap randomization (accent beats)
    pattern.clap = Array(32).fill(0).map((_, i) => 
      (i % 16 === 12) ? (Math.random() > 0.3 ? 70 + Math.random() * 35 : 0) : 
      (Math.random() > 0.92 ? 60 + Math.random() * 25 : 0)
    );
    
    // Add crash randomization (very sparse, dramatic moments)
    pattern.crash = Array(32).fill(0).map((_, i) => 
      (i === 0 || i === 16) ? (Math.random() > 0.7 ? 90 + Math.random() * 30 : 0) : 
      (Math.random() > 0.95 ? 80 + Math.random() * 25 : 0)
    );
    
    // Randomize melody with pentatonic-style patterns (more 8-bit)
    pattern.bass = Array(32).fill().map((_, i) => 
      (i % 4 === 0) ? {
        note: scale[Math.floor(Math.random() * 5)], // First 5 notes for more traditional sound
        velocity: 70 + Math.random() * 30
      } : Math.random() > 0.8 ? {
        note: scale[Math.floor(Math.random() * 5)],
        velocity: 60 + Math.random() * 30
      } : { note: null, velocity: 70 }
    );
    
    // Add some melody notes for arpeggiator (simpler patterns)
    pattern.lead = Array(32).fill().map((_, i) => 
      Math.random() > 0.75 ? {
        note: scale[Math.floor(Math.random() * 5)],
        velocity: 60 + Math.random() * 40
      } : { note: null, velocity: 70 }
    );
    
    updateSequencerDisplay();
  });

  // Beat Dynamics presets (was velocity)
  document.querySelectorAll('.velocity-preset').forEach(button => {
    button.addEventListener('click', () => {
      const preset = button.dataset.preset;
      applyVelocityPreset(preset);
    });
  });
});

// Mute/Solo buttons and keyboard shortcuts (these work on document level)
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('mute-btn')) {
    const track = e.target.dataset.track;
    toggleMute(track);
  } else if (e.target.classList.contains('solo-btn')) {
    const track = e.target.dataset.track;
    toggleSolo(track);
  }
});

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
