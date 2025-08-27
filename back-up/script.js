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
let patternLength = 16;
let currentKey = 'C';
let swingAmount = 0;

// Track definitions
const drumTracks = ['kick', 'snare', 'hihat', 'openhat', 'clap', 'crash'];
const melodyTracks = ['lead', 'pad', 'bass'];
const allTracks = [...drumTracks, ...melodyTracks];

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
let loop;

// Note selection state
let selectedTrack = null;
let isEditingVelocity = false;

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

  // Chain effects
  const effectsChain = Tone.Destination;
  Object.values(synths).forEach(synth => {
    synth.chain(effects.filter, effects.distortion, effects.delay, effects.reverb, effectsChain);
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
    
    // Trigger drum sounds
    drumTracks.forEach(track => {
      const velocity = pattern[track][currentStep];
      if (velocity > 0) {
        const normalizedVelocity = velocity / 127;
        
        if (track === 'kick') {
          synths[track].triggerAttackRelease('C1', '8n', actualTime, normalizedVelocity);
        } else if (track === 'bass') {
          // Bass is melodic, handled below
        } else {
          synths[track].triggerAttackRelease('8n', actualTime, normalizedVelocity);
        }
      }
    });

    // Trigger melodic sounds
    melodyTracks.forEach(track => {
      const stepData = pattern[track][currentStep];
      if (stepData && stepData.note) {
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

  isInitialized = true;
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
}

// Event Listeners
document.getElementById('playButton').addEventListener('click', async () => {
  await initializeAudio();
  
  const button = document.getElementById('playButton');
  
  if (!isPlaying) {
    loop.start(0);
    Tone.Transport.start();
    button.textContent = '⏸';
    button.classList.add('playing');
    isPlaying = true;
  } else {
    loop.stop();
    Tone.Transport.stop();
    button.textContent = '▶';
    button.classList.remove('playing');
    isPlaying = false;
    currentStep = 0;
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

// Master volume
const masterVolume = document.getElementById('masterVolume');
const masterVolumeValue = document.getElementById('masterVolumeValue');

masterVolume.addEventListener('input', (e) => {
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

// Randomize pattern
document.getElementById('randomizePattern').addEventListener('click', () => {
  const pattern = patterns[currentPattern];
  const scale = scales[currentKey];
  
  // Randomize drums with musical probability
  pattern.kick = Array(32).fill(0).map((_, i) => 
    (i % 4 === 0) ? (Math.random() > 0.3 ? 70 + Math.random() * 30 : 0) : 
    (Math.random() > 0.8 ? 50 + Math.random() * 30 : 0)
  );
  
  pattern.snare = Array(32).fill(0).map((_, i) => 
    (i % 8 === 4) ? (Math.random() > 0.2 ? 70 + Math.random() * 30 : 0) : 
    (Math.random() > 0.9 ? 40 + Math.random() * 30 : 0)
  );
  
  pattern.hihat = Array(32).fill(0).map(() => 
    Math.random() > 0.4 ? 40 + Math.random() * 40 : 0
  );
  
  // Randomize melody with scale notes
  pattern.bass = Array(32).fill().map(() => 
    Math.random() > 0.7 ? {
      note: scale[Math.floor(Math.random() * scale.length)],
      velocity: 60 + Math.random() * 40
    } : { note: null, velocity: 70 }
  );
  
  updateSequencerDisplay();
});

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

// Initialize everything
initializeSequencers();