# Ableton Live Audio Effects Reference

## EQ Eight

8-band fully parametric equalizer.

### Parameters Per Band

| Parameter | Range | Description |
|-----------|-------|-------------|
| Frequency | 20 Hz - 20 kHz | Center frequency of the band |
| Gain | -15 to +15 dB | Amount of cut or boost (not applicable to filter types) |
| Q (Bandwidth) | 0.1 - 18 | Higher Q = narrower bandwidth. Low Q (0.5) for broad tonal shaping, high Q (4+) for surgical cuts |

### Filter Types (per band)

| Type | Use Case |
|------|----------|
| Low Cut (HPF) | Remove everything below the set frequency. Use on most tracks to clean low-end rumble. Slopes: 12, 24, 48 dB/oct |
| Low Shelf | Boost or cut everything below the set frequency. Use for adding or removing overall warmth/weight |
| Bell | Boost or cut at a specific frequency with adjustable Q. The workhorse for both surgical and tonal EQ |
| Notch | Remove a very narrow frequency band completely. Use for eliminating resonances, hums, or feedback |
| High Shelf | Boost or cut everything above the set frequency. Use for adding air/brightness or taming harshness |
| High Cut (LPF) | Remove everything above the set frequency. Use to remove fizz, noise, or tame brightness. Slopes: 12, 24, 48 dB/oct |

### Special Features

| Feature | Description | When to Use |
|---------|-------------|-------------|
| Oversampling (x4) | Processes at 4x sample rate internally | Enables cleaner processing in the high frequencies. Turn on when doing significant high-frequency boosting or on the master bus. Increases CPU usage |
| M/S Mode | Switch between L/R (stereo) and M/S (mid-side) processing | Process mid (center) and side (stereo) content independently. Useful for widening, tightening bass in the center, or adding air to sides only |
| Scale | 0-100% | Proportionally scales all gain values. At 50%, a +6 dB boost becomes +3 dB. Useful for A/B testing and dialing back all EQ moves at once |
| Spectrum Analyzer | Real-time frequency display | Visual feedback for identifying problem frequencies. Pre or post EQ display |

### Practical Tips

- Enable Oversampling on the master bus and any track with significant high-frequency processing.
- Use M/S mode to keep bass mono (cut sides below 200 Hz) while widening the highs (boost sides above 8 kHz).
- The Scale knob is excellent for A/B comparison: automate between 0% (bypassed EQ) and 100% (full EQ) to check your work.

---

## Compressor

Versatile dynamics processor with multiple detection modes.

### Parameters

| Parameter | Range | Description | Musical Effect |
|-----------|-------|-------------|----------------|
| Threshold | -inf to 0 dB | Level above which compression begins | Lower threshold = more compression. Set by watching the gain reduction meter |
| Ratio | 1:1 to inf:1 | Amount of gain reduction applied above threshold | 2:1-4:1 gentle, 4:1-8:1 moderate, 8:1+ limiting |
| Attack | 0.01 - 1000 ms | How quickly the compressor responds to signal exceeding threshold | Fast (0.01-1 ms): clamps transients, rounder sound. Slow (10-30 ms): lets transients through, more punch |
| Release | 1 - 3000 ms | How quickly the compressor stops compressing after signal drops below threshold | Fast (10-50 ms): responsive, can pump. Slow (100-300 ms): smooth, sustained compression. Too slow = never releases, kills dynamics |
| Knee | 0 - 1 (hard to soft) | How gradually compression engages around threshold | Hard knee: abrupt, obvious compression. Soft knee: gradual, transparent compression |
| Makeup Gain | 0 to +30 dB | Compensates for gain reduction | Set so output level matches input level (unity gain) for honest A/B comparison |
| Dry/Wet | 0-100% | Blends compressed and uncompressed signal | Enables inline parallel compression. 50-70% gives parallel compression character without a send bus |
| Output | -inf to +30 dB | Final output level | Use to prevent clipping after makeup gain |

### Detection Modes

| Mode | Description | Best For |
|------|-------------|----------|
| Peak | Reacts to instantaneous peak levels | Transient control, drums, percussive material. More aggressive, faster response |
| RMS | Reacts to average signal level | Vocals, bass, sustained material. Smoother, more musical compression |
| Expand | Expander mode — reduces signal below threshold | Gating effect, reducing bleed, cleaning up noise between phrases |

### Sidechain

| Feature | Description |
|---------|-------------|
| External sidechain | Trigger compression from another track's signal. Classic use: kick sidechaining bass to duck bass on kick hits |
| Sidechain EQ | Built-in EQ on the sidechain signal. Shape what the compressor "listens to" without affecting the audio |
| Sidechain HPF | High-pass the sidechain so the compressor ignores low frequencies. Prevents bass-heavy content from over-triggering |

### Practical Tips

- Use the Dry/Wet knob for parallel compression instead of setting up a send bus — faster and simpler for individual tracks.
- Sidechain EQ: high-pass the sidechain at 100-200 Hz on a mix bus compressor so low-end transients don't cause the whole mix to pump.
- In RMS mode with a soft knee, the compressor behaves more like a vintage optical compressor — great for vocals.
- In Peak mode with a hard knee, it behaves more like a FET compressor — great for drums.

