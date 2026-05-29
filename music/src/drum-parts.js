import { exec } from './exec.js';
import { mkdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { detectOnsets } from './onset.js';
import { GM_DRUMS, writeMidiFile, } from './midi.js';
/**
 * Find the Python interpreter, preferring the audio-tools venv.
 */
async function findPython() {
    const { existsSync: exists } = await import('node:fs');
    const { join: joinPath } = await import('node:path');
    const venvPython = joinPath(process.env.HOME ?? '', 'audio-tools-venv', 'bin', 'python3');
    if (exists(venvPython))
        return venvPython;
    return 'python3';
}
/**
 * Isolate drum parts (kick, snare, hihat) from a drum audio file
 * using frequency-domain filtering via Python/scipy.
 *
 * Frequency ranges:
 * - Kick: lowpass at 250 Hz
 * - Snare: bandpass 200-5000 Hz, then subtract lowpass 300 Hz to remove kick bleed
 * - Hihat: bandpass 3000-16000 Hz
 */
export async function isolateDrumParts(drumsFile, outputDir, options) {
    await mkdir(outputDir, { recursive: true });
    const sr = options?.sr ?? 44100;
    const python = await findPython();
    const base = basename(drumsFile, extname(drumsFile));
    const kickPath = join(outputDir, `${base}_kick.wav`);
    const snarePath = join(outputDir, `${base}_snare.wav`);
    const hihatPath = join(outputDir, `${base}_hihat.wav`);
    const script = `
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
import subprocess, sys, tempfile, os

input_file = sys.argv[1]
output_dir = sys.argv[2]
sr_target = int(sys.argv[3])
kick_out = sys.argv[4]
snare_out = sys.argv[5]
hihat_out = sys.argv[6]

# Convert to wav first using ffmpeg for broad format support
tmp_wav = os.path.join(tempfile.gettempdir(), 'drum_parts_input.wav')
subprocess.run(
    ['ffmpeg', '-y', '-i', input_file, '-ar', str(sr_target), '-ac', '1', tmp_wav],
    capture_output=True, check=True
)

sr, data = wavfile.read(tmp_wav)

# Normalize to float
if data.dtype == np.int16:
    data = data.astype(np.float32) / 32768.0
elif data.dtype == np.int32:
    data = data.astype(np.float32) / 2147483648.0
elif data.dtype == np.uint8:
    data = (data.astype(np.float32) - 128.0) / 128.0

# Make mono if needed
if len(data.shape) > 1:
    data = np.mean(data, axis=1)

def butter_filter(data, sr, low=None, high=None, order=5):
    if low is not None and high is not None:
        sos = butter(order, [low, high], btype='band', fs=sr, output='sos')
    elif low is not None:
        sos = butter(order, low, btype='high', fs=sr, output='sos')
    elif high is not None:
        sos = butter(order, high, btype='low', fs=sr, output='sos')
    else:
        return data
    return sosfilt(sos, data)

# Kick: lowpass at 250 Hz
kick = butter_filter(data, sr, high=250)

# Snare: bandpass 200-5000 Hz, then subtract lowpass 300 Hz to remove kick bleed
snare_full = butter_filter(data, sr, low=200, high=5000)
snare_kick_bleed = butter_filter(snare_full, sr, high=300)
snare = snare_full - snare_kick_bleed

# Hihat: bandpass 3000-16000 Hz
hihat = butter_filter(data, sr, low=3000, high=min(16000, sr // 2 - 1))

def save_wav(path, audio, sr):
    # Normalize to prevent clipping
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio / peak * 0.95
    wavfile.write(path, sr, (audio * 32767).astype(np.int16))

save_wav(kick_out, kick, sr)
save_wav(snare_out, snare, sr)
save_wav(hihat_out, hihat, sr)

# Clean up
os.remove(tmp_wav)

print('ok')
`;
    await exec(python, [
        '-c', script,
        drumsFile, outputDir, String(sr),
        kickPath, snarePath, hihatPath,
    ], { timeout: 120_000 });
    return {
        kick: kickPath,
        snare: snarePath,
        hihat: hihatPath,
    };
}
/**
 * Convert onset times (in seconds) to Ableton-ready note arrays
 * with quantization to the given tempo grid.
 */
function onsetsToAbletonNotes(onsets, pitch, tempo, quantizeDivision) {
    const beatsPerSecond = tempo / 60;
    const gridBeats = 4 / quantizeDivision; // grid size in beats
    const seen = new Set();
    const notes = [];
    for (const onset of onsets) {
        const rawBeat = onset.time * beatsPerSecond;
        const quantizedBeat = Math.round(rawBeat / gridBeats) * gridBeats;
        // Round to avoid floating point duplicates
        const roundedBeat = Math.round(quantizedBeat * 10000) / 10000;
        if (seen.has(roundedBeat))
            continue;
        seen.add(roundedBeat);
        notes.push({
            pitch,
            time: roundedBeat,
            duration: gridBeats,
            velocity: Math.max(1, Math.min(127, onset.velocity)),
        });
    }
    return notes.sort((a, b) => a.time - b.time);
}
/**
 * Extract drum MIDI from an audio file by isolating parts and detecting onsets.
 *
 * Process:
 * 1. Isolate kick, snare, and hihat via frequency filtering
 * 2. Run onset detection on each isolated part
 * 3. Quantize to the given tempo grid
 * 4. Return Ableton-ready note arrays with GM drum pitches
 *
 * Also saves individual MIDI files to the output directory.
 */
export async function extractDrumMidi(drumsFile, outputDir, options) {
    const { tempo, quantize: quantizeDivision = 16 } = options;
    // Step 1: Isolate drum parts
    const parts = await isolateDrumParts(drumsFile, outputDir);
    // Step 2: Detect onsets on each part
    const [kickOnsets, snareOnsets, hihatOnsets] = await Promise.all([
        detectOnsets(parts.kick, { minimumInterval: 0.08 }),
        detectOnsets(parts.snare, { minimumInterval: 0.06 }),
        detectOnsets(parts.hihat, { minimumInterval: 0.04 }),
    ]);
    // Step 3: Convert to Ableton notes with quantization
    const kickNotes = onsetsToAbletonNotes(kickOnsets, GM_DRUMS.KICK, tempo, quantizeDivision);
    const snareNotes = onsetsToAbletonNotes(snareOnsets, GM_DRUMS.SNARE, tempo, quantizeDivision);
    const hihatNotes = onsetsToAbletonNotes(hihatOnsets, GM_DRUMS.CLOSED_HIHAT, tempo, quantizeDivision);
    // Step 4: Save individual MIDI files
    const base = basename(drumsFile, extname(drumsFile));
    const beatsPerSecond = tempo / 60;
    const toMidiNotes = (notes) => notes.map((n) => ({
        pitch: n.pitch,
        start: n.time / beatsPerSecond,
        duration: n.duration / beatsPerSecond,
        velocity: n.velocity,
        channel: 9,
    }));
    await Promise.all([
        writeMidiFile(join(outputDir, `${base}_kick.mid`), {
            tempo,
            tracks: [{ name: 'Kick', notes: toMidiNotes(kickNotes), isDrum: true }],
        }),
        writeMidiFile(join(outputDir, `${base}_snare.mid`), {
            tempo,
            tracks: [{ name: 'Snare', notes: toMidiNotes(snareNotes), isDrum: true }],
        }),
        writeMidiFile(join(outputDir, `${base}_hihat.mid`), {
            tempo,
            tracks: [{ name: 'HiHat', notes: toMidiNotes(hihatNotes), isDrum: true }],
        }),
    ]);
    return {
        kick: kickNotes,
        snare: snareNotes,
        hihat: hihatNotes,
    };
}
/**
 * Split a large note array into batches for Ableton MCP tool calls.
 * Default batch size is 200 notes.
 */
export function drumNotesToBatches(notes, batchSize = 200) {
    const batches = [];
    for (let i = 0; i < notes.length; i += batchSize) {
        batches.push(notes.slice(i, i + batchSize));
    }
    return batches;
}
