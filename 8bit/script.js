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

// MIDI Export Event Listener
document.getElementById('exportMIDI').addEventListener('click', () => {
  exportPatternToMIDI();
});

// Initialize everything
initializeSequencers();
