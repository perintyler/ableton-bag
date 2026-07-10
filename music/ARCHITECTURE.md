# @barry/music SDK — Architecture Overview

---

## Package Structure

```
@barry/music (3,581 lines TypeScript, 0 lines Python)
├── Core DSP ─────────── dsp.ts (726 lines, 22 exports)
├── Analysis ─────────── analyze.ts (274 lines, 5 exports)
├── Comparison ───────── compare.ts (290 lines, 8 exports)
├── Similarity ───────── similarity.ts (261 lines, 6 exports)
├── Drum Features ────── drum-features.ts (204 lines, 6 exports)
├── Drum Parts ───────── drum-parts.ts (216 lines, 7 exports)
├── Stem Separation ──── stems.ts (393 lines, 5 exports)
├── Transcription ────── transcribe.ts (311 lines, 5 exports)
├── MIDI ─────────────── midi.ts (282 lines, 10 exports)
├── Audio I/O ────────── audio.ts (133 lines, 8 exports)
├── Onset Detection ──── onset.ts (162 lines, 4 exports)
├── EQ Mapping ───────── eq-mapping.ts (61 lines, 4 exports)
├── Health Check ─────── health.ts (115 lines, 2 exports)
└── Shell Exec ───────── exec.ts (30 lines, 3 exports)
```

---

## Module Dependency Graph

```
                    ┌─────────────┐
                    │   index.ts   │ ← barrel re-exports
                    └──────┬──────┘
           ┌───────────────┼───────────────────────────┐
           │               │                           │
    ┌──────┴──────┐  ┌─────┴─────┐              ┌─────┴──────┐
    │  analyze.ts  │  │ compare.ts │              │  stems.ts   │
    │  spectral    │  │ EQ recs    │              │  demucs     │
    │  analysis    │  │ correction │              │  ONNX       │
    └──────┬──────┘  └─────┬─────┘              └──────┬──────┘
           │               │                           │
           └───────┬───────┘                           │
                   │                                   │
             ┌─────┴─────┐                             │
             │  dsp.ts    │◄────────────────────────────┘
             │  FFT/STFT  │
             │  MFCCs     │◄──── similarity.ts
             │  spectral  │◄──── drum-features.ts
             │  features  │◄──── transcribe.ts
             │  loadAudio │
             └─────┬─────┘
                   │
             ┌─────┴─────┐     ┌────────────┐
             │  exec.ts   │◄────│  audio.ts   │
             │  shell cmd │◄────│  onset.ts   │
             └───────────┘     │  health.ts  │
                               └────────────┘

    ┌────────────┐     ┌──────────────┐
    │  midi.ts   │     │ eq-mapping.ts │   ← no dependencies
    │  MIDI file │     │ Hz ↔ EQ8     │      (pure math)
    │  writer    │     │ presets      │
    └────────────┘     └──────────────┘
```

---

## External Dependencies

| Dependency | Purpose | Size |
|---|---|---|
| **ffmpeg** (CLI) | Audio loading, format conversion, filtering | system |
| **onnxruntime-node** | ONNX model inference for stems + transcription | npm |
| **@spotify/basic-pitch** | Post-processing for polyphonic transcription | npm |

### ONNX Models (auto-downloaded via postinstall)

| Model | Size | Source |
|---|---|---|
| basic-pitch-nmp.onnx | 225 KB | HuggingFace/spotify |
| htdemucs.onnx | 289 MB | HuggingFace/MrCitron |

---

## dsp.ts — The Foundation (726 lines)

The pure TypeScript DSP engine that replaced Python/librosa.

### Signal Processing
- **fft / ifft** — Radix-2 Cooley-Tukey FFT + inverse
- **stft / stftComplex / istft** — Short-Time Fourier Transform with overlap-add
- **hannWindow / hammingWindow** — Window functions

### Feature Extraction
- **spectralCentroid** — center of mass (brightness)
- **spectralBandwidth** — frequency spread
- **spectralFlatness** — tonal vs noise (0-1)
- **spectralRolloff** — energy ceiling frequency
- **bandEnergy** — energy percentage in Hz range

### Perceptual Audio
- **hzToMel / melToHz** — Mel scale conversion
- **melFilterbank** — Triangular mel filter matrix
- **dctII** — Discrete Cosine Transform Type-II
- **mfcc** — Full 13-coefficient MFCC pipeline

### Audio I/O
- **loadAudio** — Any format to Float64Array via ffmpeg

---

## Analysis Pipeline

```
Audio File
    │
    ▼
┌──────────┐    ┌───────────────┐    ┌──────────────┐
│ loadAudio │───►│  STFT (4096)  │───►│  Spectral    │
│ via ffmpeg│    │  512 hop      │    │  Features    │
└──────────┘    └───────────────┘    └──────┬───────┘
                                           │
                    ┌──────────────────────┬┴──────────────────┐
                    │                      │                    │
              ┌─────┴─────┐        ┌───────┴──────┐    ┌───────┴──────┐
              │ analyzeTs  │        │  compareTs   │    │drumFeaturesTs│
              │            │        │              │    │              │
              │ centroid   │        │ band energy  │    │ brightness   │
              │ bandwidth  │        │ dB correction│    │ hardness     │
              │ flatness   │        │ macro values │    │ depth        │
              │ rolloff    │        │ 1/3 octave   │    │ roughness    │
              │ bands      │        │ curve        │    │ boominess    │
              │ attack/dec │        │              │    │ warmth       │
              └────────────┘        └──────────────┘    │ sharpness    │
                                                        └──────────────┘
```

