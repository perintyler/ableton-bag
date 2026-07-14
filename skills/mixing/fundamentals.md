# Mixing Fundamentals — Comprehensive Reference

A complete guide to mixing music, covering gain staging, frequency balance, stereo imaging, depth, dynamics, mix bus processing, reference mixing, and common mistakes. All values and techniques are drawn from professional audio engineering sources.

---

## 1. Gain Staging

Gain staging is the process of managing signal levels at every point in the audio chain to avoid distortion while maintaining optimal signal-to-noise ratio.

### Key Level Targets

| Measurement | Target | Purpose |
|---|---|---|
| Individual track peaks | -10 dBFS | Prevent bus overloading |
| Individual track average (RMS) | -18 dBFS | Sweet spot for most plugins; equivalent to 0 VU |
| Mix bus peak | -6 to -3 dBFS | Leave headroom for mastering |
| Absolute digital ceiling | 0 dBFS | Clipping point — never exceed |

### Signal Flow Principles

1. **Input gain**: Set each track so peaks hit around -10 dBFS and RMS averages around -18 dBFS
2. **Plugin chain**: Monitor levels between plugins. Analog-modeled plugins respond to signal strength like vintage gear — excessive input distorts unpredictably
3. **Bus summing**: When many tracks sum to a bus, levels accumulate. If 20 tracks each peak at -10 dBFS, the bus can easily clip. Use bus faders or trim to manage
4. **Master output**: Target -6 to -3 dBFS peak on the stereo bus to leave 3-6 dB of headroom for mastering

### Plugin Gain Staging

- The -18 dBFS = 0 VU calibration is a common starting point, but not universal
- Many modern plugins expect hotter signals (-12 dBFS or higher)
- Always check a plugin's documentation for its intended operating level
- Use a gain/trim plugin before and after processors to maintain consistent levels
- If a plugin adds gain, compensate with output trim to keep the signal chain level-matched

### Metering Practices

- **Peak meters**: Show instantaneous maximum levels. Use to catch transients and prevent clipping
- **RMS meters**: Show average level over time. Better representation of perceived loudness
- **LUFS meters**: Measure perceived loudness per broadcast standards. Use for final loudness assessment
- Monitor both peak and RMS simultaneously on channel meters
- Set monitors to 85 dB SPL for accurate frequency perception (use an SPL meter to verify)

---

## 2. Frequency Balance & Spectral Mixing

Frequency masking occurs when multiple sounds occupy the same frequency range and one sound hides another due to loudness or spectral dominance. It is rooted in psychoacoustics.

### Common Masking Problem Areas

| Conflict | Frequency Range | Solution |
|---|---|---|
| Kick vs. Bass | 50-150 Hz | Sidechain compression; give kick the sub (40-60 Hz), bass the low-mid (80-150 Hz), or vice versa |
| Vocals vs. Guitars/Keys | 1-5 kHz | Cut 2-4 kHz from instruments to clear vocal presence |
| Snare vs. Guitar | 200-500 Hz | Cut competing frequencies from guitar; boost snare's fundamental |
| Cymbals vs. Vocal sibilance | 6-12 kHz | De-ess vocals; high-shelf cut on cymbals |
| Multiple synth layers | Varies | Arrange layers in different octaves; use timbral contrast |

### Frequency Ranges Reference

| Range | Name | Character |
|---|---|---|
| 20-60 Hz | Sub-bass | Felt more than heard; kick/bass foundation |
| 60-250 Hz | Bass | Warmth, body, fullness; muddiness if excessive |
| 250-500 Hz | Low-mids | Boxiness, muddiness zone; often needs cutting |
| 500 Hz-2 kHz | Midrange | Body, tone, nasal quality; where most instruments live |
| 2-4 kHz | Upper-mids | Presence, clarity, aggression; vocal intelligibility |
| 4-8 kHz | Presence | Brightness, definition, sibilance |
| 8-20 kHz | Air/Brilliance | Sparkle, openness, breath; harshness if excessive |

### EQ Techniques

**Subtractive EQ (Primary Approach)**
- Identify the priority instrument in each frequency range
- Cut competing frequencies from secondary instruments using narrow-to-moderate Q
- Example: Cut 200-400 Hz from guitars to make room for snare body

