# Frequency Clash Detection

## What Is Frequency Masking?

Frequency masking occurs when two or more instruments occupy the same frequency range — one masks the other, reducing clarity and making the mix sound muddy or crowded. The human ear can't clearly distinguish two similar-level signals in the same critical bandwidth simultaneously.

## Common Clash Pairs

| Pair | Clash Zone | Typical Fix |
|------|-----------|-------------|
| Kick + Bass | 60-200Hz | Cut bass at kick's fundamental, or vice versa |
| Vocals + Guitars | 1-4kHz | Cut guitars in the presence range to make room for vocals |
| Snare + Guitar | 200-500Hz | Cut guitar body frequencies where snare lives |
| Cymbals + Vocal Sibilance | 5-10kHz | Cut cymbals in the sibilance range |
| Bass + Synth Pads | 100-300Hz | Cut pad lows to keep bass clear |

## How It Works

The tool analyzes each source's spectral energy across 29 bands (1/3 octave spacing from 31.5Hz to 20kHz), then for every pair of sources:

1. Computes **relative energy** — each source's energy profile sums to 1.0, so loudness differences don't cause false positives
2. Calculates **severity** using the geometric mean: `2 * sqrt(energyA * energyB)` — high only when both sources have significant energy in the same band
3. Recommends a **cut on the weaker source** — unless a role override applies

## The Role System

- **Lead** sources (vocals, solos) are never cut — the support source always yields
- **Support** sources yield to leads and to each other based on relative energy in each band
- When both sources have the same role, the one with less energy in the clashing band gets cut

## When to Use `detect_track_clashes`

- When the mix sounds muddy or instruments aren't distinct
- After adding new stems to identify conflicts before they pile up
- As a diagnostic tool to understand where instruments overlap
- When you want automated surgical EQ as a starting point

## When to Use Manual EQ Instead

- For creative tonal shaping (this tool is corrective, not creative)
- When you hear masking only in certain song sections (the tool analyzes the whole file)
- For M/S or mid-side EQ decisions
- When the issue is phase cancellation rather than frequency overlap

## Interpreting Scores

| Score | Meaning |
|-------|---------|
| 0-10 | Minimal clashing — sources occupy distinct frequency space |
| 10-30 | Mild overlap — may or may not be audible, monitor before applying |
| 30-60 | Moderate clashing — surgical cuts likely beneficial |
| 60-100 | Severe masking — sources heavily overlap, significant EQ needed |

## EQ Parameters

Clash detection uses gentler settings than harshness detection:

| Parameter | Clash Detection | Harshness Detection |
|-----------|----------------|---------------------|
| Max gain | -4 dB | -6 dB |
| Q range | 3-5 | Up to 18 |
| Max cuts/source | 4 | 8 |

This is intentional — clash cuts are broader and gentler because you're shaping the overall frequency balance between instruments, not removing sharp resonant peaks.

## Integration with Ableton

When `apply=true`, the tool:
1. Groups fixes by source
2. Loads EQ Eight onto each affected track
3. Configures bell cuts at the recommended frequencies
4. Returns the full analysis plus applied bands per track

Each source needs a `track_index` when applying. The `role` parameter controls which source yields.
