# Vocal Processing & Mixing

## Vocal EQ

### Standard Vocal EQ Chain

1. **HPF at 80-120 Hz** (24 dB/oct) -- Remove rumble, plosives, proximity effect buildup. Set the frequency based on the singer: 80 Hz for baritone, 100-120 Hz for tenor/alto/soprano.
2. **Cut 200-400 Hz** (2-4 dB, wide Q) -- Reduce mud and boxiness. This region builds up with close-mic'd vocals and cheap microphones.
3. **Boost 2-4 kHz** (2-4 dB, wide Q) -- Add presence and intelligibility. This is where consonants and vocal clarity live. Be careful not to make the vocal harsh.
4. **De-ess / Cut 5-8 kHz** (narrow, dynamic or static) -- Tame sibilance ("s", "sh", "t" sounds). Better handled by a dedicated de-esser than static EQ.
5. **Boost 8-12 kHz** (2-3 dB, shelf) -- Add air and shimmer. Opens up the vocal and gives it a polished, expensive quality.

### EQ Tips
- Always EQ in context of the full mix, not solo.
- Subtractive EQ first (cut the bad), then additive (boost the good).
- Narrow Q for cutting problem frequencies, wide Q for broad tonal shaping.

## Vocal Compression

### Standard Compression
- **Ratio:** 3:1 to 4:1 -- enough control without obvious squashing.
- **Attack:** Slow, 10-30 ms -- preserves the consonant transients that make vocals intelligible.
- **Release:** Medium, 100-200 ms -- recovers naturally between phrases.
- **Gain Reduction:** 3-6 dB -- consistent level without killing dynamics.
- **Knee:** Soft knee for natural-sounding compression.

### Serial Compression

Using two compressors in series produces more transparent, natural-sounding level control than one compressor working hard:

1. **First compressor (leveler):** Ratio 2:1, slow attack (20-30 ms), auto or slow release, targeting 2-3 dB gain reduction. Gently evens out the overall dynamics.
2. **Second compressor (peak control):** Ratio 4:1-10:1 (or limiter), fast attack (1-5 ms), fast release (30-50 ms), targeting only the loudest peaks for 2-3 dB additional gain reduction.

The combined result: 4-6 dB total gain reduction, but it sounds far more natural than a single compressor doing 6 dB.

## De-Essing

- **What it is:** Frequency-selective compression that only activates on sibilant frequencies (5-8 kHz).
- **Threshold:** Set so it only triggers on "s", "sh", "ch", "t" sounds -- not on the body of the vocal.
- **Frequency:** Sweep the band to find the harshest sibilant frequency for that specific singer (usually 5.5-7.5 kHz).
- **Range:** 3-6 dB of reduction on sibilant peaks. Over-de-essing creates a lisp.
- **Placement:** After EQ (so any high-frequency boosts don't make sibilance worse), before reverb (so sibilance doesn't get amplified by the reverb tail).
- **Split-band vs wideband:** Split-band (only compresses the sibilant frequency) is more transparent. Wideband (compresses the full signal) is more aggressive.

## Vocal Reverb

### Reverb Types for Vocals

| Type | Decay | Character | Use Case |
|------|-------|-----------|----------|
| **Plate** | 1-2 s | Smooth, dense, flattering | Primary vocal reverb. Works on almost everything. |
| **Room** | 0.3-1 s | Tight, natural, present | Keeps vocals upfront and intimate. |
| **Hall** | 2-4 s | Spacious, deep, lush | Ballads, cinematic moments, background vocals. |
| **Chamber** | 1-2 s | Warm, colored, vintage | Soul, R&B, retro-styled vocals. |

### Key Reverb Settings
- **Pre-delay: 20-40 ms** -- Creates a gap between the dry vocal and the reverb onset. This keeps the vocal upfront and intelligible while still having depth. Critical setting.
- **Decay:** Match to tempo. Faster songs need shorter decay so reverb clears before the next phrase.
- **High cut on reverb:** Roll off above 6-8 kHz on the reverb return to prevent harsh, sizzly tails.
- **Low cut on reverb:** Roll off below 200-400 Hz on the reverb return to prevent muddy buildup.
- **Wet/dry:** Use reverb on a send/return (100% wet) and blend to taste. Never put reverb inline on the vocal channel.

## Vocal Delay

### Slap Delay (Width)
- **Time:** 80-120 ms (or set to match a short note division).
- **Feedback:** 0-10% (one or two repeats, not a trail).
- **Stereo:** Pan the delay left and right for width. The vocal stays centered, the delays create space.
- **Use case:** Adds dimension without the wash of reverb. Good for upbeat and rhythmic tracks.

