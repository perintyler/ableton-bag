# Synth & Keys Mixing

## Frequency Anatomy

Understanding where synth elements live in the frequency spectrum:

| Band | Range | Character |
|------|-------|-----------|
| **Sub Synth** | 30-80 Hz | Pure sines, sub bass layers. Felt more than heard. |
| **Synth Bass** | 60-300 Hz | Saw/square bass fundamentals. Weight and power. |
| **Pad Body** | 200-800 Hz | Warmth and fullness. The harmonic core of pads. |
| **Stab Body** | 300 Hz - 1 kHz | Chord character and identity. Where stabs live. |
| **Presence/Definition** | 1-4 kHz | Cut-through. Makes synths audible in a busy mix. |
| **Brilliance** | 4-10 kHz | Sparkle and shimmer. High harmonic content. |
| **Air** | 10-16 kHz | Airy pad textures. Subtle openness and breath. |

## EQ for Synths

### High-Pass Filter by Role

Not every synth needs full-range content. Set the HPF based on the synth's job in the arrangement:

| Synth Role | HPF Frequency | Reasoning |
|------------|---------------|-----------|
| **Sub Bass** | 30 Hz | Only remove DC offset and subsonic rumble. |
| **Bass Synth** | 40 Hz | Keep the sub content but remove garbage below. |
| **Pads / Stabs** | 100-200 Hz | Clear out low end that belongs to bass and kick. |
| **Leads** | 200-400 Hz | Leads don't need low-frequency weight. |

### EQ Moves

1. **Cut 200-500 Hz** (2-4 dB, wide Q) -- Reduce mud on dense synth patches. This region stacks up fast when multiple synths play simultaneously.
2. **Boost 1-3 kHz** (2-3 dB, wide Q) -- Add definition so synths cut through the mix without turning up the fader.
3. **Use shelves, not bells, for broad tonal shaping** -- A high shelf to add shimmer or a low shelf to reduce weight sounds more natural than narrow boosts.
4. **Notch out resonant frequencies from filter sweeps** -- Synth filters that sweep through a range often create harsh resonant peaks. Find them with a narrow boost sweep, then cut with a tight Q.
5. **M/S EQ** -- Mono the low end (below 150 Hz) to keep it focused and phase-coherent. Widen the highs (above 3-4 kHz) with a stereo shelf boost for spread.

## Compression

### Pads
- **Ratio:** 2:1
- **Attack:** Slow, 30-50 ms
- **Release:** Slow, 200-500 ms
- **Gain Reduction:** 1-2 dB
- **Goal:** Gentle leveling for consistency. Pads should feel even and sustained without obvious pumping.

### Stabs / Plucks
- **Ratio:** 4:1 to 6:1
- **Attack:** Fast, 0.5-5 ms -- catches the transient to control the sharp initial hit.
- **Release:** Medium, 50-150 ms
- **Gain Reduction:** 4-8 dB
- **Goal:** Tame aggressive transients and keep stabs at a consistent level in the mix.

### Leads
- **Ratio:** 3:1 to 4:1
- **Attack:** Medium, 10-20 ms -- preserve expression and note articulation.
- **Release:** Medium, 100-200 ms
- **Gain Reduction:** 2-4 dB
- **Goal:** Even out melodic dynamics while keeping the lead expressive and alive.

### Arps / Sequences
- **Sidechain to kick** for rhythmic pumping. Fast attack, fast release, 3-6 dB ducking.
- Creates space for the kick while adding rhythmic movement to the arp pattern.
- Synced release to tempo for a musical pumping effect.

## Sound Design for 80s Synths (Smooth Criminal Era)

### The Hardware

The late-80s synth palette was defined by specific machines:

| Instrument | Character | Modern Equivalent |
|------------|-----------|-------------------|
| **LinnDrum** | Tight, punchy drum machine | Ableton Drum Rack with sampled LinnDrum kits |
| **Synclavier** | Digital FM synthesis, metallic and bright | Ableton Operator (FM synthesis) |
| **Fairlight CMI** | Early sampling, gritty digital textures | Ableton Simpler/Sampler with lo-fi processing |

### Ableton Equivalents

- **Analog** -- Vintage poly synth emulation. 2 oscillators, classic subtractive synthesis with LP filter and amp envelope. Best for warm pads and classic stabs.
- **Operator** -- FM synthesis for metallic, bell-like, and complex tones. 4 operators with configurable algorithms. The go-to for FM bass and digital textures.
- **Wavetable** -- Complex, modern textures with macro controls. Wavetable scanning for evolving sounds. Good for layered, cinematic synth parts.

### The "Stab" Sound

The characteristic 80s synth stab:

1. **Oscillator:** Filtered saw or square wave (or layered).
2. **Attack:** Short, 0-5 ms -- immediate onset.
3. **Decay:** Fast, 100-300 ms -- the note cuts off quickly.
4. **Sustain:** Low, 0-20% -- stabs don't sustain.
5. **Filter:** Low-pass filter with envelope. Filter opens on attack, closes quickly.
6. **Voicing:** Minor chords, often in inversions. Velocity-sensitive for dynamic expression.

