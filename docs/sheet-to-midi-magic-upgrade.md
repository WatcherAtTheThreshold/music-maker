# Sheet to Midi

## Upgrade Overview


    \#\# What changes musically when you go from 4 → 8 measures?
<br>
    This is subtle but important:
    * **4 bars** = idea, motif, loop-friendly
    * **8 bars** = phrase, sentence, breath

    When you double the length, you unlock:
    * Call & response
    * Question → answer phrasing
    * Tension → release *inside the generator itself*, not only later in Ableton

    Right now, your Magic button is probably still *thinking in 4-bar logic* even if the canvas is longer.
    So the key question becomes:

    > **How do I stop the generator from filling space, and instead make time meaningful?**

    ***

    \#\# High\-impact ways to make things more interesting \(without losing simplicity\)
<br>
    \#\#\# 1\. Phrase\-aware generation \(biggest win\)
<br>
    Instead of treating 8 bars as “4 bars × 2”, give them **roles**:
    Example mental model:
    * Bars 1–2 → establish motif
    * Bars 3–4 → repeat with variation
    * Bars 5–6 → contrast or shift
    * Bars 7–8 → resolve or thin out

    Even a *tiny* rule helps:
    * Change rhythm density after bar 4
    * Transpose melody up/down after midpoint
    * Drop bass notes on bar 8

    This alone makes the output feel *intentional* instead of random.

    ***

    \#\#\# 2\. Staggered staff behavior \(this fits your 3\-staff setup beautifully\)
<br>
    Right now, Magic probably fills **all three staves uniformly**.
    Try asymmetry:
    * **Melody staff**
        * More notes early
        * Leaves space late (rests are powerful)
    * **Right hand**
        * Starts sparse
        * Becomes more rhythmic or harmonic in bars 5–8
    * **Left hand**
        * Anchors bars 1–4
        * Switches pattern or octave in bars 5–8

    This makes the MIDI feel *arranged* before it ever hits Ableton.

    ***

    \#\#\# 3\. Rhythm before pitch \(especially for the Magic button\)
<br>
    A really strong trick:
    1. Generate **rhythm patterns first**
    2. Then assign pitch *after*

    Examples:
    * Melody uses: syncopation + longer notes
    * Right hand uses: steady quarters or eighths
    * Left hand uses: whole / half note foundations

    Even if the pitches are simple, rhythmic identity = musical personality.

    ***

    \#\#\# 4\. Built\-in variation rules \(tiny randomness\, big payoff\)
<br>
    Instead of “random notes”, try:
    * 70–80% notes stay within a chosen scale
    * 20–30% are *neighbor tones* or passing notes
    * One staff occasionally skips a bar entirely

    Silence is not failure—it’s contrast.

    ***

    \#\# How this plays *really* well with Ableton Live
<br>
    You’re already doing the right thing by:
    * Letting the tool *sketch*
    * Letting Ableton *shape*

    A few workflow upgrades:
    * Treat each staff as:
        * Melody → lead / vocal synth
        * Right hand → chord stack / arps
        * Left hand → bass + sidechain anchor
    * Duplicate the 8-bar MIDI in Ableton and:
        * Mute bars 7–8 once
        * Invert bars 5–6 once
        * Slice rhythmically once

    Because your generator is **structurally clean**, Ableton becomes a playground instead of a repair shop.

    ***

    \#\# One small UI idea \
<br>
    Add a Magic variant toggle:
    * ✨ **Loop** (tight, repetitive)
    * ✨ **Phrase** (8-bar intentional)
    * ✨ **Drift** (sparser, asymmetrical)

    Same engine, different *attitude*.

    ***

    \#\# Key Shift — DAW Compatibility (implemented Mar 2026)
<br>
    A **Key Shift** selector (−6 to +6 semitones) was added to the Controls panel. It applies at Magic generation time via four utility functions in `script.js`:

    * `getKeyOffset()` — reads the `#keyShift` select
    * `transposeArr(arr, n)` — shifts a flat MIDI note array
    * `transposeChords(sections, n)` — shifts a `{ section: [[midi...]] }` chord map
    * `transposeRoots(sections, n)` — shifts a `{ section: [midi...] }` roots map

    Every mode's scale, chord, and bass root arrays are wrapped with these at generation time (not stored). The module-level scale constants (`DORIAN_MELODY`, `LOFI_MELODY`, `ADVENTURE_SCALE`, `BOSS_SCALE`, `VICTORY_SCALE`) were converted to function-local transposed values.

    **Native roots per mode** (shown in the Magic Mode dropdown):

    | Mode | Native root | Shift to reach C |
    |------|------------|-----------------|
    | Phrase / Loop / Drift | C major | 0 |
    | Victory | C major | 0 |
    | Lo-fi | C jazz/blues | 0 |
    | Fantasy | D Dorian | −2 |
    | Mystic | D Dorian | −2 |
    | Boss Battle | D Phrygian | −2 |
    | Adventure | E minor | −4 |

    To stack multiple mode exports vertically in a DAW, apply the offset that brings each mode's native root to the same target key before generating. Exports are fully compatible in a DAW at beat 1 as long as offsets match.

    ***

    \#\# Big picture \(and this feels very on\-brand for you\)
<br>
    You’re not building a composer.
    You’re building a **musical thinking partner**.
    The moment your Magic button understands:
    * time
    * contrast
    * restraint

    …it stops being random and starts being *suggestive*—which is exactly how you like to work.
    If you want, next we can:
    * Sketch a phrase-aware Magic algorithm in plain JS
    * Or design a “constraint panel” that stays simple but deep