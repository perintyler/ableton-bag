# Complete Mix Workflow

A step-by-step mixing skill for producing a professional-sounding mix. Combines gain staging, EQ, compression, spatial processing, and mix bus techniques into a single workflow.

## Pre-Mix Checklist

Before touching any plugin:
1. **Set tempo and time signature** correctly
2. **Organize tracks**: color-code, name clearly, group related tracks (drums, bass, keys, vocals)
3. **Create a punch list**: listen to the rough mix, note specific goals per element
4. **Load 2-3 reference tracks** on a dedicated track routed directly to master (bypass bus processing)
5. **Gain stage**: set every track to peak around -10 dBFS, average -18 dBFS

## Phase 1: Static Mix (Faders Only)

No plugins yet — just faders and panning.

1. **Start with the most important element** (usually vocals or drums)
2. **Build the mix around it**: add instruments one at a time
3. **Set rough fader levels** — get the balance 80% right before processing
4. **Pan decisively**:

| Element | Pan Position |
|---------|-------------|
| Kick, snare, bass, lead vocal | Center |
| Rhythm guitars, keys | 25-50% L/R (or hard L/R if doubled) |
| Toms | Spread across kit image |
| Hi-hats | Slightly off-center (10-30%) |
| Overheads | 75-100% L/R |
| Background vocals | 30-70% L/R |
| Percussion, ear candy | Wide, 50-100% |

5. **Check in mono** (Ableton: Utility with Width 0%) — fix any disappearing elements

## Phase 2: Subtractive EQ

Cut problems before boosting anything.

1. **High-pass everything** that doesn't need low end:

| Element | HPF Frequency |
|---------|--------------|
| Kick | 30 Hz |
| Bass | 30-40 Hz |
| Snare | 70 Hz |
| Guitars | 80-150 Hz |
| Vocals | 80-120 Hz |
| Synth pads | 100-200 Hz |
| Synth stabs | 100-200 Hz |
| Hi-hats/cymbals | 300-500 Hz |
| Overheads | 200-300 Hz |

2. **Cut mud/boxiness** (250-500 Hz) on everything except kick and bass
3. **Fix frequency masking** — identify conflicts, cut the less important element:
   - Kick vs bass: sidechain or split the sub (kick gets 40-60 Hz, bass gets 80-150 Hz)
   - Vocals vs guitars: cut 2-4 kHz from instruments
   - Snare vs guitar: cut 200-500 Hz from guitar
   - Cymbals vs vocal sibilance: de-ess vocals, high-shelf cut cymbals

4. **Detection method**: mute the suspected offender — if clarity improves, masking is confirmed

## Phase 3: Compression

Apply dynamics control after subtractive EQ so the compressor reacts to a clean signal.

### Per-Element Settings

| Element | Ratio | Attack | Release | GR | Notes |
|---------|-------|--------|---------|-----|-------|
| Kick | 4:1 | 10-20ms | 50-100ms | 3-6dB | Medium attack for punch |
| Snare | 4:1-6:1 | 20-30ms | 150-250ms | 2-5dB | Slow attack = more punch |
| Bass | 4:1-8:1 | 20-40ms | 100-200ms | 4-8dB | Let transient through |
| Lead vocal | 3:1-4:1 | 10-30ms | 100-200ms | 3-6dB | Soft knee for smoothness |
| BG vocals | 3:1 | 10-20ms | 100ms | 2-4dB | More compressed than lead |
| Guitars | 3:1 | 15-30ms | 100-200ms | 2-4dB | Gentle, consistent |
| Synth stabs | 4:1-6:1 | 5-15ms | 50-150ms | 3-6dB | Fast attack catches transient |
| Synth pads | 2:1 | 30-50ms | 200-300ms | 1-2dB | Gentle, just consistency |

### Parallel Compression (for drums and vocals)
1. Send to a return track
2. Apply heavy compression: 10:1+, fast attack (1-5ms), fast release (20-50ms), 6-12dB GR
3. Blend 20-40% of compressed signal under the dry
4. Result: preserves transients, adds body and weight

## Phase 4: Tonal EQ (Additive)

Now boost what needs enhancing — after compression has shaped the dynamics.

| Element | Boost | Frequency | Amount | Purpose |
|---------|-------|-----------|--------|---------|
| Kick | Body | 60-100 Hz | +2-4dB | Weight and thump |
| Kick | Attack | 2-5 kHz | +2-3dB | Click and definition |
| Snare | Body | 150-250 Hz | +2-3dB | Fullness |
| Snare | Snap | 2-3.5 kHz | +2-3dB | Crack and presence |
| Bass | Definition | 800-1.5 kHz | +1-2dB | Audibility on small speakers |
| Vocals | Presence | 2-4 kHz | +2-3dB | Clarity and intelligibility |
| Vocals | Air | 8-12 kHz | +1-2dB | Openness and breath |
| Hi-hats | Shimmer | 8-12 kHz | +1-2dB | Sparkle |
| Guitars | Bite | 2-4 kHz | +1-2dB | Cut through mix |

