# EQ for Mixing

## Fundamentals

- **Subtractive before additive**: Cut problem frequencies first, then boost what you need. Cutting is more transparent than boosting.
- **High-pass everything**: Nearly every track benefits from a high-pass filter (HPF) to remove unnecessary low-end rumble. Only kick and bass should have content below 60Hz.
- **Surgical vs tonal EQ**: Surgical EQ uses narrow Q to remove specific problem frequencies (resonances, mud). Tonal EQ uses wide Q to shape the overall character of a sound.
- **Always check in context**: Solo EQ moves are misleading. Evaluate every EQ decision with the full mix playing.

## Q Width Guidelines

| Purpose | Q Value | Description |
|---------|---------|-------------|
| Surgical notch cut | 8-30 | Very narrow, targets specific resonances |
| Problem frequency cut | 3-6 | Narrow, removes mud/boxiness |
| Tonal shaping (cut) | 0.7-2 | Medium, general frequency reduction |
| Tonal shaping (boost) | 0.5-1.5 | Wide, gentle and musical |
| Broad character | 0.3-0.7 | Very wide, overall tonal shift |

**Rule of thumb**: Narrow Q for cuts, wide Q for boosts. Narrow boosts sound resonant and unnatural.

## Filter Types: When to Use What

- **High-pass / Low-pass filters**: Remove unwanted frequency content entirely. Use on nearly every track.
- **Bell (parametric)**: Most versatile. Use for both surgical cuts and tonal boosts.
- **High shelf**: Boost or cut everything above a frequency. Great for adding "air" (10kHz+) or taming harsh brightness.
- **Low shelf**: Boost or cut everything below a frequency. Use for adding weight or reducing low-end buildup.
- **Notch**: Extremely narrow cut for removing specific resonant frequencies or feedback.

## Frequency Cheat Sheet by Instrument

### Kick Drum

| Frequency | Action | Purpose |
|-----------|--------|---------|
| 30Hz | HPF | Remove sub-rumble |
| 60-100Hz | Boost (bell/shelf) | Body and weight |
| 100-200Hz | Shape | Warmth vs boominess |
| 250-600Hz | Cut (Q: 2-4) | Remove mud and boxiness |
| 2-5kHz | Boost (bell, Q: 1-2) | Attack and beater click |
| 6-8kHz | Subtle boost | Click and presence |

### Snare Drum

| Frequency | Action | Purpose |
|-----------|--------|---------|
| 70Hz | HPF | Remove low-end bleed |
| 150-250Hz | Boost (bell, Q: 1-2) | Body and fatness |
| 500-800Hz | Cut (Q: 2-4) | Remove boxiness and cardboard tone |
| 2-3.5kHz | Boost (bell, Q: 1-2) | Snap and crack |
| 8-12kHz | High shelf boost | Air and sizzle |

### Hi-Hats / Cymbals

| Frequency | Action | Purpose |
|-----------|--------|---------|
| 300-500Hz | HPF | Remove all low/mid bleed |
| 300-600Hz | Cut if needed | Additional mud removal |
| 5-8kHz | Boost (bell, Q: 1-2) | Presence and definition |
| 8-12kHz | Boost (high shelf) | Shimmer and sparkle |
| 10-12kHz | De-ess or narrow cut | Tame harsh sibilance |
| 17kHz | LPF | Remove harsh ultra-highs and aliasing |

### Bass (Electric / Synth)

| Frequency | Action | Purpose |
|-----------|--------|---------|
| 30Hz | HPF | Remove sub-rumble |
| 60-100Hz | Boost (bell/shelf) | Fundamental weight |
| 200-400Hz | Cut (Q: 2-3) | Remove mud, clear up low-mids |
| 800Hz-1.5kHz | Boost (bell, Q: 1-2) | Growl, presence, note definition |
| 2-4kHz | Subtle boost | String noise, finger articulation |

### Vocals

| Frequency | Action | Purpose |
|-----------|--------|---------|
| 80-100Hz | HPF | Remove rumble and proximity effect |
| 200-400Hz | Cut (Q: 1-3) | Reduce muddiness and boominess |
| 800Hz-1kHz | Cut (Q: 2-3) | Remove nasal quality |
| 2-4kHz | Boost (bell, Q: 1-2) | Presence and intelligibility |
| 5-8kHz | Boost (shelf) | Air and clarity |
| 6-9kHz | De-ess (narrow cut) | Control sibilance |

### Guitar (Electric)

| Frequency | Action | Purpose |
|-----------|--------|---------|
| 80-100Hz | HPF | Remove low-end rumble |
| 200-400Hz | Cut (Q: 1-3) | Reduce mud, especially with distortion |
| 800Hz-1.5kHz | Shape | Mid-range character and bite |
| 2-5kHz | Boost (bell, Q: 1-2) | Edge, presence, cut-through |
| 8-12kHz | High shelf | Air (use sparingly on distorted guitars) |

### Synths / Keys

| Frequency | Action | Purpose |
|-----------|--------|---------|
| 60-120Hz | HPF (adjust per sound) | Remove sub content unless it is a bass synth |
| 200-500Hz | Cut (Q: 1-3) | Clear mud, make room for bass/vocals |
| 1-3kHz | Shape | Presence, can compete with vocals |
| 5-10kHz | High shelf | Brightness and shimmer |
| 12kHz+ | LPF if needed | Tame digital harshness |

## EQ Eight in Ableton

- **Oversampling mode**: Enable for high-frequency accuracy. Reduces cramping near Nyquist. Use on master bus and critical tracks.
- **M/S mode**: Process mid and side signals independently. Useful for widening highs (boost side high shelf) or tightening lows (cut side below 200Hz).
- **Spectrum analyzer**: Use the built-in analyzer to identify problem frequencies. Set to "Post" to see the result of your EQ moves.
- **Audition mode** (headphones icon): Solo a band to hear exactly what you are cutting or boosting.
- **Adaptive Q**: When enabled, Q narrows as gain increases. Useful for tonal boosts that stay musical.

## Common Mistakes

1. **Boosting instead of cutting**: If something sounds dull, consider cutting competing frequencies on other tracks rather than boosting highs.
2. **Too narrow Q on boosts**: Creates resonant, ringing artifacts. Keep boost Q values at 2 or lower.
3. **Not checking in context**: A track can sound great solo but terrible in the mix. Always A/B with the full mix.
4. **Over-processing**: If you need more than 6dB of cut or boost, the problem may be the source sound or arrangement.
5. **EQ-ing in solo for too long**: Use solo to identify problems, but make decisions with the mix playing.
6. **Ignoring phase**: Steep filters and heavy EQ introduce phase shift. Use linear phase EQ on buses if phase coherence matters.
7. **Stacking HPFs**: If a track passes through multiple HPFs (channel strip, bus, master), the cumulative effect can thin things out dramatically.
