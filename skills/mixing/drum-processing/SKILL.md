# Complete Drum Processing Guide

## Processing Order

The standard signal chain for processing individual drum elements:

```
Gate → Subtractive EQ → Compression → Tonal EQ → Saturation → Effects
```

1. **Gate**: Remove bleed and noise between hits.
2. **Subtractive EQ**: Cut problem frequencies (mud, boxiness, rumble).
3. **Compression**: Control dynamics, add punch and consistency.
4. **Tonal EQ**: Boost desired frequencies (body, attack, air).
5. **Saturation**: Add harmonics, warmth, and presence.
6. **Effects**: Reverb, delay, or other creative processing (usually on sends).

## Per-Element Processing Chains

### Kick Drum

```
HPF 30Hz → Cut 250-600Hz (Q: 2-4, -3 to -6dB) → Compress 4:1 (attack 10-30ms, release 80-120ms, 3-6dB GR) → Boost 60-100Hz body (+2-4dB, Q: 1-2) → Boost 2-5kHz attack (+2-4dB, Q: 1-2) → Subtle saturation (drive 1-3, wet 20-30%)
```

| Step | Settings | Purpose |
|------|----------|---------|
| HPF | 30Hz, 24dB/oct | Remove sub-rumble |
| Cut mud | 250-600Hz, Q: 2-4, -3 to -6dB | Clean up boxy low-mids |
| Compress | 4:1, attack 10-30ms, release 80-120ms | Control dynamics, preserve attack |
| Boost body | 60-100Hz, Q: 1-2, +2-4dB | Weight and thump |
| Boost attack | 2-5kHz, Q: 1-2, +2-4dB | Beater click, cuts through mix |
| Saturate | Drive 1-3, wet 20-30% | Adds upper harmonics for presence |

**Notes**: Tune the body boost to the fundamental frequency of the kick. Use a spectrum analyzer to identify the fundamental. For 808-style kicks, boost lower (40-60Hz) and use less attack boost.

### Snare Drum

```
HPF 70Hz → Cut 500-800Hz (Q: 2-4, -3 to -5dB) → Compress 4:1 (attack 20-30ms, release 150-250ms, 2-5dB GR) → Boost 150-250Hz body (+2-3dB, Q: 1-2) → Boost 2-3.5kHz snap (+2-4dB, Q: 1-2) → Parallel compression
```

| Step | Settings | Purpose |
|------|----------|---------|
| HPF | 70Hz, 24dB/oct | Remove kick bleed and rumble |
| Cut boxiness | 500-800Hz, Q: 2-4, -3 to -5dB | Remove cardboard tone |
| Compress | 4:1, attack 20-30ms, release 150-250ms | Even out hits, preserve crack |
| Boost body | 150-250Hz, Q: 1-2, +2-3dB | Fatness and weight |
| Boost snap | 2-3.5kHz, Q: 1-2, +2-4dB | Crack and presence |
| Parallel comp | 10:1+, fast attack/release, blend 20-40% | Body and sustain without losing transients |

**Notes**: The snare is often the loudest element in the mix. Parallel compression is essential for snare -- it adds sustain and weight while keeping the initial crack intact. Add a high shelf at 8-12kHz for air and snare wire sizzle.

### Hi-Hats / Cymbals

```
HPF 300Hz → Cut 300-600Hz mud (if needed, -2 to -4dB) → Gentle compress 2:1 (slow attack, medium release, 1-3dB GR) → High shelf 7-10kHz (+2-3dB) → De-ess 10-12kHz → LPF 17kHz
```

| Step | Settings | Purpose |
|------|----------|---------|
| HPF | 300-500Hz, 18-24dB/oct | Remove all low and mid bleed |
| Cut mud | 300-600Hz, Q: 2-3, -2 to -4dB | Additional cleanup if needed |
| Compress | 2:1, attack 30-50ms, release 100-200ms | Gentle dynamic control only |
| High shelf | 7-10kHz, +2-3dB | Shimmer and sparkle |
| De-ess | Narrow cut at 10-12kHz, -2 to -4dB | Tame harsh sibilant frequencies |
| LPF | 17kHz, 12dB/oct | Remove harsh ultra-highs |

**Notes**: Hi-hats need very little processing. Over-compression makes them sound harsh and lifeless. The goal is clarity and sparkle without harshness. If they sound thin, check the HPF -- it may be set too high.

