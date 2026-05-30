(function () {
  'use strict';

  // ── GM Data ────────────────────────────────────────────────────────────

  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  const GM_INSTRUMENTS = [
    'Acoustic Grand Piano','Bright Acoustic Piano','Electric Grand Piano','Honky-tonk Piano',
    'Electric Piano 1','Electric Piano 2','Harpsichord','Clavinet',
    'Celesta','Glockenspiel','Music Box','Vibraphone',
    'Marimba','Xylophone','Tubular Bells','Dulcimer',
    'Drawbar Organ','Percussive Organ','Rock Organ','Church Organ',
    'Reed Organ','Accordion','Harmonica','Tango Accordion',
    'Nylon Guitar','Steel Guitar','Jazz Guitar','Clean Guitar',
    'Muted Guitar','Overdriven Guitar','Distortion Guitar','Guitar Harmonics',
    'Acoustic Bass','Finger Bass','Pick Bass','Fretless Bass',
    'Slap Bass 1','Slap Bass 2','Synth Bass 1','Synth Bass 2',
    'Violin','Viola','Cello','Contrabass',
    'Tremolo Strings','Pizzicato Strings','Orchestral Harp','Timpani',
    'String Ensemble 1','String Ensemble 2','Synth Strings 1','Synth Strings 2',
    'Choir Aahs','Voice Oohs','Synth Voice','Orchestra Hit',
    'Trumpet','Trombone','Tuba','Muted Trumpet',
    'French Horn','Brass Section','Synth Brass 1','Synth Brass 2',
    'Soprano Sax','Alto Sax','Tenor Sax','Baritone Sax',
    'Oboe','English Horn','Bassoon','Clarinet',
    'Piccolo','Flute','Recorder','Pan Flute',
    'Blown Bottle','Shakuhachi','Whistle','Ocarina',
    'Square Lead','Sawtooth Lead','Calliope Lead','Chiff Lead',
    'Charang Lead','Voice Lead','Fifths Lead','Bass+Lead',
    'New Age Pad','Warm Pad','Polysynth Pad','Choir Pad',
    'Bowed Pad','Metallic Pad','Halo Pad','Sweep Pad',
    'Rain FX','Soundtrack FX','Crystal FX','Atmosphere FX',
    'Brightness FX','Goblins FX','Echoes FX','Sci-fi FX',
    'Sitar','Banjo','Shamisen','Koto',
    'Kalimba','Bagpipe','Fiddle','Shanai',
    'Tinkle Bell','Agogo','Steel Drums','Woodblock',
    'Taiko Drum','Melodic Tom','Synth Drum','Reverse Cymbal',
    'Guitar Fret Noise','Breath Noise','Seashore','Bird Tweet',
    'Telephone Ring','Helicopter','Applause','Gunshot'
  ];

  const GM_DRUMS = {
    35:'Acoustic Bass Drum', 36:'Bass Drum 1',    37:'Side Stick',
    38:'Acoustic Snare',     39:'Hand Clap',       40:'Electric Snare',
    41:'Low Floor Tom',      42:'Closed Hi-Hat',   43:'High Floor Tom',
    44:'Pedal Hi-Hat',       45:'Low Tom',         46:'Open Hi-Hat',
    47:'Low-Mid Tom',        48:'Hi-Mid Tom',       49:'Crash Cymbal 1',
    50:'High Tom',           51:'Ride Cymbal 1',   52:'Chinese Cymbal',
    53:'Ride Bell',          54:'Tambourine',       55:'Splash Cymbal',
    56:'Cowbell',            57:'Crash Cymbal 2',  58:'Vibraslap',
    59:'Ride Cymbal 2',      60:'Hi Bongo',         61:'Low Bongo',
    62:'Mute Hi Conga',      63:'Open Hi Conga',   64:'Low Conga',
    65:'High Timbale',       66:'Low Timbale',      67:'High Agogo',
    68:'Low Agogo',          69:'Cabasa',           70:'Maracas',
    71:'Short Whistle',      72:'Long Whistle',     73:'Short Guiro',
    74:'Long Guiro',         75:'Claves',           76:'Hi Wood Block',
    77:'Low Wood Block',     78:'Mute Cuica',       79:'Open Cuica',
    80:'Mute Triangle',      81:'Open Triangle'
  };

  // ── DOM refs ────────────────────────────────────────────────────────────
  const dropZone           = document.getElementById('dropZone');
  const fileInput          = document.getElementById('fileInput');
  const fileInfo           = document.getElementById('fileInfo');
  const fileNameEl         = document.getElementById('fileName');
  const clearBtn           = document.getElementById('clearBtn');
  const summaryPlaceholder = document.getElementById('summaryPlaceholder');
  const summaryOutput      = document.getElementById('summaryOutput');
  const jsonPlaceholder    = document.getElementById('jsonPlaceholder');
  const jsonOutput         = document.getElementById('jsonOutput');
  const copySummary        = document.getElementById('copySummary');
  const copyJson           = document.getElementById('copyJson');
  const downloadJson       = document.getElementById('downloadJson');

  // ── Drop zone ───────────────────────────────────────────────────────────
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && isMidi(file.name)) loadFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadFile(file);
  });

  // ── Controls ────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', resetState);
  copySummary.addEventListener('click', () => copyText(summaryOutput.textContent));
  copyJson.addEventListener('click',    () => copyText(jsonOutput.textContent));

  downloadJson.addEventListener('click', () => {
    const blob = new Blob([jsonOutput.textContent], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = (fileNameEl.textContent || 'midi').replace(/\.midi?$/i, '') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── File loading ────────────────────────────────────────────────────────
  function loadFile(file) {
    fileNameEl.textContent = file.name;
    fileInfo.hidden = false;
    dropZone.classList.add('has-file');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const midi = parseMidiBuffer(e.target.result);
        renderOutput(midi, file.name);
      } catch (err) {
        showError(err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  function renderOutput(midi, filename) {
    showSummary(buildMusicalSummary(midi, filename));
    showJson(JSON.stringify(buildMusicalJson(midi, filename), null, 2));
  }

  // ── Musical Summary (readable text) ─────────────────────────────────────
  function buildMusicalSummary(midi, filename) {
    const ts  = midi.timeSigs[0] ?? { numerator: 4, denominator: 4 };
    const bpm = midi.tempos[0]?.bpm ?? 120;
    const ks  = midi.keySigs[0] ?? null;
    const { totalBars, ticksPerBar } = calcBars(midi, ts);
    const noteTracks = midi.tracks.filter(t => t.notes.length > 0);

    let s = '';
    s += `File:         ${filename}\n`;
    s += `Format:       MIDI ${midi.format}\n`;
    s += `Tempo:        ${bpm} BPM\n`;
    s += `Time Sig:     ${ts.numerator}/${ts.denominator}\n`;
    if (ks) s += `Key:          ${ks.label}\n`;
    s += `Duration:     ~${totalBars} measures\n`;
    s += `Tracks:       ${noteTracks.length}\n`;

    const MAX_NOTES = 400;

    for (const track of midi.tracks) {
      if (track.notes.length === 0 && !track.name) continue;

      const isDrum = track.channel === 9;
      const ch     = track.channel !== null ? `ch${track.channel + 1}` : '';
      const inst   = isDrum
        ? '[percussion]'
        : (track.program !== null ? (GM_INSTRUMENTS[track.program] ?? `GM#${track.program + 1}`) : '');
      const name   = track.name ? `"${track.name}"` : 'Unnamed';
      const label  = [name, ch, inst].filter(Boolean).join('  ');
      const bar    = '-'.repeat(Math.max(40, Math.min(64, label.length + 4)));

      s += `\n${bar}\n ${label}\n${bar}\n`;

      if (track.notes.length === 0) {
        s += '  (no notes)\n';
        continue;
      }

      const sorted  = [...track.notes].sort((a, b) => a.tick - b.tick || a.midi - b.midi);
      const display = sorted.slice(0, MAX_NOTES);

      for (const n of display) {
        const pos = fmtMeasureBeat(n.tick, midi.tpq, ts).padEnd(9);
        if (isDrum) {
          const drum = (GM_DRUMS[n.midi] ?? `Note ${n.midi}`).padEnd(22);
          s += `  ${pos} ${drum} vel ${n.velocity}\n`;
        } else {
          const note = midiToName(n.midi).padEnd(5);
          const dur  = fmtDuration(n.durationTicks, midi.tpq).padEnd(12);
          s += `  ${pos} ${note} ${dur} vel ${n.velocity}\n`;
        }
      }

      if (sorted.length > MAX_NOTES) {
        s += `  ... and ${sorted.length - MAX_NOTES} more notes (see JSON)\n`;
      }
    }

    return s;
  }

  // ── Musical JSON ─────────────────────────────────────────────────────────
  function buildMusicalJson(midi, filename) {
    const ts  = midi.timeSigs[0] ?? { numerator: 4, denominator: 4 };
    const bpm = midi.tempos[0]?.bpm ?? 120;
    const ks  = midi.keySigs[0] ?? null;
    const { totalBars } = calcBars(midi, ts);

    const out = {
      file:              filename,
      tempo_bpm:         bpm,
      time_signature:    `${ts.numerator}/${ts.denominator}`,
      key:               ks ? ks.label : null,
      duration_measures: totalBars,
      tracks:            []
    };

    for (const track of midi.tracks) {
      if (track.notes.length === 0 && !track.name) continue;

      const isDrum = track.channel === 9;
      const inst   = isDrum
        ? '[percussion]'
        : (track.program !== null ? (GM_INSTRUMENTS[track.program] ?? `GM#${track.program + 1}`) : null);

      const sorted = [...track.notes].sort((a, b) => a.tick - b.tick || a.midi - b.midi);

      const notes = sorted.map(n => {
        const beat = fmtMeasureBeat(n.tick, midi.tpq, ts);
        return isDrum
          ? { drum: GM_DRUMS[n.midi] ?? `Note ${n.midi}`, beat, velocity: n.velocity }
          : { note: midiToName(n.midi), beat, duration_beats: Math.round(n.durationTicks / midi.tpq * 1000) / 1000, velocity: n.velocity };
      });

      out.tracks.push({
        name:       track.name,
        channel:    track.channel !== null ? track.channel + 1 : null,
        instrument: inst,
        note_count: notes.length,
        notes
      });
    }

    return out;
  }

  // ── Musical helpers ──────────────────────────────────────────────────────
  function calcBars(midi, ts) {
    const totalTicks  = Math.max(0, ...midi.tracks.map(t => t.endTick));
    const ticksPerBar = midi.tpq * ts.numerator * (4 / ts.denominator);
    const totalBars   = totalTicks > 0 ? Math.ceil(totalTicks / ticksPerBar) : 0;
    return { totalTicks, ticksPerBar, totalBars };
  }

  function midiToName(midi) {
    return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  }

  function fmtMeasureBeat(tick, tpq, ts) {
    const ticksPerBar = tpq * ts.numerator * (4 / ts.denominator);
    const measure     = Math.floor(tick / ticksPerBar) + 1;
    const beatFrac    = Math.round(((tick % ticksPerBar) / tpq + 1) * 1000) / 1000;
    return `${measure}:${fmtBeatFrac(beatFrac)}`;
  }

  function fmtBeatFrac(frac) {
    if (frac === Math.floor(frac)) return frac.toFixed(1);
    const s = frac.toFixed(2);
    return s.endsWith('0') ? s.slice(0, -1) : s;
  }

  function fmtDuration(ticks, tpq) {
    const beats  = Math.round(ticks / tpq * 1000) / 1000;
    const suffix = beats === 1 ? 'beat' : 'beats';
    if (beats === Math.floor(beats)) return `${beats.toFixed(1)} ${suffix}`;
    const s = beats.toFixed(2);
    return `${s.endsWith('0') ? s.slice(0, -1) : s} ${suffix}`;
  }

  // ── Display helpers ──────────────────────────────────────────────────────
  function showSummary(text) {
    summaryPlaceholder.hidden = true;
    summaryOutput.hidden      = false;
    summaryOutput.textContent = text;
    copySummary.disabled      = false;
  }

  function showJson(text) {
    jsonPlaceholder.hidden = true;
    jsonOutput.hidden      = false;
    jsonOutput.textContent = text;
    copyJson.disabled      = false;
    downloadJson.disabled  = false;
  }

  function showError(msg) {
    summaryPlaceholder.hidden      = false;
    summaryPlaceholder.textContent = `Error: ${msg}`;
    jsonPlaceholder.hidden         = false;
    jsonPlaceholder.textContent    = `Error: ${msg}`;
    summaryOutput.hidden           = true;
    jsonOutput.hidden              = true;
  }

  function resetState() {
    fileInput.value                = '';
    fileInfo.hidden                = true;
    fileNameEl.textContent         = '';
    dropZone.classList.remove('has-file');
    summaryOutput.hidden           = true;
    summaryOutput.textContent      = '';
    jsonOutput.hidden              = true;
    jsonOutput.textContent         = '';
    summaryPlaceholder.hidden      = false;
    summaryPlaceholder.textContent = 'Load a MIDI file to see the musical summary.';
    jsonPlaceholder.hidden         = false;
    jsonPlaceholder.textContent    = 'Load a MIDI file to see the JSON summary.';
    copySummary.disabled           = true;
    copyJson.disabled              = true;
    downloadJson.disabled          = true;
  }

  // ── MIDI Parser ──────────────────────────────────────────────────────────
  function parseMidiBuffer(buffer) {
    const bytes = new Uint8Array(buffer);
    let i = 0;

    const u32 = () => { const v = (bytes[i]<<24|bytes[i+1]<<16|bytes[i+2]<<8|bytes[i+3])>>>0; i+=4; return v; };
    const u16 = () => { const v = bytes[i]<<8|bytes[i+1]; i+=2; return v; };
    const u8  = () => bytes[i++];
    const si8 = () => { const v = bytes[i++]; return v >= 128 ? v - 256 : v; };
    const str = (n) => { const s = String.fromCharCode(...bytes.slice(i, i+n)); i+=n; return s; };
    const vlq = () => {
      let v = 0, b;
      do { b = u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80);
      return v;
    };

    if (str(4) !== 'MThd') throw new Error('Not a MIDI file — missing MThd header');
    u32(); // header length (always 6)
    const format  = u16();
    const ntracks = u16();
    const tpq     = u16();

    const result = { format, tpq, tempos: [], timeSigs: [], keySigs: [], tracks: [] };

    for (let t = 0; t < ntracks; t++) {
      if (str(4) !== 'MTrk') throw new Error(`Track ${t}: missing MTrk chunk`);
      const trkLen = u32();
      const trkEnd = i + trkLen;

      const track   = { name: null, channel: null, program: null, notes: [], endTick: 0 };
      const pending = {};
      let rs   = 0;
      let tick = 0;

      while (i < trkEnd) {
        tick += vlq();
        if (tick > track.endTick) track.endTick = tick;

        const peek = bytes[i];

        if (peek === 0xff) {
          // ── Meta event ──────────────────────────────────────────────
          i++;
          const type = u8();
          const len  = vlq();
          const end  = i + len;

          switch (type) {
            case 0x03: track.name    = str(len); break;  // track name
            case 0x20: track.channel = u8();     break;  // channel prefix
            case 0x51: {                                  // tempo
              const us = (bytes[i]<<16)|(bytes[i+1]<<8)|bytes[i+2];
              result.tempos.push({ tick, bpm: Math.round(60000000 / us * 10) / 10, uspqn: us });
              break;
            }
            case 0x58: {                                  // time signature
              const num = u8();
              const den = 1 << u8();
              u8(); u8(); // clocks-per-click, 32nds-per-quarter (unused)
              result.timeSigs.push({ tick, numerator: num, denominator: den });
              break;
            }
            case 0x59: {                                  // key signature
              const sf = si8();
              const mi = u8();
              result.keySigs.push({ tick, sf, mi, label: keyLabel(sf, mi) });
              break;
            }
          }

          i = end;
          if (type === 0x2f) { i = trkEnd; break; }      // end of track

        } else if (peek === 0xf0 || peek === 0xf7) {
          // ── SysEx ───────────────────────────────────────────────────
          i++;
          i += vlq();
          rs = 0;

        } else {
          // ── Channel event ────────────────────────────────────────────
          if (peek & 0x80) { rs = peek; i++; }
          const type = rs & 0xf0;
          const ch   = rs & 0x0f;
          if (track.channel === null) track.channel = ch;

          switch (type) {
            case 0x80:
            case 0x90: {
              const note = u8();
              const vel  = u8();
              const key  = `${ch}-${note}`;
              if (type === 0x90 && vel > 0) {
                pending[key] = { tick, velocity: vel };
              } else {
                const on = pending[key];
                if (on) {
                  track.notes.push({ midi: note, channel: ch, tick: on.tick, durationTicks: tick - on.tick, velocity: on.velocity });
                  delete pending[key];
                }
              }
              break;
            }
            case 0xc0: track.program = u8();       break; // program change
            case 0xa0: case 0xb0: case 0xe0: i+=2; break; // 2-byte params
            case 0xd0:                       i+=1; break; // 1-byte param
            default: rs = 0;
          }
        }
      }

      i = trkEnd;
      result.tracks.push(track);
    }

    return result;
  }

  // ── Key label ────────────────────────────────────────────────────────────
  function keyLabel(sf, mi) {
    const maj = ['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'];
    const min = ['Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#','G#','D#','A#'];
    return (mi === 0 ? maj[sf + 7] : min[sf + 7]) + (mi === 0 ? ' major' : ' minor');
  }

  // ── Utilities ────────────────────────────────────────────────────────────
  function isMidi(name) { return /\.midi?$/i.test(name); }

  function copyText(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

})();
