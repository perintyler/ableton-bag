# Harshness Detection & Correction

## What Is Harshness?

Harshness is caused by resonant peaks in the 2-8kHz range where human hearing is most sensitive. It manifests as fatiguing, piercing, or "ice pick" quality in audio. The ear canal naturally resonates around 3-4kHz, making this region perceptually amplified.

## The Three Sub-Bands

| Band | Range | Character | Common Sources |
|------|-------|-----------|----------------|
| Nasal | 2-3kHz | Honky, nasal, boxy | Vocals, guitars, snare |
| Presence | 3-5kHz | Harsh, piercing, fatiguing | Vocals, cymbals, distorted guitars |
| Sibilance | 5-8kHz | Sizzly, spitty, sharp | Vocals (s/t/ch), hi-hats, overheads |

The **presence band (3-5kHz)** is weighted 2x in scoring because it's perceptually the harshest range.

## Classification Types

- **Resonance**: Present in >80% of the audio duration. Static EQ cut is appropriate.
- **Sibilance**: Transient peaks in the 5-8kHz range. Dynamic EQ or de-esser is better than static cuts.
- **Buildup**: Severity increases over time, often from layered instruments. May need bus-level treatment.

## When to Use `detect_and_fix_harshness`

Use it when:
- A track sounds harsh, piercing, or fatiguing
- You need to identify specific problem frequencies before EQing
- Vocals have sibilance issues
- Cymbals or overheads are too bright/harsh
- You want automated EQ corrections as a starting point

## When to Use Manual EQ Instead

- When harshness is context-dependent (only harsh in the mix, not solo)
- When you need dynamic EQ (the tool applies static cuts)
- When the score is low but something still sounds off (could be a different issue)
- For subtle tonal shaping rather than problem-solving

## Interpreting Scores

| Score | Meaning |
|-------|---------|
| 0-15 | Clean, no significant harshness |
| 15-35 | Mild, may not need correction |
| 35-60 | Moderate, EQ correction recommended |
| 60-80 | Harsh, definitely needs treatment |
| 80-100 | Severe, multiple aggressive cuts needed |

## Understanding EQ Recommendations

Each recommendation includes:
- **frequency**: Where to cut (Hz)
- **eq8Value**: Ableton EQ Eight normalized frequency (0-1)
- **gain**: How much to cut (dB, capped at -6dB)
- **q**: How narrow the cut should be (higher = narrower)
- **mode**: `static` for resonances, `dynamic` for sibilance (advisory — see below)

The gain is calculated as `-severity * 0.5` for static regions, capped at -6dB. For dynamic (sibilance) regions, a more conservative `-severity * 0.3` is used because EQ Eight only applies static cuts — a full cut on sibilant frequencies would dull the signal between sibilant moments. When mode is `dynamic`, consider using a de-esser instead of (or in addition to) the EQ Eight cut.

## Integration with Ableton

When `apply=true`, the tool:
1. Loads EQ Eight onto the specified track
2. Configures up to 8 bell-cut bands at detected frequencies
3. Sets frequency, gain, and Q for each band
4. Returns device indices for further tweaking

After applying, use `list_device_parameters` to review and `set_device_parameter` to fine-tune.