**High-Pass Filtering**
- Apply to every track that does not need low-end: vocals (80-120 Hz), guitars (80-150 Hz), synths (varies), overheads (200-300 Hz if kick/snare are on separate mics)
- Cleans sub/bass region for kick and bass to occupy

**Dynamic EQ**
- Applies EQ cuts only when problematic frequencies exceed a threshold
- Ideal for occasional overlaps (e.g., bass duck only when kick hits)
- Less destructive than static EQ because it acts only when needed

**Mid/Side EQ**
- Process center (mid) and sides independently
- Keep lead vocal clear in the mid channel
- Boost high-frequency content in the side channel for width without cluttering the center

**Sidechain Compression for Frequency Management**
- Kick triggers bass volume reduction (broadband or multiband)
- Multiband sidechain: target only sub-bass (50-90 Hz) rather than the full signal
- Allows kick transients to punch through while bass recovers

### Additional Spectral Techniques

- **Transient shaping**: Boost attack on drums, shorten sustain on pads/guitars to reduce overlap duration
- **Harmonic enhancement/saturation**: Adds midrange harmonics to bass, shifting spectral content away from congested sub zones
- **Arrangement-level solutions**: Thin out arrangements during busy sections; use timbral contrast (bright vs. dark sounds)

### Detection Methods

1. Solo two potentially conflicting instruments together — listen for clarity loss
2. Use a spectrum analyzer to visualize simultaneous frequency peaks
3. Sum to mono — masking caused by stereo separation becomes obvious
4. Mute the suspected offender — if clarity improves dramatically, masking is confirmed
5. Band-pass filter sweep — isolate frequency ranges to identify muddy zones

---

## 3. Stereo Image & Panning

### Foundational Panning Positions

**Always Center:**
- Lead vocals
- Kick drum
- Snare drum (or slightly off-center)
- Bass guitar / bass synth
- Any sub-bass content

**Pan Moderately (25-50%):**
- Rhythm guitars (often doubled, panned left/right)
- Piano / keys
- Toms (panned across the kit image)
- Background vocals

**Pan Wide (75-100%):**
- Doubled rhythm guitars (hard L/R)
- Drum overheads (hard or near-hard L/R)
- Stereo synth pads
- Percussion and ear candy

### LCR (Left-Center-Right) Panning

LCR restricts panning to only three positions: hard left, dead center, and hard right.

**Benefits:**
- Maximum contrast and stereo width
- Forces you to solve masking with EQ and level rather than hiding it with panning
- Strong mono compatibility because you fix underlying tonal issues
- Creates bold, decisive mixes

**Modified LCR:** Allow intermediate positions (e.g., 50% left) when full extremes feel excessive, but maintain the discipline of decisive placement.

### Haas Effect (Precedence Effect)

1. Duplicate a mono track
2. Pan copies hard left and hard right
3. Delay one side by 5-30 milliseconds
4. Result: wide stereo perception from a single mono source

**Caution:** Causes phase cancellation when summed to mono. Always verify mono compatibility. Shorter delays (5-10 ms) are safer.

### Other Stereo Widening Techniques

**Double-Tracking:**
Record parts multiple times, pan each take opposite directions. Natural timing/tonal variations create organic width without phase issues.

**Micro-Shifting (Pitch-Based Widening):**
Detune one side slightly sharp, the other slightly flat (5-10 cents). Produces breadth and motion without delay artifacts.

**Stereo Reverb and Delay:**
Ping-pong delays bounce echoes between channels. Stereo reverb extends across the full field. Use strategically, not universally.

### Mid/Side (M/S) Processing

- **Mid channel** = left + right (sum) — the center image
- **Side channel** = left - right (difference) — the width
- Boosting side increases width; cutting side narrows the image
- Independent M/S EQ: boost highs on the sides for air/width, keep lows in mid for solidity
- **Caution:** Excessive side boost compromises mono compatibility and can sound hollow

### Mono Compatibility

"If it sounds good in mono, it'll usually sound great in stereo."

**Why check mono:**
- Phone speakers sum to mono
- Club systems often sum bass frequencies to mono
- PA systems may have mono zones
- Bluetooth speakers are often mono

