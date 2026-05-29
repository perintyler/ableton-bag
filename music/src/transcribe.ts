import { exec, which } from './exec.js'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export interface TranscribedNote {
  /** MIDI note number (0-127) */
  pitch: number
  /** Start time in seconds */
  startTime: number
  /** End time in seconds */
  endTime: number
  /** Estimated velocity (0-127) */
  velocity: number
  /** Model confidence (0-1) */
  confidence: number
}

export interface TranscriptionResult {
  notes: TranscribedNote[]
}

export interface TranscribeOptions {
  /** Path to python executable (default: searches for audio-tools-venv or system python) */
  python?: string
  /** Minimum energy for an onset to be considered present (default: 0.5) */
  onsetThreshold?: number
  /** Minimum energy for a frame to be considered present (default: 0.3) */
  frameThreshold?: number
  /** Minimum note length in milliseconds (default: 58) */
  minNoteLength?: number
  /** Minimum output frequency in Hz (default: no limit) */
  minimumFrequency?: number
  /** Maximum output frequency in Hz (default: no limit) */
  maximumFrequency?: number
}

const TRANSCRIBE_SCRIPT = `
import sys, json, os

os.environ['BASIC_PITCH_FORCE_ONNX'] = '1'

try:
    from basic_pitch.inference import predict
except ImportError:
    print(json.dumps({"error": "basic-pitch is not installed. Install with: pip install basic-pitch onnxruntime"}))
    sys.exit(0)

audio_path = sys.argv[1]
onset_threshold = float(sys.argv[2])
frame_threshold = float(sys.argv[3])
min_note_length = float(sys.argv[4])
min_freq = float(sys.argv[5]) if sys.argv[5] != 'null' else None
max_freq = float(sys.argv[6]) if sys.argv[6] != 'null' else None

try:
    model_output, midi_data, note_events = predict(
        audio_path,
        onset_threshold=onset_threshold,
        frame_threshold=frame_threshold,
        minimum_note_length=min_note_length,
        minimum_frequency=min_freq,
        maximum_frequency=max_freq,
    )

    notes = []
    for event in note_events:
        start_time, end_time, pitch, amplitude, pitch_bends = event
        # amplitude from basic-pitch is 0-1, scale to MIDI velocity 1-127
        velocity = max(1, min(127, int(round(amplitude * 127))))
        # confidence: use mean of per-frame confidences if available, else use amplitude
        if pitch_bends is not None and len(pitch_bends) > 0:
            conf = sum(int(x) for x in pitch_bends) / len(pitch_bends)
        else:
            conf = float(amplitude)
        notes.append({
            "pitch": int(pitch),
            "startTime": round(float(start_time), 6),
            "endTime": round(float(end_time), 6),
            "velocity": velocity,
            "confidence": round(min(1.0, max(0.0, conf)), 4),
        })

    print(json.dumps({"notes": notes}))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`

async function findPython(explicit?: string): Promise<string> {
  if (explicit) return explicit

  // Prefer audio-tools-venv
  const venvPython = join(
    process.env.HOME ?? '~',
    'audio-tools-venv',
    'bin',
    'python'
  )
  const venvPath = await which(venvPython).catch(() => null)
  if (venvPath) return venvPython

  // Fallback to system python3
  const py3 = await which('python3')
  if (py3) return 'python3'

  throw new Error(
    'No Python interpreter found. Install python3 or set options.python'
  )
}

/**
 * Transcribe polyphonic audio to MIDI note events using Spotify's basic-pitch model.
 *
 * This uses an ONNX-based neural network that can detect multiple simultaneous
 * pitches (chords, polyphony), unlike pyin which is monophonic only.
 *
 * Requires basic-pitch and onnxruntime to be installed in the Python environment:
 *   pip install basic-pitch onnxruntime
 *
 * @param filePath - Path to the audio file (WAV, MP3, FLAC, etc.)
 * @param options - Transcription options
 * @returns Note events with pitch, timing, velocity, and confidence
 */
export async function transcribePolyphonic(
  filePath: string,
  options?: TranscribeOptions
): Promise<TranscriptionResult> {
  const python = await findPython(options?.python)

  const onsetThreshold = options?.onsetThreshold ?? 0.5
  const frameThreshold = options?.frameThreshold ?? 0.3
  const minNoteLength = options?.minNoteLength ?? 58
  const minFreq = options?.minimumFrequency != null ? String(options.minimumFrequency) : 'null'
  const maxFreq = options?.maximumFrequency != null ? String(options.maximumFrequency) : 'null'

  // Write the script to a temp file to avoid shell escaping issues
  const scriptPath = join(tmpdir(), `basic-pitch-${randomUUID()}.py`)
  await writeFile(scriptPath, TRANSCRIBE_SCRIPT, 'utf-8')

  try {
    const { stdout } = await exec(python, [
      scriptPath,
      filePath,
      String(onsetThreshold),
      String(frameThreshold),
      String(minNoteLength),
      minFreq,
      maxFreq,
    ], { timeout: 600_000, maxBuffer: 100 * 1024 * 1024 })

    const result = JSON.parse(stdout.trim())

    if (result.error) {
      throw new Error(`basic-pitch error: ${result.error}`)
    }

    return result as TranscriptionResult
  } finally {
    await unlink(scriptPath).catch(() => {})
  }
}
