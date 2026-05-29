# Drum Mixing Reference

## Kick Drum

### Frequency Map

| Range | Frequency | Character |
|-------|-----------|-----------|
| Sub | 30-60 Hz | Sub-bass weight, felt in the chest |
| Punch | 60-100 Hz | Fundamental punch and power |
| Body | 100-250 Hz | Fullness and warmth |
| Mud | 250-600 Hz | Boxiness, cardboard character — usually cut |
| Attack | 2-5 kHz | Beater attack, snap, definition |
| Click | 6-8 kHz | Beater click, high-end definition |

### EQ Settings

| Type | Frequency | Gain | Q / Slope | Purpose |
|------|-----------|------|-----------|---------|
| High-pass filter | 30 Hz | — | 12-18 dB/oct | Remove sub-rumble below the usable range |
| Cut | 250-600 Hz | -3 to -6 dB | Wide (0.5-1.0 Q) | Remove boxiness and mud |
| Boost | 60-100 Hz | +2 to +4 dB | Medium (1.0-1.5 Q) | Add fundamental punch |
| Boost | 2-5 kHz | +2 to +3 dB | Medium (1.0-2.0 Q) | Add beater attack definition |
| Optional boost | 6-8 kHz | +1 to +2 dB | Wide (0.8-1.2 Q) | Add click for extra definition |

### Compression

| Parameter | Value | Notes |
|-----------|-------|-------|
| Ratio | 4:1 | Moderate control without squashing |
| Attack | 10-30 ms | Slow enough to let the transient punch through |
| Release | 80-120 ms | Fast enough to recover before the next hit |
| Threshold | Set for 3-6 dB gain reduction | Enough to control peaks without killing dynamics |
| Knee | Soft | More transparent, musical compression |

**Key principle**: A slower attack preserves the initial transient (the "thump"). If the kick sounds flat and lifeless, the attack is too fast. If it's poking out too much, speed up the attack.

### Saturation

- Apply subtle saturation to add harmonic content in the midrange, helping the kick cut through on small speakers.
- Use a soft sine or analog clip curve.
- Drive: low (10-20%). The goal is warmth and harmonic presence, not distortion.
- Dry/Wet: 30-50% for parallel blending.

### Gating (if needed)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Threshold | Set just above bleed level | Should open only on kick hits |
| Attack | 0.1-0.5 ms | As fast as possible to catch the transient |
| Hold | 50-100 ms | Keeps gate open through the sustain |
| Release | 50-100 ms | Smooth fade to avoid audible cutoff |
| Range | -20 to -40 dB | Attenuate bleed rather than fully silencing |

---

## Snare Drum

### Frequency Map

| Range | Frequency | Character |
|-------|-----------|-----------|
| Body | 150-250 Hz | Fundamental weight and warmth |
| Boxiness | 500-800 Hz | Papery, cardboard character — usually cut |
| Crack / Snap | 2-3.5 kHz | Snare crack, attack, bite |
| Wires | 5-8 kHz | Snare wire rattle and sizzle |
| Air | 8-12 kHz | Openness, shimmer |

### EQ Settings

| Type | Frequency | Gain | Q / Slope | Purpose |
|------|-----------|------|-----------|---------|
| High-pass filter | 70 Hz | — | 12-18 dB/oct | Remove kick bleed and low rumble |
| Boost | 150-250 Hz | +2 to +3 dB | Medium (1.0-1.5 Q) | Add body and fundamental weight |
| Cut | 500-800 Hz | -2 to -4 dB | Medium (1.0-2.0 Q) | Remove boxiness and papery tone |
| Boost | 2-3.5 kHz | +2 to +3 dB | Medium (1.0-2.0 Q) | Add crack and snap |
| Optional boost | 8-12 kHz | +1 to +2 dB | Wide shelf | Add air and openness |

### Compression

| Parameter | Value | Notes |
|-----------|-------|-------|
| Ratio | 4:1 to 6:1 | Higher ratio for more aggressive control |
| Attack | 20-30 ms | Slow attack = more punch and snap. Faster = more control, less transient |
| Release | 150-250 ms | Should recover before the next hit |
| Threshold | Set for 2-5 dB gain reduction | Moderate compression |
| Knee | Medium | Balance between transparency and control |

**Key principle**: Snare compression is all about the attack time. A slow attack (20-30 ms) lets the transient snap through and compresses the body/sustain. A fast attack (1-5 ms) clamps the transient for a more controlled, rounder sound.