**What mono reveals:**
- Phase cancellation issues (sounds that disappear)
- Frequency masking hidden by stereo separation
- Whether essential parts maintain their presence

**How to check in Ableton:** Use Utility device with Width set to 0%

### Spatial Automation

- Narrow stereo in verses for intimacy; expand in chorus for breadth
- Gradually widen during builds; collapse briefly before drops for dramatic impact
- Automate reverb sends to push/pull elements through space
- Auto-panning via LFO: slow for gentle drift, tempo-synced for rhythmic bounce (use sparingly)

---

## 4. Depth & Space (Front-to-Back Mixing)

Mixing in three dimensions: left-right (panning), up-down (frequency), and front-back (depth).

### The 9 Rules of Depth

**Rule 1: Volume Controls Distance**
Louder elements appear closer. Quieter elements recede. This is the most fundamental depth tool, based on the inverse square law of sound propagation.

**Rule 2: Relative Positioning Creates Depth**
Do not place all elements at the same distance. Create variety: vocals upfront, instruments mid-depth, supporting elements far back.

**Rule 3: High-Frequency Attenuation = Distance**
Air naturally absorbs high frequencies over distance. Apply a low-pass filter (2-8 kHz) or a high-shelf cut to push elements back. Keep leading elements bright and airy.

**Rule 4: Close-Miking Removes Natural Distance Cues**
Close-miked recordings have excessive high frequencies and lack room information. Use de-essing and tonal adjustment to place these sources at appropriate perceived distances.

**Rule 5: Early vs. Late Reflections**
- Early reflections: provide positional information and distance cues
- Late reflections: convey space characteristics (room size, material)
- Use different reverb settings for different elements to establish varied depth

**Rule 6: Pre-Delay is a Perspective Tool**
- Short pre-delay (0-20 ms): source feels close, intimate
- Long pre-delay (40-100 ms): separates dry sound from reverb; source stays upfront while the room opens behind it
- Pre-delay is a positioning tool, not just a timing parameter

**Rule 7: Width Complements Depth**
- Narrow/mono sources can convey depth by pointing to a single location
- Wider sources suggest closer proximity
- Keep reverb wide while varying the width of direct signals

**Rule 8: Low Frequencies Resist Distance Rules**
Bass frequencies resist air absorption and travel farther. Boost lows cautiously on distant sources for realism; avoid excessive cutting.

**Rule 9: Compression Reveals Proximity**
Compression brings out subtle sonic details, making sources sound closer by increasing audible texture. Use compression to enhance the up-front quality of lead elements.

### Reverb Settings for Depth

| Placement | Reverb Type | Decay | Pre-Delay | Wet Level |
|---|---|---|---|---|
| Very front | None or short room | 0.3-0.6s | 0-10 ms | Very low (5-10%) |
| Mid-front | Plate or small room | 0.8-1.2s | 20-40 ms | Low (10-20%) |
| Middle | Medium hall | 1.2-2.0s | 30-60 ms | Moderate (20-35%) |
| Far back | Large hall or cathedral | 2.0-4.0s+ | 50-100 ms | Higher (30-50%) |

### Delay for Depth

- **Slap delay** (1/16, 1/32, 1/64 note): Creates quick depth on almost anything
- **Mono delay**: Creates a "back wall" to define front-to-back dimension
- Pan delay returns close to the original signal (not hard opposite) to settle them into the soundstage
- Shorter delay times = closer; longer = more distant

### EQ for Depth

- Roll off highs (low-pass filter at 2-8 kHz) to push sounds back
- Roll off lows slightly on distant elements for realism
- Bright, full-spectrum sounds feel closer
- Dull, mid-focused sounds feel farther away

### Combining Depth Tools

For each element, ask: "How close should this feel?" Then apply the appropriate combination:

- **Upfront elements** (lead vocal, snare): Louder, brighter, drier, more compressed, shorter/no reverb
- **Mid-depth elements** (rhythm guitars, keys): Moderate level, some HF rolloff, moderate reverb with pre-delay
- **Background elements** (pads, ambient textures): Quieter, darker (LPF), wetter, less compressed, longer reverb

