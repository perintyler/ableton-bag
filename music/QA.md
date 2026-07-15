# @barry/music QA Guidelines

## Test Strategy

All modules are pure TypeScript + ffmpeg + ONNX. No Python dependencies.

### Pure TypeScript Modules (no external deps)
These can be tested with vitest directly:
- `midi.ts` -- MIDI file generation, quantization, GM drum map
- `eq-mapping.ts` -- Hz to EQ Eight normalization, presets, filter types
- `compare.ts` -- `suggestMacroValues()`, `buildBandRecommendations()` (pure math)
- `dsp.ts` -- FFT, STFT, ISTFT, spectral features, mel filterbanks, MFCCs, audio loading via ffmpeg
- `analyze.ts` -- pure TS spectral analysis (uses dsp.ts internally, no ONNX)
- `similarity.ts` -- MFCC comparison, spectral distance (uses dsp.ts, no ONNX)
- `drum-features.ts` -- drum feature extraction (uses dsp.ts, no ONNX)
- `drum-parts.ts` -- `drumNotesToBatches()` is pure TS; isolation functions use ffmpeg

### ONNX-Dependent Modules (require onnxruntime-node)
- `stems.ts` -- demucs stem separation via ONNX
- `transcribe.ts` -- basic-pitch polyphonic transcription via ONNX

### FFmpeg-Dependent Modules
Require ffmpeg installed:
- `audio.ts` -- filtering, frequency band isolation, format conversion
- `onset.ts` -- onset detection via energy analysis
- `drum-parts.ts` -- frequency-based drum isolation (isolateDrumParts, extractDrumMidi)
- `dsp.ts` -- `loadAudio()` uses ffmpeg for decoding

## Running Tests

```bash
# Unit tests (pure TS, no external deps)
cd music && pnpm test

# Typecheck
cd music && pnpm typecheck
```

## What to Test

### midi.ts
- Quantization accuracy at different tempos and grid sizes
- MIDI file header correctness (magic bytes, format, track count)
- Note on/off event ordering
- Velocity clamping (0-127)
- GM drum note numbers
- `writeMidiFile` writes a file with correct MThd header bytes
- `writeOnsetsMidi` creates a file with expected MIDI structure

### eq-mapping.ts
- Hz <-> normalized round-trip accuracy
- Boundary values (20Hz -> 0, 20kHz -> 1)
- Clamping below 20Hz and above 20kHz
- Preset ordering (lower Hz = lower normalized value)

### compare.ts
- suggestMacroValues returns center (~64) for identical inputs
- Correctly boosts/cuts based on energy differences
- Macro values clamped to 0-127
- Band recommendations have correct action (boost/cut/neutral)
- dB calculation from energy percentages
- `compareTimbre` returns TimbreComparison with source, target, eq fields
- `spectralCorrectionCurve` returns 29 frequencies (THIRD_OCTAVE_CENTERS)
- `buildBandRecommendations` (via compareTimbre) returns 7 band recommendations

### dsp.ts
- FFT of known signals (pure sine -> single peak at correct bin)
- STFT frame count matches expected value
- ISTFT round-trip reconstruction
- Spectral centroid of known signals
- MFCC computation shape and reproducibility
- Mel scale conversion accuracy
- `loadAudio` returns Float64Array at correct sample rate

### audio.ts
- `getAudioInfo` returns duration, sample rate, channels for generated WAVs
- `convertToWav` produces a valid output file
- `filter` applies highpass/lowpass, output exists
- `DRUM_BANDS` has kick/snare/hihat band definitions with correct values

### onset.ts
- `detectOnsets` detects onsets in a signal with clear transients (periodic clicks)
- Returns empty array for silence
- Onset times are within file duration, velocities in 40-127 range

### drum-parts.ts
- `drumNotesToBatches` splits notes into correct batch counts
- Empty array returns empty array
- Batch size 1 returns individual notes
- Default batch size of 200

### drum-features.ts
- `extractDrumFeaturesTS` returns all 7 features for a generated WAV
- Feature values are finite numbers
- `drumFeatureDistance` returns 0 for identical features
- `findClosestSample` returns the closest match from candidates

### similarity.ts
- `timbreSimilarityTS` scores ~1.0 comparing a file to itself
- Scores lower for different signals
- `mfccDistanceTS` returns greater distance for different signals

## Test Data

Test WAV files should be generated programmatically using the `saveTestWav` helper pattern (see analyze.test.ts, audio.test.ts). This creates minimal 16-bit PCM mono WAV files from Float64Array samples, with no dependency on local files or external fixtures.

Common test signals:
- 440Hz sine wave (1 second, 44100Hz) -- for spectral analysis
- 4000Hz sine wave -- for bright/dark comparison
- Periodic click impulses -- for onset detection
- White noise (via Math.random) -- for flatness/texture tests

## Postinstall Model Verification

The `postinstall` script runs `tsx scripts/download-models.ts` to fetch ONNX model files needed by stems.ts and transcribe.ts. After install, verify models are present by calling `checkHealth()` from the health module, which reports the status of all required models, ffmpeg availability, and onnxruntime-node loading.

## Known Limitations

- ONNX modules require `onnxruntime-node` and bundled model files
- stems.ts (demucs ONNX) is CPU-intensive on long audio
- FFmpeg-dependent tests require ffmpeg to be installed on the system
- `loadAudio` (dsp.ts) and audio.ts functions shell out to ffmpeg

## Accuracy Standards

- EQ frequency mapping: +/-1% round-trip accuracy
- MIDI quantization: exact to the grid resolution
- Spectral analysis: +/-5% of expected reference values
- MFCC: +/-10% tolerance (implementation-specific numerical differences)
- Onset detection: within 1 grid unit of reference