### Parallel Compression

Parallel compression (aka New York compression) adds density and sustain without killing transients.

**Setup**: Send snare to a bus with a heavily compressed return.

| Parameter | Value | Notes |
|-----------|-------|-------|
| Ratio | 10:1 or higher | Heavy limiting |
| Attack | 1-5 ms | Fast — grab everything |
| Release | 20-50 ms | Fast — pumping is acceptable on the parallel bus |
| Threshold | Set for 10-15 dB gain reduction | Extreme compression |
| Blend | 20-40% wet | Mix the crushed signal under the dry signal |

The dry signal provides the transient and natural dynamics. The parallel bus provides sustain, body, and density. Together they create a snare that hits hard and sustains without sounding squashed.

### Gating (if needed)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Threshold | Set just above bleed level | Should open only on snare hits |
| Attack | 0.1-0.5 ms | Fast to preserve transient |
| Hold | 80-150 ms | Keep open through snare ring |
| Release | 80-150 ms | Smooth fade |
| Range | -15 to -30 dB | Attenuate, don't fully silence |

---

## Hi-Hats and Cymbals

### Frequency Map

| Range | Frequency | Character |
|-------|-----------|-----------|
| Mud | 200-600 Hz | Low-end buildup from bleed — cut aggressively |
| Body | 3-6 kHz | Fundamental character and tone |
| Shimmer | 6-10 kHz | Brightness and shimmer |
| Air | 10-16 kHz | Airy sparkle and openness |
| Fizz | >17 kHz | Unnecessary high-frequency content, often just noise |

### EQ Settings

| Type | Frequency | Gain | Q / Slope | Purpose |
|------|-----------|------|-----------|---------|
| High-pass filter | 300-500 Hz | — | 18-24 dB/oct | Aggressively remove all low-end bleed |
| Cut | 300-600 Hz | -3 to -6 dB | Wide (0.5-1.0 Q) | Additional mud removal if HPF isn't enough |
| High shelf boost | 8 kHz | +2 dB | Shelf | Add shimmer and air |
| Low-pass filter | 17 kHz | — | 12 dB/oct | Remove unnecessary ultra-high fizz |

### Compression

| Parameter | Value | Notes |
|-----------|-------|-------|
| Ratio | 2:1 | Gentle — cymbals should breathe |
| Attack | 10-20 ms | Let the stick attack through |
| Release | 100-200 ms | Match the natural decay |
| Threshold | Set for 2-3 dB gain reduction | Light touch only |

**Key principle**: Over-compressing hi-hats and cymbals brings up bleed and makes them sound harsh and unnatural. Less is more.

### De-essing

If cymbals are harsh or sizzly:

- Target frequency: 10-12 kHz
- Use a dynamic EQ or de-esser to tame only the harsh peaks
- Reduction: -2 to -4 dB when triggered
- This is preferable to static EQ cuts because it only reduces harshness on loud hits

### Stereo Considerations