---

## 5. Dynamic Control

### Compression Fundamentals

**Key Parameters:**
- **Threshold**: Level above which compression begins. Lower threshold = more compression
- **Ratio**: Amount of compression (2:1 means 2 dB of input above threshold yields 1 dB of output)
- **Attack**: How quickly compression engages (fast = catches transients; slow = lets transients through)
- **Release**: How quickly compression stops after signal drops below threshold
- **Knee**: Hard = abrupt onset; Soft = gradual onset
- **Makeup gain**: Compensates for level reduction caused by compression

### Compression Settings by Instrument

| Instrument | Ratio | Attack | Release | Notes |
|---|---|---|---|---|
| Kick drum | Medium-High | 10-20 ms | 50-100 ms | Catches transient for tight, punchy sound |
| Snare drum | Moderate | 5-15 ms | 100-200 ms | Hard knee for aggressive compression |
| Bass | Lower | 20-40 ms | 100-200 ms | Let initial transient pass through |
| Vocals | 2:1 to 3:1 | 10-30 ms | 100-200 ms | Soft knee for smooth, musical compression |
| Drum bus | 4:1 | 10-30 ms | Auto or 100-200 ms | Glue the kit together |
| Mix bus | 2:1 or less | 10-30 ms | <50 ms | 1-2 dB gain reduction maximum |

### Serial Compression

Using multiple compressors in sequence on a single track, each doing a small amount of work.

**Classic Chain: Fast then Slow**
1. First compressor (e.g., 1176-style): Fast attack, higher ratio — catches transient peaks, increases short-term consistency
2. Second compressor (e.g., LA-2A style): Slower, lower ratio — handles long-term level variations

**Why it works:** More transparent than a single compressor doing heavy lifting. The attack of the second compressor is masked by the simultaneous movement of the first. Classic example: 1176 into LA-2A for vocals.

**Vocal serial chain example:**
- Compressor 1: Ratio 8:1, fast attack — tame peaks, keep vocal controlled
- Compressor 2: Ratio 2:1-3:1, moderate attack (10-30 ms), release 100-200 ms — smooth out remaining dynamics

### Parallel Compression (New York Compression)

Blend a heavily compressed signal with the original uncompressed signal:
1. Send track to an auxiliary bus
2. Apply heavy compression on the aux (high ratio, fast attack)
3. Blend the compressed return underneath the dry signal
4. Result: Preserves natural dynamics and transients while adding density and sustain

Especially effective on drums, vocals, and full mix bus.

### Dynamic Range Targets by Context

| Dynamic Range | Character | Use Case |
|---|---|---|
| Under 4 dB | Crushed | Distorted, brittle, fatiguing. Avoid. |
| 4-6 dB | Squashed | Limiter is audibly pumping. Intentionally slammed masters only. |
| 6-9 dB | Dense | Warm, controlled. Trading snap for sustain. EDM/Hip-Hop territory. |
| 9-12 dB | Healthy | Sweet spot for most genres. Kicks have thump and body. |
| 12-16 dB | Punchy | Maximum transient impact. Classical, jazz, acoustic. |

### Section-Specific Dynamic Range

| Song Section | Target DR | Rationale |
|---|---|---|
| Intros/Breakdowns | 10-14 dB | Allow breathing room |
| Verses | 8-12 dB | Maintain vocal clarity |
| Choruses/Drops | 6-10 dB | Denser is acceptable |
| Build-ups | 8-12 dB, dropping to 6-8 | Energy increase before drop |

### Loudness Standards (LUFS)

| Platform | Target LUFS | Notes |
|---|---|---|
| Spotify | -14 LUFS | Normalizes to this; louder tracks turned down |
| Apple Music | -16 LUFS | Slightly quieter target |
| YouTube | -14 LUFS | Normalizes loudly mastered content down |
| Tidal | -14 LUFS | Same as Spotify |
| Amazon Music | -14 LUFS | Same as Spotify |
| Club/DJ masters | -6 to -10 short-term LUFS | Intentionally louder for club systems |

**Key insight:** Streaming normalization rewards dynamics, not volume. After normalization, a track with more transient impact sounds louder than one that measured higher on the meter pre-normalization.