---

## Stem Separation Pipeline

```
Audio File (any format)
    │
    ▼
┌──────────────────┐
│ loadStereoAudio  │  ffmpeg → stereo Float64Array @ 44100Hz
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Chunk into        │  343,980 samples per segment (7.8s)
│ 97 segments       │  25% overlap with crossfade windowing
└────────┬─────────┘
         │
    ┌────┴────┐ x 97 segments
    │         │
    ▼         │
┌─────────┐   │
│ ONNX    │   │  onnxruntime-node
│ htdemucs│   │  Input: [1, 2, 343980]
│ 289 MB  │   │  Output: [1, 4, 2, 343980]
└────┬────┘   │          (4 stems x stereo)
     │        │
     ▼        │
┌─────────┐   │
│Accumulate│◄─┘  Crossfade overlap-add
│ + weight │     Normalize by window sum
└────┬────┘
     │
     ▼
┌─────────────────┐
│  4 Stem WAVs     │
│  drums.wav       │
│  bass.wav        │
│  vocals.wav      │
│  other.wav       │
└─────────────────┘
```

---

## @barry/ableton — 48 Tools

### Session & Transport (6)
`ableton_status` `open_ableton` `setup_ableton` `get_session_info` `start_playback` `stop_playback`

### Tracks (7)
`get_track_info` `create_midi_track` `create_audio_track` `set_track_name` `delete_track` `set_track_mute` `set_track_solo` `set_track_arm`

### Session Clips (7)
`create_clip` `add_notes_to_clip` `set_clip_name` `fire_clip` `stop_clip` `stop_all_clips` `delete_clip_from_slot`

### Arrangement (5)
`create_arrangement_clip` `add_notes_to_arrangement_clip` `list_arrangement_clips` `duplicate_clip_to_arrangement` `create_audio_arrangement_clip`

### Devices & Browser (8)
`list_devices` `list_device_parameters` `set_device_parameter` `get_device_parameters` `delete_device` `load_browser_item` `list_loadable_items` `get_browser_items`

### Processing Chains (2)
`setup_drum_processing` `setup_mix_bus`

### Clip Properties (2)
`get_arrangement_clip_info` `set_clip_warping`

### Bridge Tools (5)
`match_timbre_to_track` `analyze_track_timbre` `compare_timbres` `extract_and_load_drums` `analyze_drum_features`

---

## The Bridge: Analysis to Ableton

```
@barry/music                              @barry/ableton
────────────                              ──────────────

analyzeTimbre(file)  ──────────────────►  analyze_track_timbre
     │
     ▼
compareTimbre(src, tgt) ───────────────►  compare_timbres
     │                                         │
     ├── suggestMacroValues()                   │
     │        │                                 │
     │        ▼                                 ▼
     │   {low, mid, high}  ────────────►  match_timbre_to_track
     │                                    (auto-applies EQ macros)
     │
extractDrumMidi(file) ─────────────────►  extract_and_load_drums
     │                                    (creates clip + adds notes)
     │
extractDrumFeatures(file) ─────────────►  analyze_drum_features
```

---

## Test Coverage — 109 Tests

| Module | Tests | Focus |
|---|---|---|
| dsp | 47 | FFT, STFT, features, MFCCs, mel, windows, loadAudio |
| eq-mapping | 11 | Hz to EQ8 conversion, presets, round-trip |
| midi | 11 | Quantization, MIDI header, write to file |
| compare | 7 | Macro values, band recs, correction curve |
| analyze | 7 | 440Hz sine validation, type shape |
| dsp-migration | 9 | Correction curves, drum features, similarity, DTW |
| audio | 5 | getAudioInfo, filter, convertToWav |
| drum-parts | 5 | Batch splitting edge cases |
| stems | 4 | FFT round-trip, ISTFT, ONNX model loading |
| onset | 2 | Click detection, silence |
| transcribe | 1 | 440+880Hz polyphonic detection |

---

## Skills & Documentation

### Mixing Skills (10 files, 1,996 lines)
- eq, compression, saturation, drum-processing, bass, vocals, synths, complete-mix
- ableton/effects-chain, mixing-fundamentals

### Research Docs (8 files, 1,083 lines)
- spectral-features, timbre-science, eq-matching, timbre-transfer
- drum-synthesis, open-source-tools, implementation-guide

### Package Docs (3 files, 753 lines)
- mixing-fundamentals, drum-mixing-reference, ableton-effects-reference

---

## Summary

| Metric | Value |
|---|---|
| TypeScript source | 3,581 lines |
| Python source | 0 lines |
| Test count | 109 |
| Test files | 11 |
| Ableton tools | 48 |
| Skills + docs | 21 files, 3,832 lines |
| npm dependencies | 2 |
| CLI dependencies | 1 (ffmpeg) |
| ONNX models | 2 (289 MB total) |
| QA steps | 7/7 passing |