## Drum Bus Processing

The drum bus (group channel containing all drum elements) gets its own processing chain after individual elements are processed.

```
Glue Compressor → Saturator → EQ (final shaping)
```

### Glue Compressor (Bus)

| Parameter | Setting |
|-----------|---------|
| Ratio | 2:1 to 4:1 |
| Attack | 30ms (slow -- let transients through) |
| Release | 0.1-0.4s (fast -- follows groove, adds energy) |
| Gain reduction | 1-3dB |
| Range | -6dB to -3dB (limits max GR for transparency) |
| Makeup | Compensate to match input loudness |

The Glue Compressor's Range control is key: it limits the maximum gain reduction, preventing over-compression on loud hits while still providing consistent glue on normal hits.

### Saturator (Bus)

| Parameter | Setting |
|-----------|---------|
| Drive | 1-2 dB |
| Type | Analog Clip |
| Dry/Wet | 15-25% |

Subtle saturation on the drum bus adds cohesion and helps drums cut through the mix. You should barely notice it is there.

### EQ (Final Bus Shaping)

- Low shelf boost at 80-100Hz (+1-2dB) for overall weight.
- Cut 200-400Hz (-1-2dB) if the drums still sound muddy.
- High shelf boost at 8-12kHz (+1-2dB) for air and presence.
- Keep moves small (1-2dB). Large EQ moves on the bus affect everything.

## Parallel Compression for Drum Bus

### Setup

1. Create a return track labeled "Drum Crush" or "Parallel Drums."
2. Send the drum bus to this return.
3. On the return, add a compressor with these settings:

| Parameter | Setting |
|-----------|---------|
| Ratio | 10:1 or higher |
| Attack | 0.5-3ms (fast) |
| Release | 50-80ms (fast) |
| Gain reduction | 8-12dB (heavy) |
| Makeup gain | Compensate fully |

4. Blend the return at 20-40% of the dry drum bus level.

### Optional: EQ on the Parallel Return

- HPF at 100-150Hz (removes boomy low-end from the crushed signal).
- LPF at 8-10kHz (removes harsh, crushed highs).
- This focuses the parallel compression on the mid-range, adding body and punch without mud or harshness.

## Transient Shaping

Transient shapers control the attack and sustain of a sound independent of level (unlike compressors).

| Adjustment | Effect | Use Case |
|------------|--------|----------|
| Increase attack | More punch, sharper transients | Kick and snare in sparse mixes |
| Decrease attack | Softer transients, pushed back | Overheads, room mics, background percussion |
| Increase sustain | More room, longer tail | Adding body to close-mic'd drums |
| Decrease sustain | Tighter, more controlled | Reducing room bleed, tightening kick |

**Tip**: Transient shapers work well as an alternative to gating for tightening drums. Reducing sustain is often more natural-sounding than a hard gate.

## Level Balancing

### Anchor Elements

The kick and snare are the anchors of the drum mix. Build everything else around them.

1. Set the kick at a comfortable level.
2. Bring the snare up to sit with the kick (usually slightly louder than the kick in most genres).
3. Add hi-hats to sit behind kick and snare.
4. Bring in overheads/room to taste.
5. Add percussion elements last.

### Relative Levels (General Starting Points)

| Element | Relative Level |
|---------|---------------|
| Kick | Reference (0dB) |
| Snare | 0 to +2dB above kick |
| Hi-hats | -4 to -6dB below kick |
| Overheads | -6 to -10dB below kick |
| Percussion | -6 to -10dB below kick |

These are starting points. Trust your ears and the genre conventions.

## Stereo Placement

| Element | Pan Position | Notes |
|---------|-------------|-------|
| Kick | Center (0) | Always dead center |
| Snare | Center (0) | Always dead center (or just barely off) |
| Hi-hats | 15-30% left or right | Slightly off-center, drummer's perspective or audience perspective |
| Overheads | Hard left / hard right | Wide stereo image |
| Toms | Spread left to right | Follow the physical tom layout |
| Room mic | Wide or mid/side | Adds depth and width |
| Percussion | Varies | Spread across the stereo field for interest |

**Important**: Kick and snare must always be center. Low-frequency content panned to the sides causes phase issues and wastes headroom.
