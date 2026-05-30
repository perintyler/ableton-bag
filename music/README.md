# @barry/music

Audio processing library for stem separation, frequency filtering, onset detection, MIDI generation, DSP (FFT/MFCC), timbre analysis/comparison, drum part isolation, and harshness/clash detection. Wraps tools like Demucs and Basic Pitch.

---

**What it does:** Full audio analysis and processing pipeline for music production workflows.

**Used by:** `tools/ableton` MCP tool (the only consumer).

**Assessment:** Non-essential to core Barry. Specialized domain package supporting a single MCP tool for Ableton Live integration. Removable if music production tooling isn't in active use. Significant code for a narrow use case.
