# Compression for Mixing

## Fundamentals

Compression reduces the dynamic range of a signal by attenuating levels that exceed a threshold.

| Parameter | What It Does |
|-----------|-------------|
| **Threshold** | The level above which compression begins. Lower threshold = more compression. |
| **Ratio** | How much the signal is reduced. 4:1 means 4dB over threshold becomes 1dB over. |
| **Attack** | How quickly the compressor engages after the signal crosses the threshold. |
| **Release** | How quickly the compressor stops after the signal drops below the threshold. |
| **Knee** | How gradually compression begins. Soft knee = gradual onset, hard knee = abrupt. |
| **Makeup gain** | Compensates for the volume lost through compression. Match perceived loudness before/after. |

**Gain reduction (GR)**: The amount the compressor is actually reducing the signal. Always monitor this.

## Attack and Release Guidelines

### Attack Times

| Speed | Range | Behavior | Use Case |
|-------|-------|----------|----------|
| Fast | 0.1-5ms | Catches transients, reduces punch | Taming peaks, limiting, de-essing |
| Medium | 10-30ms | Lets initial transient through, controls body | Drums (preserves attack), vocals |
| Slow | 30-100ms | Preserves natural transient and dynamics | Bus compression, gentle shaping, overheads |

### Release Times

| Speed | Range | Behavior | Use Case |
|-------|-------|----------|----------|
| Fast | 20-100ms | Energetic, can cause pumping | Drums, parallel compression, rhythmic material |
| Medium | 100-300ms | Smooth, natural | Vocals, bass, general purpose |
| Slow | 300ms-1s+ | Very transparent, gentle | Bus compression, mastering, pads |
| Auto | Varies | Adapts to material, blends fast/slow | Good starting point when unsure |

**Key principle**: Attack controls how much transient passes through. Release controls the groove and feel. Faster release follows the rhythm more closely.

## Drum Compression Cheat Sheet

### Kick Drum

| Parameter | Setting |
|-----------|---------|
| Ratio | 4:1 |
| Attack | 10-30ms (let transient through) |
| Release | 80-120ms (recover before next hit) |
| Gain reduction | 3-6dB |
| Notes | Medium attack preserves the beater click. Adjust release so the compressor recovers before the next kick hit. |

### Snare

| Parameter | Setting |
|-----------|---------|
| Ratio | 4:1 to 6:1 |
| Attack | 20-30ms (preserve initial crack) |
| Release | 150-250ms |
| Gain reduction | 2-5dB |
| Notes | Slower attack lets the snare transient snap through. Higher ratios for more consistent snare level. |

### Overheads

| Parameter | Setting |
|-----------|---------|
| Ratio | 2:1 to 3:1 |
| Attack | 30-80ms (slow, preserve all transients) |
| Release | 150-300ms (medium) |
| Gain reduction | 1-3dB |
| Notes | Gentle compression only. Goal is to control dynamics, not reshape the sound. Preserve the natural room and cymbal decay. |

### Drum Bus Glue

| Parameter | Setting |
|-----------|---------|
| Ratio | 2:1 to 4:1 |
| Attack | 30-100ms (slow, let transients through) |
| Release | 50-100ms (fast, follows the groove) |
| Gain reduction | 1-3dB |
| Notes | The goal is cohesion, not heavy compression. Fast release makes drums feel energetic and punchy. Use Glue Compressor in Ableton for SSL-style bus compression. |

## Parallel Compression (NY Compression)

Parallel compression blends a heavily compressed copy of the signal with the original dry signal. This preserves transients and natural dynamics while adding body, weight, and sustain.

### Setup

1. Create a return/send track with a compressor.
2. Apply heavy compression on the return:
   - Ratio: 10:1 or higher (even limiting)
   - Attack: 0.5-5ms (fast, catch everything)
   - Release: 50-100ms (fast)
   - Gain reduction: 6-12dB (aggressive)
3. Send the source track to this return at unity or lower.
4. Blend the compressed return at 20-40% of the dry signal level.

### When to Use

- **Drums**: Adds weight and sustain without killing transients. Essential technique for punchy drums.
- **Vocals**: Adds thickness and presence without over-compressing.
- **Bass**: Adds consistency while preserving dynamics.
- **Full mix bus**: Subtle parallel compression can add density.

### Tips

- EQ the parallel return: try cutting lows below 100Hz and highs above 10kHz to add only midrange density.
- You can also use Ableton's Compressor dry/wet knob for inline parallel compression (set to 30-50% wet).

## Sidechain Compression

### Kick/Bass Separation

Sidechain compression ducks the bass when the kick hits, creating space for both.

1. Place a compressor on the bass track.
2. Set the sidechain input to the kick drum.
3. Settings:
   - Ratio: 4:1 to 8:1
   - Attack: 0.1-1ms (fast, react immediately to kick)
   - Release: 50-150ms (tune to tempo so bass returns naturally)
   - Gain reduction: 3-6dB
4. Adjust release so the bass volume recovers in time with the groove.

**Alternative**: Use Ableton's Compressor with sidechain EQ to trigger only on the kick's fundamental (filter sidechain input to 60-100Hz).

## Ableton Compressor Devices

### Compressor

- General-purpose compressor with flexible routing.
- Three modes: Peak, RMS, Expand.
- Built-in sidechain with EQ filtering.
- Dry/wet knob for inline parallel compression.
- Use for individual tracks and precise control.

### Glue Compressor

- Modeled after the SSL G-Series bus compressor.
- Designed for bus and group compression.
- Fixed ratio options: 2:1, 4:1, 10:1.
- "Range" control limits maximum gain reduction (useful for gentle bus glue).
- Soft clip option adds subtle saturation at output.
- Best for: drum bus, mix bus, group buses.

### Multiband Dynamics

- Compresses (or expands) three independent frequency bands.
- Each band has its own threshold, ratio, attack, and release.
- Use for frequency-specific dynamic control:
  - Tame low-end boom without affecting highs
  - Control sibilance in a specific band
  - Add punch to a specific frequency range
- More surgical than broadband compression but easier to over-process.

## Common Mistakes

1. **Over-compressing**: More than 6dB of gain reduction on individual tracks is usually too much (except for parallel compression).
2. **Ignoring makeup gain**: Always match the perceived loudness before and after compression. Louder always sounds "better" and will fool you.
3. **Wrong attack time**: Too fast kills transients and makes drums lifeless. Too slow and the compressor misses the action entirely.
4. **Not watching the gain reduction meter**: If the needle is always pinned, you are compressing too hard.
5. **Compressing because you think you should**: Not every track needs compression. If the dynamics are already good, leave it alone.
6. **Setting and forgetting release**: Release should be tuned to the tempo and rhythm of the material.
