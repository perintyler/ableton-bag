# Bass Mixing & Sound Design

## Bass Frequency Anatomy

Understanding the frequency bands of bass is essential for surgical mixing:

| Band | Range | Character |
|------|-------|-----------|
| **Sub** | 30-60 Hz | Felt more than heard. Physical weight and rumble. |
| **Fundamental** | 60-150 Hz | The "note" of the bass. Core pitch and power. |
| **Body** | 150-400 Hz | Warmth and fullness. Can become muddy if unchecked. |
| **Growl** | 400 Hz - 1 kHz | Midrange aggression, distortion character, finger noise. |
| **Presence** | 1-3 kHz | Definition, articulation, string attack. Helps bass cut through a mix. |

## EQ by Bass Type

### Synth Bass
- Often dominates sub and fundamental regions (30-150 Hz).
- May need cuts in 150-400 Hz to avoid masking other elements.
- Boost 1-3 kHz if the bass needs to translate on small speakers.
- Watch for excessive sub content below 30 Hz -- HPF to remove it.

### Electric Bass
- Fundamental sits around 60-250 Hz depending on tuning.
- Finger noise and fret buzz live around 1-3 kHz.
- Boost 700 Hz - 1 kHz for growl and pick attack.
- Cut 200-400 Hz to reduce boxiness from DI recordings.

### Upright / Acoustic Bass
- Rich harmonic content above 200 Hz gives it its woody character.
- Boost 80-120 Hz for body, but be careful of room resonance.
- Boost 2-4 kHz for bow or pluck articulation.
- Often needs less sub-bass emphasis than synth or electric.

## Bass EQ Settings

1. **HPF at 30 Hz** -- Remove DC offset, subsonic rumble, and wasted headroom. Roll off steeply (24 dB/oct).
2. **Cut 200-400 Hz** (2-4 dB) -- Reduce mud and boxiness. This is the most congested area in most mixes.
3. **Boost 60-100 Hz** (2-4 dB, wide Q) -- Add weight and foundation.
4. **Boost 800 Hz - 1.5 kHz** (2-3 dB, narrow Q) -- Add definition so the bass line is audible on small speakers and laptops.

## Bass Compression

### Standard Compression
- **Ratio:** 4:1 to 8:1
- **Attack:** Slow, 20-40 ms -- lets the initial transient (pluck, pick, note onset) through for articulation.
- **Release:** Medium, 100-200 ms -- recovers before the next note in most tempos.
- **Gain Reduction:** 4-8 dB -- enough to even out dynamics without squashing.
- **Goal:** Consistent bass level that sits in the pocket without volume jumps.

### Sidechain Compression (Kick Ducking Bass)
- **Trigger:** Kick drum signal as sidechain input.
- **Attack:** Fast, 0.5-5 ms -- duck immediately when the kick hits.
- **Release:** Fast, 50-100 ms -- bass returns quickly after the kick.
- **Ducking Amount:** 3-6 dB -- enough to carve space, not enough to hear obvious pumping (unless that is the desired effect).
- **Use case:** Prevents kick and bass from competing for the same low-frequency energy.

### Multiband Compression for Bass
- Apply compression only to the low band (below 150-200 Hz) to tighten the sub and fundamental without affecting midrange character.
- Use a gentler ratio (2:1 - 4:1) on the low band with a medium attack.
- Leave the mid and high bands uncompressed or lightly compressed to preserve growl and presence.
- This is especially useful on bass recordings with inconsistent low-end note-to-note.

## Saturation & the Perceived Bass Trick

Small speakers (phones, laptops, earbuds) cannot reproduce frequencies below ~80 Hz. Saturation solves this:

1. Apply light saturation or harmonic distortion to the bass (tape saturation, tube emulation, or Ableton's Saturator).
2. This generates upper harmonics (2nd, 3rd, 4th) from the fundamental frequency.
3. The human brain perceives the fundamental pitch even when only the harmonics are present (psychoacoustic phenomenon called the "missing fundamental").
4. Result: bass feels present and full even on small speakers.

**Practical approach:** Duplicate the bass track. HPF the duplicate at 200 Hz. Apply heavy saturation to the duplicate. Blend it in subtly beneath the clean bass. This adds harmonics without muddying the sub.

## Bass Layering

For powerful, full-range bass, layer multiple elements:

| Layer | Content | Frequency Focus | Processing |
|-------|---------|----------------|------------|
| **Sub** | Pure sine wave or simple triangle | 30-80 Hz | Minimal processing. Keep clean. Mono. |
| **Mid** | Saw/square synth or bass guitar | 80-800 Hz | Saturation, EQ for character. |
| **Top** | Pluck, attack transient, or noise | 800 Hz+ | Short envelope. Adds articulation and note definition. |

**Critical:** Check phase alignment between layers. Flip polarity on one layer and listen -- if the bass gets louder when flipped, the layers are partially out of phase. Adjust timing or use a phase alignment plugin.

## Kick and Bass Phase Alignment

- Kick and bass occupy overlapping frequency ranges. Phase cancellation between them causes a weak low end.
- Zoom in on the waveforms. The initial movement of both kick and bass should go in the same direction (both positive or both negative).
- If they oppose each other, flip the polarity of the bass (or kick) and compare.
- Use a dedicated phase alignment tool or nudge the bass track by tiny amounts (sub-millisecond) to find the strongest combined low end.

## Mono Below 150 Hz

- Stereo information below 150 Hz causes phase issues on playback systems and wastes energy.
- Use a utility plugin or mid/side EQ to collapse everything below 150 Hz to mono.
- In Ableton: Utility plugin with "Bass Mono" set to ~150 Hz.
- This improves mix translation across all playback systems (club systems, vinyl, mono speakers).

## Reference: Smooth Criminal Bass Tone

A useful reference for sub-bass-focused production:

- **87% sub-bass** (30-100 Hz) -- almost entirely sub-frequency content.
- **Pure sine-like waveform** with spectral flatness of 0.016 (extremely tonal, almost no noise content).
- **Fast attack, short decay** -- tight, controlled low end that doesn't ring out.
- This kind of bass requires very little EQ -- the sound design does the work. Focus on getting the synth patch right rather than fixing with processing.

## Ableton Live Bass Tools

| Tool | Use Case |
|------|----------|
| **Operator** | FM synthesis bass. Great for sub-bass, plucky basses, and complex timbres through FM modulation. |
| **Analog** | Subtractive synthesis. Classic analog-style bass with filters and envelopes. Good for warm, round bass tones. |
| **Wavetable** | Complex, evolving bass textures. Wavetable scanning creates movement. Good for modern electronic bass. |
| **Saturator** | Add harmonics for small-speaker translation. Try "Soft Sine" curve for subtle warmth. |
| **Multiband Dynamics** | Multiband compression. Solo the low band for targeted bass tightening. |
| **Glue Compressor** | Bus-style compression with sidechain input for kick ducking. |
| **Utility** | Bass mono switch, gain staging, polarity flip for phase checking. |
