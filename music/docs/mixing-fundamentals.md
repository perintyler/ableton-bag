# Mixing Fundamentals

## Signal Flow

The standard mixing signal flow for a channel strip:

```
Source Signal
  |
  v
HPF / LPF (cleanup filtering)
  |
  v
Subtractive EQ (remove problems: mud, resonances, harshness)
  |
  v
Dynamics (compression, gating, expansion)
  |
  v
Tonal EQ (additive shaping: boost presence, warmth, air)
  |
  v
Saturation / Harmonic Enhancement
  |
  v
Spatial Effects (reverb, delay — typically on sends)
  |
  v
Channel Fader
  |
  v
Bus / Group
  |
  v
Master Bus
```

### Why This Order Matters

- **Subtractive EQ before compression**: Removing problem frequencies first prevents the compressor from reacting to energy you don't want. If mud triggers the compressor, it pumps on useless content and ducks the good stuff.
- **Compression before tonal EQ**: Compression can dull transients or shift tonal balance. Placing tonal EQ after lets you restore or shape the tone post-dynamics.
- **Saturation after dynamics**: Saturation responds to level. Feeding it a dynamically controlled signal gives more predictable and musical results.
- **Spatial effects last (on sends)**: Reverb and delay should process the fully shaped signal. Compressing reverb tails or EQ-ing before spatial processing leads to unnatural results.

## Gain Staging

Gain staging is maintaining consistent, healthy signal levels at every point in the processing chain.

### Key Principles

| Concept | Target | Why |
|---------|--------|-----|
| Nominal level | **-18 dBFS** | This is where most plugins model their analog sweet spot (0 VU ~ -18 dBFS) |
| Peak headroom | **-6 dBFS** on individual tracks | Leaves room for transients and summing |
| Master bus headroom | **-3 to -6 dBFS** pre-master | Gives the mastering engineer room to work |
| Unity gain through plugins | Match input/output levels | Ensures you're hearing the processing, not just volume changes |

### Gain Staging Workflow

1. Set raw track levels so peaks hover around -12 to -6 dBFS using clip gain or a utility plugin.
2. After each plugin, check that the output level roughly matches the input level.
3. Use a VU meter plugin to monitor RMS levels — aim for -18 dBFS nominal.
4. If a plugin adds gain, compensate with its output knob or a utility after it.
5. Never let any point in the chain clip (exceed 0 dBFS) — even though modern DAWs use floating-point math internally, clipping at plugin inputs can cause distortion in analog-modeled plugins.

## Frequency Spectrum Reference

| Range | Frequency | Name | What Lives Here | Notes |
|-------|-----------|------|-----------------|-------|
| Sub bass | 20-60 Hz | Sub | Kick sub, bass sub, rumble | Felt more than heard. HPF most tracks below 60-80 Hz |
| Bass | 60-250 Hz | Low end | Kick fundamental, bass fundamental, low synths, floor toms | Where power and warmth live. Mud accumulates here from multiple sources |
| Low mids | 250-500 Hz | Low mids | Body of most instruments, snare body, vocals warmth | Boxiness and mud zone. Most common area for subtractive cuts |
| Midrange | 500 Hz-2 kHz | Mids | Guitar body, vocal fundamental, piano, horns | The "telephone" range. Most musical information is here |
| Upper mids | 2-4 kHz | Presence | Vocal presence, guitar attack, snare crack, pick/pluck transients | Human hearing is most sensitive here. Harshness can build up |
| High mids | 4-8 kHz | Brilliance / Edge | Hi-hat body, cymbal body, vocal sibilance, string bite | Sibilance and harshness zone. De-essing territory |
| Highs | 8-12 kHz | Air / Sparkle | Cymbal shimmer, vocal air, acoustic guitar sparkle | "Air" and openness. High shelf boosts here add sheen |
| Ultra highs | 12-20 kHz | Air / Fizz | Cymbal air, synthesizer sparkle, noise, tape hiss | Diminishing returns above 16 kHz. LPF to remove unnecessary content |

### Common Problem Frequencies

| Problem | Frequency Range | Solution |
|---------|----------------|----------|
| Rumble / DC offset | Below 30 Hz | HPF at 30-40 Hz on everything |
| Boom / mud | 200-400 Hz | Narrow cut, -2 to -4 dB |
| Boxiness | 300-600 Hz | Wide cut, -2 to -3 dB |
| Nasal / honk | 800 Hz-1.5 kHz | Narrow cut, sweep to find it |
| Harshness | 2-4 kHz | Narrow cut or dynamic EQ |
| Sibilance | 5-8 kHz | De-esser or dynamic EQ |
| Fizz / brittle | 8-12 kHz | Gentle shelf cut or LPF |