**Rule**: use wide Q (0.5-1.5) for additive boosts, narrow Q (2-8) for surgical cuts.

## Phase 5: Saturation

Add warmth and harmonic content after EQ and compression.

| Element | Type | Drive | Dry/Wet | Purpose |
|---------|------|-------|---------|---------|
| Drums | Soft Sine | 3-5dB | 20-30% | Punch, analog warmth |
| Bass | Tape/Soft Sine | 2-4dB | 15-25% | Audibility on small speakers |
| Vocals | Tape | 1-3dB | 10-20% | Warmth, presence |
| Synths | Soft Sine | 2-4dB | 15-25% | Character |
| Mix bus | Tape | 1-2dB | 100% (subtle) | Glue, analog character |

**Compensate**: reduce output by the same amount as drive to maintain consistent levels.

## Phase 6: Depth & Space

Create front-to-back dimension with reverb and delay.

### Reverb Guide

| Placement | Element | Reverb | Decay | Pre-delay | Wet |
|-----------|---------|--------|-------|-----------|-----|
| Very front | Lead vocal | Plate/none | 0.3-0.6s | 30-50ms | 5-15% |
| Front | Snare | Plate | 0.5-1.0s | 20-40ms | 10-20% |
| Mid | Guitars, keys | Room/plate | 1.0-1.5s | 20-40ms | 15-25% |
| Mid-back | Synth pads | Hall | 1.5-3.0s | 40-80ms | 25-40% |
| Far back | Ambient textures | Large hall | 2.0-4.0s | 50-100ms | 30-50% |

### Delay Guide
- **Slap delay** (80-120ms or 1/16-1/32): adds depth without obvious echo
- **Rhythmic delay** (1/4 or dotted 1/8): creates movement and groove
- **Ping-pong delay**: stereo width on guitars, synths, vocals

### Depth Rules
- **Louder = closer, quieter = farther**
- **Brighter = closer, darker = farther** (LPF at 2-8kHz pushes back)
- **Drier = closer, wetter = farther**
- **More compressed = closer** (reveals detail)

## Phase 7: Mix Bus Processing

Apply to the stereo bus as a final polish. Keep moves subtle — 1-3dB max.

### Chain Order
```
HPF (20-30Hz) → Corrective EQ → Glue Compressor → Tonal EQ → Saturation → Stereo Imaging
```

### Settings

| Stage | Setting | Notes |
|-------|---------|-------|
| HPF | 20-30 Hz | Remove subsonic rumble |
| Corrective EQ | ±1-2dB only | Fix broad tonal issues |
| Glue Comp | 2:1, slow attack 30ms, fast release, 1-3dB GR | SSL-style glue |
| Tonal EQ | High shelf +1dB, low shelf +1dB | Final polish |
| Saturation | Tape, 1-2dB drive | Analog warmth |
| Stereo | Mono below 150Hz, widen above 3kHz | Solid low end, wide top |

**Do NOT put a limiter on the mix bus** unless you are also mastering.

## Phase 8: Final Checks

1. **A/B against references** (level-matched: reduce reference 6-9dB)
2. **Check mono** — nothing should disappear
3. **Listen at low volume** — if the balance holds at whisper volume, it'll hold anywhere
4. **Listen on different systems**: monitors, headphones, phone speaker, car
5. **Take breaks**: 10 min silence, then fresh ears for final decisions
6. **Check master bus**: peaking at -6 to -3 dBFS (headroom for mastering)

## Ableton-Specific Workflow

### Using @barry/ableton bridge tools:
```
1. analyze_track_timbre(target_file) → understand the reference sound
2. compare_timbres(source, target) → get EQ recommendations + correction curve
3. match_timbre_to_track(track, target, source) → auto-apply EQ macros
4. setup_drum_processing(track) → load EQ Eight + Compressor + Saturator
5. set_device_parameter() → fine-tune individual parameters
6. get_arrangement_clip_info() → check warp/timing settings
```

### Key Ableton Devices:
- **EQ Eight**: 8-band parametric, use `hzToEQ8()` for frequency conversion
- **Compressor**: Peak/RMS modes, built-in sidechain EQ, Dry/Wet for parallel
- **Glue Compressor**: SSL-style bus compression, fixed ratios
- **Saturator**: 6 waveshaping modes, Soft Sine for warmth
- **Utility**: mono check (Width 0%), gain trim, stereo width

### Loudness Targets:
| Platform | LUFS |
|----------|------|
| Spotify/YouTube/Tidal | -14 |
| Apple Music | -16 |
| Club/DJ | -6 to -10 |