---

## Glue Compressor

Emulation of the classic SSL G-Series bus compressor. Designed for bus/group processing.

### Parameters

| Parameter | Options / Range | Description | Musical Effect |
|-----------|----------------|-------------|----------------|
| Threshold | -40 to 0 dB | Level above which compression begins | Set for 1-4 dB gain reduction on buses |
| Ratio | 2:1, 4:1, 10:1 | Fixed ratio options | 2:1 for subtle glue, 4:1 for moderate control, 10:1 for aggressive limiting |
| Attack | 0.01, 0.1, 0.3, 1, 3, 10, 30 ms | Fixed attack time options | 0.01 ms: clamps everything. 0.3-1 ms: fast but allows some transient. 10-30 ms: lets transients punch through — best for bus glue |
| Release | 0.1, 0.2, 0.4, 0.6, 0.8, 1.2 s, Auto | Fixed release time options | Short (0.1-0.2 s): responsive, can pump. Long (0.8-1.2 s): smooth. Auto: adapts to program material — generally the safest choice |
| Range | -40 to 0 dB | Maximum gain reduction limit | Limits how much the compressor can reduce gain. Set to -6 dB to prevent over-compression on dynamic material |
| Makeup | 0 to +15 dB | Output gain compensation | Match output level to input level |
| Dry/Wet | 0-100% | Parallel blend | 50-80% for parallel bus compression |
| Soft Clip | On/Off | Soft saturation on the output | Adds subtle warmth and prevents hard digital clipping. Engage on drum bus and mix bus for analog character |

### Recommended Settings by Use Case

#### Drum Bus Glue

| Parameter | Setting |
|-----------|---------|
| Ratio | 4:1 |
| Attack | 10 or 30 ms |
| Release | Auto or 0.2 s |
| Range | -6 dB |
| Gain reduction target | 1-3 dB |
| Soft Clip | On |

#### Mix Bus Glue

| Parameter | Setting |
|-----------|---------|
| Ratio | 2:1 |
| Attack | 10 or 30 ms |
| Release | Auto |
| Range | -3 dB |
| Gain reduction target | 1-2 dB |
| Soft Clip | On |

#### Parallel Smash (via Dry/Wet)

| Parameter | Setting |
|-----------|---------|
| Ratio | 10:1 |
| Attack | 0.01 ms |
| Release | 0.1 s |
| Dry/Wet | 20-40% |
| Soft Clip | On |

### Practical Tips

- The Glue Compressor excels at making multiple tracks sound like they belong together — hence "glue."
- Use the Range control to set a ceiling on gain reduction. This prevents the compressor from overreacting on loud transients.
- Auto release is excellent for bus use — it adapts to the material and generally sounds musical.
- The Soft Clip feature adds subtle SSL-style saturation. Leave it on for most bus applications.

---

## Saturator

Waveshaping distortion/saturation effect for adding harmonic content and warmth.

### Parameters

| Parameter | Range | Description | Musical Effect |
|-----------|-------|-------------|----------------|
| Drive | -inf to +36 dB | Amount of input gain driving the waveshaper | More drive = more saturation/distortion. Start low (+3 to +6 dB) for subtle warmth |
| Type | 6 curve types | Waveshaping algorithm | Determines the character of the distortion (see below) |
| Color | On/Off + controls | Pre-saturation tone shaping | Two knobs: Base (low-frequency boost/cut before saturation) and Width (bandwidth). Shapes what frequencies get saturated most |
| Output | -inf to 0 dB | Post-saturation output level | Compensate for gain added by Drive to maintain unity gain |
| Dry/Wet | 0-100% | Parallel blend | Essential for subtle use. 10-30% keeps the effect transparent |

### Waveshaping Curves

| Curve | Character | Best For |
|-------|-----------|----------|
| Analog Clip | Hard clipping with smooth transition, like pushing an analog circuit | Aggressive saturation, drum buses, making things louder and denser. Most colored option |
| Soft Sine | Gentle sine-based waveshaping, even harmonics | Subtle warmth on vocals, bass, acoustic instruments. Most transparent option |
| Medium Curve | Moderate saturation between soft and hard | General-purpose warming, guitars, synths |
| Hard Curve | Aggressive waveshaping with more odd harmonics | Aggressive character on drums, distorted bass, sound design |
| Sinoid Fold | Wavefolder — folds the waveform back on itself at extremes | Sound design, aggressive timbral changes, creating new harmonics. Gets wild at high drive |
| Digital Clip | Hard digital clipping, abrupt | Lo-fi effects, aggressive distortion, bit-crushing character. Harshest option |

### Color Section

The Color section is a two-band EQ applied before the waveshaper:

| Control | Effect |
|---------|--------|
| Base | Boosts or cuts the low frequencies feeding into the waveshaper. Positive values add low-end saturation warmth |
| Width | Controls the bandwidth of the Base filter. Higher values affect a wider frequency range |

