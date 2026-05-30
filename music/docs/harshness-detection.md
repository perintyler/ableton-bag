# Harshness Detection Algorithm

Technical reference for `@barry/music/harshness`.

## Overview

The module detects resonant spectral peaks in the 2-8kHz range and generates EQ recommendations. The approach is inspired by oeksound's soothe2 dynamic resonance suppressor.

## Algorithm Pipeline

### 1. STFT Computation

Audio is loaded via ffmpeg (`loadAudio`) and transformed using `stft()` with default 4096-point FFT and 512-sample hop. This gives ~10.7Hz bin resolution at 44100Hz and ~11.6ms time resolution.

### 2. Local Spectral Envelope

For each frame, a moving average is computed across frequency bins with a half-width of ~1kHz (~93 bins at default settings). This wide window smooths over harmonic structure in tonal signals (vocals, guitars) so that only true resonant peaks — not individual harmonics — protrude above the envelope.

### 3. Peak Detection

Peaks are identified where:
- The magnitude exceeds the local envelope by `sensitivityDb` (default 6dB)
- The bin is a local maximum (greater than both neighbors)
- The frequency falls within 2-8kHz

Bandwidth is estimated from -3dB points around each peak.

### 4. Temporal Tracking

Peaks across frames are linked if their frequencies are within 1 semitone. Tracked peaks accumulate:
- Average frequency (weighted)
- Average bandwidth
- Total and peak severity
- Frame count and time range

Peaks that aren't matched for ~0.5s are retired. Only peaks lasting longer than `minDurationSec` (default 50ms) are kept.

### 4b. Frequency Merging

After temporal tracking, peaks at similar frequencies (within 1 semitone) are merged across the full timeline. This consolidates the many short-lived peaks at the same frequency into fewer, more meaningful regions with accumulated frame counts and expanded time ranges.

### 5. Classification

- **Resonance**: Present in >80% of total frames
- **Sibilance**: In the 5-8kHz range and not continuous
- **Buildup**: More frames in the second half than the first

### 6. Scoring

Per-band scores are computed as the ratio of "peaking energy" (energy in bins above the sensitivity threshold) to total energy in that band, scaled to 0-100.

The overall score is a weighted average across bands, with the presence band (3-5kHz) weighted 2x because it falls in the ear's most sensitive region (ear canal resonance at ~3-4kHz).

### 7. EQ Recommendations

For each detected region (up to 8):
- **Frequency**: Center of the detected peak
- **EQ8 value**: `hzToEQ8(frequency)` for direct Ableton parameter setting
- **Gain**: `-severity * 0.5` for static, `-severity * 0.3` for dynamic (more conservative since EQ Eight only does static cuts), capped at -6dB
- **Q**: `frequency / bandwidth`, minimum bandwidth of `freq/12` to avoid overly surgical cuts, capped at 12
- **Mode**: `static` for resonances, `dynamic` for sibilance/buildup (advisory — EQ Eight applies static cuts; for dynamic regions, consider a de-esser)

## Psychoacoustic Basis

The 2-8kHz range is critical because:
- The ear canal resonates at ~3-4kHz, amplifying this region by ~10-15dB
- Equal-loudness contours (ISO 226) show maximum sensitivity at 3-4kHz
- Speech intelligibility (formants, consonants) concentrates here
- Excessive energy here causes listener fatigue

## Parameters

| Option | Default | Description |
|--------|---------|-------------|
| sensitivityDb | 6 | dB above envelope to trigger detection |
| nFft | 4096 | FFT size (~10.7Hz resolution at 44100Hz) |
| hopLength | 512 | ~11.6ms per frame at 44100Hz |
| sampleRate | 44100 | Analysis sample rate |
| minDurationSec | 0.05 | Minimum 50ms for a region to count |

## Integration

The module exports:
- `detectHarshness(filePath, options?)` - main analysis function
- Types: `HarshnessSummary`, `HarshRegion`, `HarshnessBand`, `EQFix`, `HarshnessOptions`

Used by `@barry/ableton`'s `detect_and_fix_harshness` tool which can automatically apply the EQ recommendations via EQ Eight.