### Volume Automation

- Use fader automation for brief loud passages instead of applying broad compression
- Automate vocal levels phrase-by-phrase for consistency before compression
- Ride faders on dynamic instruments (horns, strings) to maintain presence
- Automate compression threshold or ratio for section-specific dynamics

---

## 6. Mix Bus Processing

### Recommended Chain Order

```
Signal Flow:
  High-Pass Filter (optional)
  → Corrective EQ
  → Glue Compression
  → Tonal/Color EQ
  → Saturation (optional)
  → Stereo Imaging (optional)
  → Limiter (mastering only — do NOT put on mix bus if sending to mastering)
```

### High-Pass Filter
- Set below 20-30 Hz
- Removes subsonic rumble without affecting audible content
- Cleans up headroom for downstream processing

### Corrective EQ (Pre-Compression)
EQ before compression so the compressor reacts to a signal with correct tonal balance.

| Adjustment | Frequency | Amount |
|---|---|---|
| Kick/bass warmth | 50-60 Hz | +1 to +2 dB shelf |
| Remove boxiness | 300-500 Hz | -1 to -2 dB notch |
| Add air | 8-12 kHz | +1 to +2 dB shelf |
| Subsonic cleanup | Below 25-30 Hz | High-pass filter |

**Critical rule:** Keep adjustments small — 1-2 dB maximum. If you need more than 3 dB, fix it at the track level.

### Glue Compression

| Parameter | Setting | Notes |
|---|---|---|
| Ratio | 1.5:1 to 2:1 | Gentle; just enough to glue |
| Attack | 10-30 ms (slow-moderate) | 40-80 ms for mastering chain |
| Release | Program-dependent or <50 ms | Auto-release often works well |
| Gain Reduction | 1-3 dB maximum | At loudest points; more for dance/hip-hop |
| Knee | Soft | For transparent glue |

The SSL G-Bus compressor style is the classic choice: "very grabby, very musical, and it makes things punch."

### Tonal EQ (Post-Compression)
Applied after compression for final polish:
- High shelf boost for brightness
- Low shelf boost for warmth
- Presence adjustments in the 2-5 kHz range

### Saturation
- Tape emulation smooths overly digital mixes by absorbing transients gently
- 1-2 dB of harmonic enhancement maximum
- Adds analog warmth and character
- Applying on the master (rather than individual tracks) prevents cumulative saturation buildup
- Use sparingly to avoid blurring transient detail

### Stereo Imaging
- Expand frequencies above 3 kHz in the side channel for air and width
- Keep everything below 150 Hz in mono for a solid, focused low end
- M/S processing: boost sides subtly for width; do not overdo it
- Check mono compatibility after any stereo widening

### What NOT to Put on the Mix Bus
- Limiters (leave for mastering)
- Heavy reverb or delay
- De-essers
- Extreme EQ moves
- Modulation effects

### When to Add Mix Bus Processing
**Option A — From the start:** Add bus processing early and mix into it. It becomes part of the sonic environment. Provides psychological boost and final-sound context.

**Option B — At the end:** Add as a polish step after the mix is balanced. Prevents over-reliance on bus processing to fix mix issues.

Both approaches are valid. Many professionals mix into their bus chain from the start.

---

## 7. Reference Mixing

### Why Reference

- Resets fatigued ears
- Prevents extreme decisions (too much bass, too bright, etc.)
- Reveals frequency balance issues by comparison
- Accelerates the mixing process
- Establishes context for making intentional creative choices

### Reference Selection Strategy

Use three types:
1. **Rough mixes**: Your own baseline — what you are improving upon
2. **Client/artist references**: Their sonic goals and aesthetic targets
3. **Professional favorites**: Commercially released tracks in a similar genre that you admire sonically

### Level Matching (Critical)

Our brains interpret louder as better. Without level matching, you will always prefer the louder track.

- Mastered reference tracks are typically 6-9 dB louder than an unmastered mix
- **Reduce the reference track by approximately 6-9 dB** to match your mix's loudness
- Use a LUFS meter to match integrated loudness precisely
- Example: If your mix reads -17 LUFS short-term, bring the reference down to -17 LUFS short-term
- Monitoring at 85 dB SPL provides the flattest frequency perception