## The "Cut Before Boost" Principle

### Why Cut First

1. **Cutting is more transparent than boosting.** Removing a problem frequency sounds more natural than trying to boost around it.
2. **Cutting frees up headroom.** Every dB you cut gives you a dB of headroom. Boosting eats headroom and brings you closer to clipping.
3. **Cutting reveals what's already there.** Often, the tone you want is already in the recording — it's just masked by problem frequencies.
4. **Less is more.** A 3 dB cut at 400 Hz can have the same perceptual effect as a 3 dB boost at 3 kHz (more presence), but with less phase distortion and more headroom.

### Practical Approach

1. Start with a high-pass filter to remove everything below the useful range of the instrument.
2. Sweep a narrow, boosted bell (+6-10 dB, narrow Q) across the spectrum to find problem frequencies. When it sounds bad, that's where to cut.
3. Set the cut: narrow Q for surgical removal of resonances, wider Q for tonal shaping.
4. Only then consider gentle boosts where the sound needs enhancement.
5. Keep total boost amounts modest: +2 to +4 dB is usually enough for tonal shaping.

## Critical Listening Practices

### A/B Bypass Testing

- **Always bypass plugins** to compare processed vs. unprocessed. If it doesn't sound clearly better, remove it.
- **Match levels** when bypassing. Louder always sounds "better" due to psychoacoustics (Fletcher-Munson curves). Use a utility or the plugin's output gain to match perceived loudness before comparing.
- **Test each plugin individually** and also the full chain. A plugin might sound good solo'd but cause problems in context.

### Mono Compatibility

- **Check in mono regularly.** Collapse the stereo image to mono to verify:
  - Nothing disappears (phase cancellation from stereo widening, bad mic placement, or stereo effects)
  - The balance still works (panned elements should still be audible)
  - Low end is solid (bass and kick should be mono or near-mono)
- Many listeners hear music in mono: phone speakers, single Bluetooth speakers, club systems.

### Reference Tracks

- Import 2-3 professionally mixed reference tracks in the same genre into your session.
- Level-match them to your mix (references are mastered and louder — turn them down).
- Compare frequently: tonal balance, dynamic range, width, vocal level, low-end weight.
- Use a spectrum analyzer to visually compare frequency distribution.

### Listening Environment

- Take breaks every 30-45 minutes to avoid ear fatigue.
- Check on multiple playback systems: monitors, headphones, earbuds, car, phone speaker.
- Listen at low volume — if the mix sounds good quiet, it will sound great loud (Fletcher-Munson).
- The most important elements (vocal, kick, snare, bass) should be clear at any volume.

## Dynamic Range and Headroom

### Dynamic Range

Dynamic range is the difference between the quietest and loudest parts of the signal.

| Context | Typical Dynamic Range | Notes |
|---------|----------------------|-------|
| Raw recording | 20-40 dB | Unprocessed, wide dynamics |
| Individual track (mixed) | 6-15 dB | After compression |
| Full mix (before master) | 10-18 dB | Genre dependent |
| Mastered track (pop/rock) | 6-10 dB | After limiting |
| Mastered track (classical) | 15-25 dB | Preserves dynamics |

### Headroom

Headroom is the space between the peak level of your signal and 0 dBFS (digital clipping).

- **Track level headroom**: Keep peaks at -6 dBFS or lower. This prevents clipping when multiple tracks sum on a bus.
- **Bus headroom**: Aim for -6 to -3 dBFS peaks on group buses.
- **Master bus headroom**: Leave -3 to -6 dBFS of headroom if the track will be mastered by someone else.
- **Why it matters**: Even in 32-bit float DAWs where internal clipping is recoverable, plugins (especially analog-modeled ones) can distort at their inputs. Maintaining headroom ensures clean processing throughout the chain.

### Crest Factor

The crest factor is the difference between peak and RMS levels. It indicates how "transient-heavy" a signal is.

- **High crest factor** (10+ dB): Very dynamic, lots of transients (raw drums, plucked strings)
- **Low crest factor** (3-6 dB): Heavily compressed, dense (mastered pop, distorted guitar)
- Use crest factor to judge how much compression a signal needs and how much dynamic range remains.
