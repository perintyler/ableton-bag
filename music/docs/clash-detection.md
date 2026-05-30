# Clash Detection — Technical Reference

## Algorithm Overview

1. **Load & STFT**: Each source is loaded via `loadAudio()`, then `stft()` computes the magnitude spectrogram (4096-point FFT, 512-sample hop)
2. **Average spectrum**: Per-source average magnitude across all STFT frames
3. **1/3 octave energy**: Power (magnitude squared) summed within each of 29 bands, then normalized to sum to 1.0
4. **Pairwise detection**: For each pair (i < j), for each band, compute geometric mean severity
5. **Fix generation**: Cut the weaker source with gentle bell EQ, merge nearby fixes, limit per source
6. **Scoring**: Overall score reflects total severity relative to theoretical maximum

## Why 1/3 Octave Bands?

- Matches the ear's **critical bandwidth** — two sounds within the same 1/3 octave band mask each other perceptually
- Already proven in `spectralCorrectionCurve` (compare.ts) and used in audio measurement standards (IEC 61260)
- 29 bands provides enough resolution for mixing decisions while staying practical for EQ Eight's 8-band limit
- Frequencies: 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000 Hz

Each band spans `fc / 2^(1/6)` to `fc * 2^(1/6)`, matching the `sixthOctave` pattern from compare.ts line 199.

## Severity Formula

```
severity = min(1, 2 * sqrt(energyA * energyB))
```

This is the geometric mean scaled to 0-1. Properties:
- **High only when both sources contribute** — if one source has 0 energy, severity is 0
- **Symmetric** — doesn't matter which source is A or B
- **Peaks at equal energy** — maximum clash when both sources have equal presence
- The 2x multiplier normalizes so that two sources each with 50% energy in a band produce severity = 1.0

## Relative Energy Normalization

Each source's 29-band energy profile sums to 1.0. This means:
- A quiet track and a loud track with the same spectral shape produce identical profiles
- Level differences don't cause false clashes
- Only spectral _overlap_ matters, not absolute level

## Cut Logic

1. **Role override**: Lead sources are never cut. If source A is lead and B is support, B always gets cut regardless of relative energy
2. **Energy comparison**: When roles are equal, the source with less energy in the clashing band gets cut — it's the one "losing" the masking battle
3. **Gain**: `max(-4, -severity * 3)` — gentler than harshness (-6 max) because these are tonal balance adjustments
4. **Q**: 3 (bass), 4 (mids), 5 (highs) — wider than harshness cuts because we're shaping broad energy, not removing narrow resonances

## Comparison with Harshness Detection

| Aspect | Harshness | Clash |
|--------|-----------|-------|
| Input | Single file | 2+ files |
| Range | 2-8kHz | Full spectrum (31.5Hz-20kHz) |
| Detection | Peaks above local envelope | Mutual energy overlap |
| Severity | dB protrusion | Geometric mean of normalized energy |
| Max gain | -6 dB | -4 dB |
| Max Q | 18 | 5 |
| Max cuts | 8 per file | 4 per source |
| Purpose | Remove painful resonances | Reduce masking between instruments |

## Limitations

- **Static analysis**: Analyzes the entire file as one block — doesn't detect clashes that only occur in certain sections
- **No phase awareness**: Only looks at magnitude, not phase relationships (phase cancellation is a different problem)
- **Mono analysis**: Stereo sources are downmixed to mono for analysis — doesn't consider L/R panning separation
- **No perceptual weighting**: All bands are treated equally (no A-weighting or loudness curves)
- **Conservative cuts**: -4dB max may not be enough for severe masking — manual follow-up may be needed