### A/B Comparison Method

1. Import reference tracks into your session on a dedicated track routed directly to the master output (bypassing mix bus processing)
2. Take 10-minute silence breaks to rest ears
3. Switch quickly between 5-second clips of reference and mix
4. Trust your first impression — initial judgments reveal critical differences before ear fatigue

### What to Compare

- **Frequency balance**: Is your low end comparable? Is the top end as smooth/bright? Any harshness?
- **Individual elements**: Compare snare to snare, kick to kick, vocal to vocal
- **Level relationships**: Is the vocal sitting at the same relative level?
- **Stereo width**: How wide is the reference vs. your mix?
- **Dynamics**: How punchy/compressed does the reference feel?
- **Depth**: How much front-to-back space does the reference have?
- **Compare like sections**: Chorus to chorus, verse to verse

### Tools for Reference Mixing

- **Spectrum analyzer**: Compare frequency distribution visually (e.g., Tonal Balance Control)
- **LUFS meter**: Match loudness for fair comparison
- **Correlation meter**: Check phase/mono compatibility
- **Dedicated reference plugins**: ADPTR Metric AB, Mastering the Mix REFERENCE 3

---

## 8. Common Mixing Mistakes

### Mistake 1: Over-Processing with Too Many Plugins
**Problem:** Stacking plugins haphazardly creates cumulative artifacts, phase issues, and tonal degradation.
**Fix:** Before adding any plugin, identify exactly what you are trying to achieve. Limit yourself to 2-3 purposeful plugins initially per track. Each processor should have a specific, articulable job.

### Mistake 2: Forcing Sounds Into Unnatural Territory
**Problem:** Over-processing until a source becomes something entirely different from its original character. Fighting the source material wastes effort.
**Fix:** Ask whether you are serving or fighting the sound. If struggling, strip back processing and rediscover what works with restraint.

### Mistake 3: Mixing Without Clear Intentions
**Problem:** Beginning a mix without predetermined goals leads to aimless, time-consuming work.
**Fix:** Create a "punch list" before mixing. Listen to the rough mix and write specific intentions for each element: "Add room to drums," "Get vocal upfront and intimate," "Bass needs more definition in 800 Hz range."

### Mistake 4: Ignoring Gain Staging
**Problem:** Treating all DAW mixing as if floating-point math makes gain irrelevant. Analog-modeled plugins respond to signal strength.
**Fix:** Treat DAW signal flow like an analog console. Keep peaks around -10 dBFS, averages around -18 dBFS per track.

### Mistake 5: Overlooking Phase Relationships
**Problem:** Phase issues cause "washy" drums, thin bass, and loss of body. Sounds can partially or fully cancel.
**Fix:** For multi-mic sources (especially drums), check polarity systematically. Flip one overhead against the other — whichever sounds more cohesive is correct. In-phase combinations show higher levels on meters.

### Mistake 6: Excessive Effects on Every Track
**Problem:** Reverb and delay on everything creates "pea soup" — muddy, unfocused, lacking clarity.
**Fix:** Limit yourself to 4-5 reverbs across an entire mix. Apply effects selectively and with specific purpose. Not every track needs reverb.

### Mistake 7: Soloing Too Much
**Problem:** Mixing individual sounds in isolation for extended periods destroys context and perspective.
**Fix:** Use solo sparingly — only for brief moments addressing specific problems (finding a resonant frequency, checking noise). Mix predominantly in full context. Solo groups of related tracks (drums + bass) briefly for micro-balancing.

### Mistake 8: Neglecting Timing and Tuning
**Problem:** Mixing cannot compensate for fundamental performance issues. Off-key or off-time material compromises all mixing decisions.
**Fix:** Address tuning and timing before mixing begins. Use pitch correction and time alignment as needed.

### Mistake 9: The "Smile Curve" (Excessive Bass and Treble)
**Problem:** Boosting both low and high frequencies excessively causes ear fatigue and poor translation across playback systems.
**Fix:** Reference against known standards. If a mastering processor works hard to reduce your lows and highs, you have over-boosted. Train your ears with consistent referencing over time.

