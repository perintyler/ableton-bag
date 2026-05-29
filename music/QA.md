# @barry/music QA Guidelines

## Test Strategy

### Pure TypeScript Modules (no Python required)
These can be tested with vitest directly:
- `midi.ts` — MIDI file generation, quantization, GM drum map
- `eq-mapping.ts` — Hz to EQ Eight normalization, presets, filter types
- `compare.ts` — `suggestMacroValues()`, `buildBandRecommendations()` (pure math)
- `dsp.ts` — FFT, STFT, spectral features, MFCCs (once implemented)

### Python-Dependent Modules (require audio-tools-venv)
These need integration tests with Python available:
- `analyze.ts` — spectral analysis via librosa
- `similarity.ts` — MFCC comparison, DTW
- `drum-features.ts` — DrumGAN 7-feature extraction
- `drum-parts.ts` — frequency-based drum isolation
- `stems.ts` — demucs stem separation
- `transcribe.ts` — basic-pitch polyphonic transcription

### FFmpeg-Dependent Modules
Require ffmpeg installed:
- `audio.ts` — filtering, frequency band isolation, format conversion
- `onset.ts` — onset detection via energy analysis

## Running Tests

```bash
# Unit tests (pure TS, no external deps)
cd packages/music && pnpm test

# Typecheck
cd packages/music && pnpm typecheck
```

## What to Test

### midi.ts
- Quantization accuracy at different tempos and grid sizes
- MIDI file header correctness (magic bytes, format, track count)
- Note on/off event ordering
- Velocity clamping (0-127)
- GM drum note numbers

### eq-mapping.ts
- Hz ↔ normalized round-trip accuracy
- Boundary values (20Hz → 0, 20kHz → 1)
- Clamping below 20Hz and above 20kHz
- Preset ordering (lower Hz = lower normalized value)

### compare.ts
- suggestMacroValues returns center (~64) for identical inputs
- Correctly boosts/cuts based on energy differences
- Macro values clamped to 0-127
- Band recommendations have correct action (boost/cut/neutral)
- dB calculation from energy percentages

### dsp.ts (once implemented)
- FFT of known signals (pure sine → single peak at correct bin)
- STFT frame count matches expected value
- Spectral centroid of known signals
- MFCC computation matches librosa output (within tolerance)
- Mel scale conversion accuracy

## Test Data

For integration tests, use these reference files:
- `~/Downloads/demucs_output/stems/drums.wav` — SC drums stem
- `~/Downloads/smooth_criminal_isolated/kick_isolated.wav` — isolated kick
- Ableton LD Core Kit samples at `/Applications/Ableton Live 11 Suite.app/Contents/App-Resources/Core Library/Samples/One Shots/Drums/`

## Known Limitations

- Python-dependent modules require `~/audio-tools-venv` with librosa, scipy, etc.
- stems.ts requires PyTorch (demucs) — slow, CPU-intensive
- transcribe.ts requires basic-pitch with ONNX backend (BASIC_PITCH_FORCE_ONNX=1)
- Audio file tests need actual .wav files — not suitable for CI without fixtures

## Accuracy Standards

- EQ frequency mapping: ±1% round-trip accuracy
- MIDI quantization: exact to the grid resolution
- Spectral analysis: ±5% compared to librosa reference values
- MFCC: ±10% compared to librosa (different implementations may vary slightly)
- Onset detection: within 1 grid unit of reference