- Overheads and room mics capture the full cymbal picture. Individual hi-hat mics are supplementary.
- Check phase between overhead L/R and any close hi-hat mic.
- Pan hi-hat slightly off-center (drummer's perspective or audience perspective — pick one and be consistent).

---

## Toms

### Frequency Map

| Range | Frequency | Character |
|-------|-----------|-----------|
| Fundamental | 80-200 Hz | Varies by tom size (floor tom lower, rack tom higher) |
| Body | 200-400 Hz | Fullness |
| Boxiness | 400-800 Hz | Cardboard, hollow character — cut |
| Attack | 3-5 kHz | Stick attack, definition |

### EQ Settings

| Type | Frequency | Gain | Q / Slope | Purpose |
|------|-----------|------|-----------|---------|
| High-pass filter | 60-100 Hz | — | 12-18 dB/oct | Remove rumble (higher for rack toms) |
| Cut | 400-800 Hz | -3 to -6 dB | Medium (1.0-2.0 Q) | Remove boxiness |
| Boost | 80-200 Hz | +2 to +3 dB | Medium (1.0-1.5 Q) | Add fundamental weight |
| Boost | 3-5 kHz | +2 to +3 dB | Medium (1.0-2.0 Q) | Add stick attack |

### Compression

| Parameter | Value | Notes |
|-----------|-------|-------|
| Ratio | 4:1 to 6:1 | Moderate to firm |
| Attack | 10-20 ms | Let transient through |
| Release | 100-200 ms | Match tom decay |
| Threshold | Set for 3-6 dB gain reduction | Control without squashing |

### Gating

Toms almost always need gating because they ring sympathetically and pick up a lot of bleed between hits.

| Parameter | Value | Notes |
|-----------|-------|-------|
| Threshold | Set carefully — toms hit hard but infrequently | Test against ghost notes |
| Attack | 0.1-0.5 ms | Fast |
| Hold | 100-200 ms | Let the tom ring naturally |
| Release | 100-200 ms | Smooth fade |
| Range | -20 to -40 dB | Attenuate bleed significantly |

---

## Overheads

### Role in the Mix

Overheads are the foundation of the drum sound. They capture the full kit in stereo. Close mics (kick, snare, toms) supplement the overheads, not the other way around.

### EQ Settings

| Type | Frequency | Gain | Q / Slope | Purpose |
|------|-----------|------|-----------|---------|
| High-pass filter | 80-200 Hz | — | 12-18 dB/oct | Remove low-end rumble (higher if kick has its own mic) |
| Cut | 300-600 Hz | -1 to -3 dB | Wide | Reduce room mud |
| High shelf boost | 8-12 kHz | +1 to +3 dB | Shelf | Add air and sparkle |

### Compression

| Parameter | Value | Notes |
|-----------|-------|-------|
| Ratio | 2:1 to 3:1 | Gentle — preserve natural dynamics |
| Attack | 15-30 ms | Let transients through |
| Release | 100-200 ms | Musical release |
| Threshold | Set for 2-4 dB gain reduction | Light compression |

---

## Drum Bus Processing

The drum bus processes all drum tracks together to create a cohesive, unified drum sound.

### Glue Compression

| Parameter | Value | Notes |
|-----------|-------|-------|
| Ratio | 2:1 to 4:1 | Gentle glue, not heavy squashing |
| Attack | 30 ms | Slow — let the transients of the full kit punch through |
| Release | 100 ms (or Auto) | Fast enough to breathe, auto-release adapts to material |
| Threshold | Set for 1-3 dB gain reduction | Subtle — you should barely hear it compressing |
| Knee | Soft | More transparent |

**Key principle**: Drum bus compression should make the kit sound like one instrument. If you can obviously hear it compressing, it's too much. The needle should barely move.

### Parallel (New York) Compression

Set up on a send/return, not inline.

| Parameter | Value | Notes |
|-----------|-------|-------|
| Ratio | 10:1 or higher | Extreme compression |
| Attack | 0.1-1 ms | Fast — clamp everything |
| Release | 20-50 ms | Fast — let it pump |
| Threshold | Set for 6-12 dB gain reduction | Heavy |
| Send level | Blend to taste | Start low, bring up until you feel the density and sustain increase |

The parallel bus adds weight, sustain, and aggression underneath the natural drum bus. It should be felt more than heard — if you notice it when you mute it, you've got it right.

### Saturation

| Parameter | Value | Notes |
|-----------|-------|-------|
| Type | Tape or analog clip | Warm, musical harmonics |
| Drive | Low (1-3 on a 0-10 scale) | Subtle harmonic enhancement |
| Mix / Dry-Wet | 20-30% | Blend gently |
| Output | Compensate for any gain increase | Match levels |

Saturation on the drum bus adds warmth, cohesion, and helps drums translate on small speakers by generating upper harmonics of low-frequency content.

### Final Bus EQ

| Type | Frequency | Gain | Q | Purpose |
|------|-----------|------|---|---------|
| High-pass | 30 Hz | — | 18 dB/oct | Remove sub-rumble |
| Broad cut | 300-500 Hz | -1 to -2 dB | Wide (0.5-0.8 Q) | Clean up cumulative mud |
| Broad boost | 3-5 kHz | +1 to +2 dB | Wide (0.5-0.8 Q) | Add overall attack presence |
| High shelf | 10 kHz | +1 dB | Shelf | Add air |

**Key principle**: Bus EQ should be broad, gentle strokes. If you need surgical cuts, go back to the individual track. The bus EQ is for overall tonal shaping.

---

## Processing Order Summary

For each individual drum track:

```
Gate (if needed) → HPF → Subtractive EQ → Compressor → Tonal EQ → Saturation (optional)
```

For the drum bus:

```
Bus EQ (gentle) → Glue Compressor → Saturation (subtle) → Final EQ (broad strokes)
  + Parallel compression on send/return
```