### Mistake 10: Skipping Reference Tracks
**Problem:** Without references, mixes drift toward extreme decisions. Ear fatigue goes undetected.
**Fix:** Always have 2-3 reference tracks loaded in your session. Compare regularly. References do not homogenize your work — they establish context for making different choices intelligently.

### Mistake 11: Mixing Too Loud
**Problem:** Above 90 dB SPL, your ears compress as a self-protection mechanism. Mixes made at excessive volume have problems with instrument balance when played back at normal levels.
**Fix:** Mix at moderate levels (75-85 dB SPL). Check your mix at very low levels periodically — if the balance holds at whisper volume, it will hold anywhere.

### Mistake 12: No Mix Hierarchy
**Problem:** Every element at the same level. No clear star of the mix. Vocal buried or too loud.
**Fix:** Decide what the most important element is (usually vocals) and build the mix around it. Create clear foreground, midground, and background layers.

---

## Quick Reference: Mix Checklist

- [ ] Gain staging: tracks peaking around -10 dBFS, averaging -18 dBFS
- [ ] High-pass filter on everything that does not need low end
- [ ] Frequency masking addressed between competing instruments
- [ ] Clear panning decisions (center anchors, supporting elements spread)
- [ ] Mono compatibility verified (check with Utility at 0% width)
- [ ] Depth established: front elements dry/bright, back elements wet/dark
- [ ] Compression serving the song (not squashing dynamics)
- [ ] Mix bus processing subtle (1-3 dB compression, 1-2 dB EQ moves)
- [ ] Referenced against 2-3 professional tracks (level-matched)
- [ ] Listened at multiple volumes (low, moderate, loud)
- [ ] Checked on multiple systems (monitors, headphones, phone speaker)
- [ ] Master bus peaking at -6 to -3 dBFS (headroom for mastering)

---

## Sources

- [Gain Staging Secrets — Audio University](https://audiouniversityonline.com/gain-staging/)
- [Headroom in Audio — LANDR](https://blog.landr.com/headroom-audio/)
- [Frequency Masking: Techniques for Mix Clarity — MasteringBOX](https://www.masteringbox.com/learn/frequency-masking)
- [Spectral Balance and Spectral Mixing — sonible](https://www.sonible.com/blog/spectral-balance-spectral-mixing/)
- [Stereo Balance in Mixing: Complete Guide — MasteringBOX](https://www.masteringbox.com/learn/stereo-balance)
- [LCR Panning Pros and Cons — Sound On Sound](https://www.soundonsound.com/techniques/lcr-panning-pros-and-cons)
- [The 9 Rules of Depth — sonible](https://www.sonible.com/blog/rules-of-depth/)
- [Mix Depth: Front-Back Space — iZotope](https://www.izotope.com/en/learn/what-is-mix-depth-how-to-create-front-back-space.html)
- [Loud Without Losing Dynamics — Phil Speiser](https://www.philspeiser.com/blog/loud-without-losing-dynamics)
- [Mastering the Art of Limiting and Loudness — Mastering the Mix](https://www.masteringthemix.com/blogs/learn/mastering-the-art-of-limiting-and-loudness)
- [Best Compression Settings for a Punchy Mix — Mastering the Mix](https://www.masteringthemix.com/blogs/learn/best-compression-settings-for-a-punchy-mix)
- [8 Mix Buss Tips — Waves](https://www.waves.com/8-mix-buss-compression-eq-saturation-tips)
- [Mastering Chain Order — Audio Spectra](https://audiospectra.net/mastering-chain-order/)
- [13 Tips for Using References — iZotope](https://www.izotope.com/en/learn/13-tips-for-using-references-while-mixing)
- [10 Beginner Mistakes to Avoid — iZotope](https://www.izotope.com/en/learn/10-beginner-mistakes-to-avoid-when-mixing-music.html)
- [5 Biggest Mixing Mistakes — Sound On Sound](https://www.soundonsound.com/techniques/5-biggest-mixing-mistakes-and-how-avoid-them)
- [Serial Compression — Eddie Al-Shakarchi](http://www.edboogie.com/blog/2017/12/12/the-science-of-art-serial-compression-s3lzl)