### Key Effects for the Era

- **Chorus:** Adds width and analog movement. Essential for making digital synths feel warm.
- **Short reverb:** Plate or room, 0.5-1.5s decay. Adds space without washing out the mix.
- **Subtle delay:** Stereo slapback or short tempo-synced delay for depth.
- **Gated reverb:** On stabs and drums. Big reverb into a noise gate for that signature 80s tail.

## Spatial Effects

### Chorus
- **Rate:** 0.5-2 Hz -- slow modulation for subtle movement.
- **Depth:** 20-40% -- enough to widen without obvious pitch wobble.
- **Use:** Pads and stabs for width. Mono-compatible if using a quality chorus that doesn't cancel in mono.
- **Tip:** Run chorus on a send/return so you can blend the wet amount and EQ the chorus separately.

### Reverb

| Synth Type | Reverb Style | Decay Time | Notes |
|------------|-------------|------------|-------|
| **Stabs** | Short plate | 0.5-1.5s | Tight and controlled. Don't wash out the transient. |
| **Pads** | Longer hall | 2-4s | Bigger space suits sustained sounds. |
| **Leads** | Medium plate/room | 1-2s | Enough depth without losing definition. |

- Pre-delay of 20-50 ms keeps the dry signal clear before the reverb tail begins.
- HPF the reverb return at 200-300 Hz to prevent low-end mud buildup.
- LPF the reverb return at 6-8 kHz to keep reverb tails warm and behind the dry signal.

### Delay
- **Stereo ping-pong:** Creates width by bouncing delay taps left and right.
- **Sync:** Tempo-synced to 1/8 note or dotted 1/8 note for rhythmic interest.
- **Feedback:** 20-40% for a few repeats that fade naturally.
- **Filter the delay return:** Roll off highs and lows so delays sit behind the dry signal.

### Stereo Widening
- **Haas effect:** Duplicate the signal and delay one side by 5-20 ms. Creates a wide stereo image.
- **Caution:** Check mono compatibility -- Haas effect can cause phase cancellation when summed to mono. Use a correlation meter.
- **Safer alternative:** M/S processing to boost side content above 3-4 kHz, or a quality stereo widener plugin.

## Reference: Smooth Criminal "Other" Stem

Spectral analysis of the synth/keys stem from Smooth Criminal provides a mixing target:

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Spectral Centroid** | 3501 Hz | Mid-range focused. Not bright, not boomy. |
| **Low-Mid (500 Hz - 2 kHz)** | 47% of energy | Dominant range -- the chord stab body lives here. |
| **Bass (100-500 Hz)** | 36% of energy | Substantial low-mid warmth and foundation. |
| **Mid (2-4 kHz)** | 12% of energy | Moderate presence. Enough to cut through. |
| **Peak Frequencies** | 400-540 Hz | Characteristic chord stab range. The identity of the part. |
| **Spectral Flatness** | 0.026 | Very tonal, almost no noise content. Clean synthesis. |
| **Above 4 kHz** | Almost none | Very dark overall. No sizzle or air to speak of. |

### What This Tells Us

- The synth parts are **dark and warm** -- roll off highs aggressively if aiming for this aesthetic.
- Energy is concentrated in the **400-2000 Hz** range -- this is where the musical content lives.
- The low end is present but not dominant -- bass duties are handled by the bass stem, not the synths.
- Medium attack, short decay -- tight, controlled stab envelope. No sustain wash.

## Ableton Live Synth Tools

| Tool | Use Case |
|------|----------|
| **Analog** | 2 oscillators, LP filter, amp envelope for stabs. Classic subtractive synthesis. |
| **Operator** | FM synthesis for metallic and bell-like tones. 4 operators, multiple algorithms. |
| **Wavetable** | Modern complex textures with macro controls. Wavetable position scanning for movement. |
| **Instrument Rack** | Layer multiple synths: sub (sine) + body (saw) + character (noise/FM). Map macro controls for unified tweaking. |
| **Chorus-Ensemble** | Built-in chorus effect for width and warmth. |
| **Hybrid Reverb** | Convolution + algorithmic. Good for realistic spaces on pads. |
| **Echo** | Stereo delay with filtering and modulation. Ping-pong mode for width. |
| **Utility** | Bass mono, stereo width, gain staging, polarity flip. Essential on every synth channel. |

### Instrument Rack Layering Strategy

For full-range synth sounds, layer inside an Instrument Rack:

| Layer | Content | Frequency Focus | Processing |
|-------|---------|----------------|------------|
| **Sub** | Pure sine oscillator | 30-80 Hz | Mono. Minimal processing. Clean and heavy. |
| **Body** | Saw/square with LP filter | 80 Hz - 2 kHz | Saturation for warmth. EQ for character. |
| **Character** | FM, wavetable, or noise | 2 kHz+ | Chorus for width. Reverb for space. Short envelope. |

Use the Rack's chain selector or velocity zones to control which layers sound in different contexts.