### Rhythmic Delay (Depth)
- **Time:** 1/4 note or dotted 1/8 note (synced to tempo).
- **Feedback:** 15-30% (a few audible repeats that trail off).
- **High cut:** Roll off above 3-5 kHz so the delays sit behind the vocal, not competing with it.
- **Use case:** Fills gaps between phrases. Adds depth and rhythmic interest.

### Throw Delays
- Automate a long delay (1/2 or 1/4 note, 3-4 repeats) to activate only at the end of certain phrases.
- Creates dramatic moments without cluttering the entire vocal performance.

## Vocal Doubling & Width

### Chorus
- Subtle chorus (low rate, low depth) adds width and thickness.
- Keep the mix low (10-20% wet) to avoid an obviously processed sound.

### Micro-Pitch Shift
- Duplicate the vocal to two channels.
- Pitch one up +5-10 cents, the other down -5-10 cents.
- Pan them left and right.
- Blend subtly beneath the main vocal for width and thickness.
- Keep the original centered and loudest.

### ADT (Automatic Double Tracking)
- Short delay (15-30 ms) with slight pitch modulation simulates a double-tracked performance.
- Less predictable and more natural than simple chorus.

## Vocal Rides (Volume Automation)

Compression alone cannot achieve a perfectly consistent vocal level. Manual volume rides are essential:

- **Purpose:** Word-by-word or phrase-by-phrase volume adjustments so the vocal sits at a consistent perceived level in the mix.
- **Method:** Automate the channel fader (or a Utility gain before the compressor) while listening in context.
- **Before compression:** Riding gain before the compressor means the compressor receives a more consistent signal and works more evenly.
- **After compression:** Riding the fader after compression fine-tunes the final level in the mix.
- **Best practice:** Do both. Rough rides before compression, fine rides after.

## Background Vocals

- **Pan wide:** Spread background vocals across the stereo field (hard left/right for doubles, partial panning for harmonies).
- **Cut low mids:** More aggressive cuts in 200-500 Hz than the lead vocal. Background vocals should not compete for the same tonal space.
- **More reverb:** Background vocals benefit from more reverb/delay than the lead. This pushes them further back in the mix and creates depth separation.
- **Less presence:** Reduce the 2-4 kHz boost (or skip it entirely) so backgrounds do not compete with the lead vocal for clarity.
- **Compression:** Heavier compression (4:1-6:1) to keep backgrounds consistent and tucked behind the lead.
- **Bus processing:** Route all background vocals to a single bus for unified compression, EQ, and reverb.

## Acapella Processing

When working with isolated vocals (extracted or studio acapellas) placed over a new beat:

- **Noise reduction:** Extracted acapellas often have artifacts. Use a spectral repair tool or noise gate to clean up.
- **Timing alignment:** The acapella was performed to a different groove. Warp or manually align phrases to fit the new beat's timing.
- **Key matching:** Verify the acapella's key matches (or is compatible with) the new production. Pitch-shift if necessary, but small shifts (1-2 semitones) sound more natural.
- **Reverb matching:** Add reverb/delay that matches the new production's space, not the original.
- **EQ matching:** The acapella was mixed for a different instrumental. Re-EQ to sit in the new mix context.

## Ableton Live Vocal Tools

| Tool | Use Case |
|------|----------|
| **EQ Eight** | Primary vocal EQ. Use in mid/side mode for stereo vocal buses. Spectrum analyzer helps identify problem frequencies. |
| **Compressor** | Standard vocal compression. Use Peak mode for transparent control, RMS for smoother leveling. Sidechain EQ to make it less sensitive to low frequencies. |
| **Glue Compressor** | Bus compression for vocal groups. Adds cohesion to stacked harmonies and doubles. |
| **Erosion** | Can function as a quick de-esser alternative. Set to "Noise" mode, narrow frequency band around 6-7 kHz, low amount. Not a replacement for a proper de-esser but useful in a pinch. |
| **Chorus-Ensemble** | Vocal thickening and subtle doubling. Use the "Classic" mode with low rate and depth for natural width. |
| **Reverb** | Built-in algorithmic reverb. Use the high and low cut controls to shape the reverb tail. Pre-delay for keeping vocals upfront. |
| **Echo** | Tempo-synced delay with built-in filtering and modulation. Good for rhythmic delays and throw delays. Automate the Dry/Wet for phrase-end throws. |
| **Utility** | Gain staging, mono/stereo width control, polarity flip. Place before the compressor for gain riding. |
| **Auto Pan** | Subtle movement on background vocals or delay returns. Use low rate and amount for gentle stereo motion. |