This is powerful because it lets you choose which frequencies get saturated most. Boosting the Base drives more low-end into the waveshaper, creating warm bass harmonics.

### Practical Tips

- **For subtle warmth**: Soft Sine curve, Drive +3 to +6 dB, Output compensated, Dry/Wet 20-40%.
- **For drum bus excitement**: Analog Clip, Drive +6 to +12 dB, Dry/Wet 15-30%.
- **For bass presence**: Soft Sine, Color on with Base boosted, Drive +6 dB, Dry/Wet 30-50%. Adds midrange harmonics that help bass translate on small speakers.
- Always compensate the Output to match the input level — saturation adds gain, and louder always sounds "better," which is misleading.

---

## Multiband Dynamics

3-band dynamics processor for frequency-specific compression, expansion, and gating.

### Architecture

The signal is split into three frequency bands by two adjustable crossover points. Each band has independent dynamics processing.

```
Input Signal
  |
  +--[Low Band]----[Dynamics]----+
  |                               |
  +--[Mid Band]----[Dynamics]----+----> Output
  |                               |
  +--[High Band]---[Dynamics]----+
```

### Parameters

| Parameter | Range | Description |
|-----------|-------|-------------|
| Crossover Low | 20 Hz - 20 kHz | Frequency boundary between low and mid bands |
| Crossover High | 20 Hz - 20 kHz | Frequency boundary between mid and high bands |

### Per-Band Controls

Each of the three bands has two independent dynamics processors:

#### Above Threshold (Downward Compression / Limiting)

| Parameter | Range | Description | Musical Effect |
|-----------|-------|-------------|----------------|
| Threshold (T) | -inf to 0 dB | Level above which compression engages | Set to control peaks in that frequency range |
| Ratio (R) | 1:1 to inf:1 | Compression ratio | Higher ratio = more gain reduction above threshold |
| Attack (A) | 0.01 - 1000 ms | Response time | Fast for transient control, slow to let transients through |
| Release (Re) | 1 - 3000 ms | Recovery time | Fast for responsive control, slow for smooth compression |

#### Below Threshold (Upward Expansion / Gating)

| Parameter | Range | Description | Musical Effect |
|-----------|-------|-------------|----------------|
| Threshold (T) | -inf to 0 dB | Level below which expansion/gating engages | Set to target the noise floor or bleed in that band |
| Ratio (R) | 1:1 to inf:1 | Expansion ratio | Higher ratio = more gain reduction below threshold (gating effect) |
| Attack (A) | 0.01 - 1000 ms | Response time | How fast the gate opens |
| Release (Re) | 1 - 3000 ms | Recovery time | How fast the gate closes |

#### Additional Per-Band

| Parameter | Description |
|-----------|-------------|
| Gain | Output gain per band for overall tonal balance |
| Solo | Solo individual bands to hear what's happening in each range |
| Mute | Mute individual bands |

### Recommended Settings by Use Case

#### Taming Low-Mid Mud (e.g., on a drum bus or mix bus)

| Parameter | Setting |
|-----------|---------|
| Low crossover | 120 Hz |
| High crossover | 2.5 kHz |
| Mid band Above threshold | -20 dB, 2:1, Attack 10 ms, Release 100 ms |
| Low and High bands | Bypassed (ratio 1:1) |
| Target | 2-3 dB gain reduction on the mid band when mud frequencies are loud |

This compresses only the 120 Hz - 2.5 kHz range, reducing mud and boxiness without affecting the sub-bass punch or high-frequency sparkle.

#### De-essing (frequency-specific)

| Parameter | Setting |
|-----------|---------|
| High crossover | 5 kHz |
| High band Above threshold | Set threshold to catch sibilant peaks, 4:1, Attack 0.1 ms, Release 50 ms |
| Low and Mid bands | Bypassed |
| Target | 3-6 dB gain reduction on sibilant peaks |

#### Upward Expansion (adding dynamics back)

| Parameter | Setting |
|-----------|---------|
| Below threshold ratio | Less than 1:1 (e.g., 0.5:1) |
| Effect | Boosts signal below the threshold, bringing up quiet details |
| Use case | Restoring dynamics to over-compressed material, adding sustain to drums |

### Practical Tips

- Use the Solo button on each band to hear exactly what's being processed before adjusting dynamics.
- Multiband Dynamics is ideal for problems that exist in only one frequency range — if you need broadband compression, use Compressor or Glue Compressor instead.
- Set crossover points based on the frequency content you want to isolate, not arbitrary round numbers. Solo each band and adjust crossovers until the problem frequency is isolated in one band.
- The Below threshold section can work as a frequency-specific gate — useful for removing low-frequency rumble (gate the low band) without affecting the rest of the signal.
- Each band's output Gain can be used for static tonal adjustment, making this plugin also function as a simple 3-band EQ.
- Be cautious with extreme settings — multiband processing can create phase artifacts at the crossover points. Subtle settings produce the most transparent results.
