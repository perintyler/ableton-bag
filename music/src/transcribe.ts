import { loadAudio } from './dsp.js'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
  /** Path to the ONNX model file (default: searches standard locations) */
  onnxModelPath?: string
}

// ---------------------------------------------------------------------------
// Constants matching basic-pitch model parameters
// ---------------------------------------------------------------------------

const BASIC_PITCH_SAMPLE_RATE = 22050
const FFT_HOP = 256
const ANNOTATIONS_FPS = Math.floor(BASIC_PITCH_SAMPLE_RATE / FFT_HOP) // 86
const AUDIO_WINDOW_LENGTH_SECONDS = 2
const AUDIO_N_SAMPLES = BASIC_PITCH_SAMPLE_RATE * AUDIO_WINDOW_LENGTH_SECONDS - FFT_HOP // 43844
const N_OVERLAPPING_FRAMES = 30
const OVERLAP_LENGTH = N_OVERLAPPING_FRAMES * FFT_HOP // 7680
const HOP_SIZE = AUDIO_N_SAMPLES - OVERLAP_LENGTH // 36164

// ONNX model I/O names
const ONNX_INPUT_NAME = 'serving_default_input_2:0'
// Output mapping (verified against Python basic_pitch source):
//   StatefulPartitionedCall:1 -> note (frames)  [batch, 172, 88]
//   StatefulPartitionedCall:2 -> onset           [batch, 172, 88]
//   StatefulPartitionedCall:0 -> contour         [batch, 172, 264]
const ONNX_OUTPUT_NOTE = 'StatefulPartitionedCall:1'
const ONNX_OUTPUT_ONSET = 'StatefulPartitionedCall:2'
const ONNX_OUTPUT_CONTOUR = 'StatefulPartitionedCall:0'

/**
 * Convert minNoteLen from milliseconds to frames.
 * minNoteLen is in milliseconds; the post-processing uses frame counts.
 */
function msToFrames(ms: number): number {
  return Math.max(1, Math.round((ms / 1000) * ANNOTATIONS_FPS))
}

/**
 * Find the ONNX model file. Search order:
 *   1. Explicit path via options.onnxModelPath
 *   2. Bundled model at music/models/basic-pitch-nmp.onnx
 *   3. Python venv fallback at ~/audio-tools-venv/.../nmp.onnx
 */
function findOnnxModel(explicit?: string): string {
  if (explicit) {
    if (!existsSync(explicit)) {
      throw new Error(`ONNX model not found at: ${explicit}`)
    }
    return explicit
  }

  // Bundled with @barry/music package
  const bundledPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'models', 'basic-pitch-nmp.onnx')
  if (existsSync(bundledPath)) return bundledPath

  // Python venv fallback
  const home = process.env.HOME ?? '~'
  const venvCandidates = [
    join(home, 'audio-tools-venv/lib/python3.13/site-packages/basic_pitch/saved_models/icassp_2022/nmp.onnx'),
    join(home, 'audio-tools-venv/lib/python3.12/site-packages/basic_pitch/saved_models/icassp_2022/nmp.onnx'),
    join(home, 'audio-tools-venv/lib/python3.11/site-packages/basic_pitch/saved_models/icassp_2022/nmp.onnx'),
  ]

  for (const candidate of venvCandidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error(
    'basic-pitch ONNX model not found. Copy the model to the package:\n' +
    '  cp ~/audio-tools-venv/lib/python3.13/site-packages/basic_pitch/saved_models/icassp_2022/nmp.onnx music/models/basic-pitch-nmp.onnx\n' +
    'Or pass options.onnxModelPath explicitly.\n' +
    `Searched: ${bundledPath}, ${venvCandidates.join(', ')}`
  )
}

/**
 * Window the audio signal into overlapping frames, matching basic-pitch's windowing.
 */
function windowAudio(audio: Float32Array): Float32Array[] {
  const windows: Float32Array[] = []
  let start = 0
  while (start <= audio.length - AUDIO_N_SAMPLES) {
    windows.push(audio.slice(start, start + AUDIO_N_SAMPLES))
    start += HOP_SIZE
  }
  // Handle remaining audio with zero-padding
  if (start < audio.length) {
    const lastWindow = new Float32Array(AUDIO_N_SAMPLES)
    const remaining = audio.length - start
    lastWindow.set(audio.slice(start, start + Math.min(remaining, AUDIO_N_SAMPLES)))
    windows.push(lastWindow)
  }
  return windows
}

/**
 * Convert a flat Float32Array from ONNX output into a 2D array [frames][bins].
 */
function reshapeOutput(data: Float32Array, frames: number, bins: number): number[][] {
  const result: number[][] = []
  for (let f = 0; f < frames; f++) {
    const row: number[] = []
    for (let b = 0; b < bins; b++) {
      row.push(data[f * bins + b])
    }
    result.push(row)
  }
  return result
}

/**
 * Unwrap batched model output: remove overlap frames and trim to original length.
 */
function unwrapOutput(batches: number[][][], audioOriginalLength: number): number[][] {
  const nOlap = Math.floor(N_OVERLAPPING_FRAMES / 2) // 15
  const nOutputFramesOriginal = Math.floor(
    audioOriginalLength * (ANNOTATIONS_FPS / BASIC_PITCH_SAMPLE_RATE)
  )

  // Trim overlap from each batch and concatenate
  const trimmed: number[][] = []
  for (const batch of batches) {
    if (nOlap > 0 && batch.length > 2 * nOlap) {
      for (let i = nOlap; i < batch.length - nOlap; i++) {
        trimmed.push(batch[i])
      }
    } else {
      trimmed.push(...batch)
    }
  }

  // Trim to original audio length
  return trimmed.slice(0, nOutputFramesOriginal)
}

// ---------------------------------------------------------------------------
// Pure TypeScript implementation using onnxruntime-node + @spotify/basic-pitch post-processing
// ---------------------------------------------------------------------------

/**
 * Transcribe polyphonic audio using the pure TypeScript implementation.
 *
 * Uses onnxruntime-node for model inference and @spotify/basic-pitch's
 * post-processing (outputToNotesPoly, noteFramesToTime) for note extraction.
 * No Python required.
 *
 * Requires:
 * - onnxruntime-node (npm)
 * - basic-pitch ONNX model file (from Python basic-pitch installation)
 *
 * @param filePath - Path to the audio file (WAV, MP3, FLAC, etc.)
 * @param options - Transcription options
 * @returns Note events with pitch, timing, velocity, and confidence
 */
export async function transcribePolyphonicTS(
  filePath: string,
  options?: TranscribeOptions
): Promise<TranscriptionResult> {
  const require = createRequire(import.meta.url)
  const ort = require('onnxruntime-node') as typeof import('onnxruntime-node')

  // Import post-processing from @spotify/basic-pitch (pure JS, no TF.js dependency)
  const { outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime } =
    require('@spotify/basic-pitch/cjs/toMidi') as typeof import('@spotify/basic-pitch')

  // Find the ONNX model
  const modelPath = findOnnxModel(options?.onnxModelPath)

  // Load audio resampled to 22050 Hz mono via ffmpeg
  const { samples } = await loadAudio(filePath, BASIC_PITCH_SAMPLE_RATE)
  const audioOriginalLength = samples.length

  // Convert Float64Array -> Float32Array
  const float32 = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    float32[i] = samples[i]
  }

  // Prepend overlap/2 zeros (matching Python's get_audio_input)
  const padded = new Float32Array(Math.floor(OVERLAP_LENGTH / 2) + float32.length)
  padded.set(float32, Math.floor(OVERLAP_LENGTH / 2))

  // Window the audio
  const windows = windowAudio(padded)

  // Load ONNX session
  const session = await ort.InferenceSession.create(modelPath)

  // Run inference on each window
  const allNoteBatches: number[][][] = []
  const allOnsetBatches: number[][][] = []
  const allContourBatches: number[][][] = []

  for (const window of windows) {
    // Input shape: [1, AUDIO_N_SAMPLES, 1]
    const inputData = new Float32Array(AUDIO_N_SAMPLES)
    inputData.set(window.slice(0, AUDIO_N_SAMPLES))
    const inputTensor = new ort.Tensor('float32', inputData, [1, AUDIO_N_SAMPLES, 1])

    const results = await session.run(
      { [ONNX_INPUT_NAME]: inputTensor },
      [ONNX_OUTPUT_NOTE, ONNX_OUTPUT_ONSET, ONNX_OUTPUT_CONTOUR]
    )

    const noteOut = results[ONNX_OUTPUT_NOTE]
    const onsetOut = results[ONNX_OUTPUT_ONSET]
    const contourOut = results[ONNX_OUTPUT_CONTOUR]

    // Each output is [1, numFrames, numBins] — extract the single batch
    const numFrames = noteOut.dims[1]
    const noteBins = noteOut.dims[2]
    const onsetBins = onsetOut.dims[2]
    const contourBins = contourOut.dims[2]

    allNoteBatches.push(reshapeOutput(noteOut.data as Float32Array, numFrames, noteBins))
    allOnsetBatches.push(reshapeOutput(onsetOut.data as Float32Array, numFrames, onsetBins))
    allContourBatches.push(reshapeOutput(contourOut.data as Float32Array, numFrames, contourBins))
  }

  // Unwrap: remove overlap frames, concatenate, trim to original audio length
  const frames = unwrapOutput(allNoteBatches, audioOriginalLength)
  const onsets = unwrapOutput(allOnsetBatches, audioOriginalLength)
  const contours = unwrapOutput(allContourBatches, audioOriginalLength)

  // Post-process into note events using @spotify/basic-pitch utilities
  const onsetThreshold = options?.onsetThreshold ?? 0.5
  const frameThreshold = options?.frameThreshold ?? 0.3
  const minNoteLenFrames = msToFrames(options?.minNoteLength ?? 58)
  const maxFreq = options?.maximumFrequency ?? null
  const minFreq = options?.minimumFrequency ?? null

  const rawNotes = outputToNotesPoly(
    frames,
    onsets,
    onsetThreshold,
    frameThreshold,
    minNoteLenFrames,
    true,   // inferOnsets
    maxFreq,
    minFreq,
    true,   // melodiaTrick
    11      // energyTolerance
  )

  const notesWithBends = addPitchBendsToNoteEvents(contours, rawNotes)
  const timedNotes = noteFramesToTime(notesWithBends)

  // Map to our TranscribedNote format
  const notes: TranscribedNote[] = timedNotes.map(n => {
    const velocity = Math.max(1, Math.min(127, Math.round(n.amplitude * 127)))
    return {
      pitch: n.pitchMidi,
      startTime: Math.round(n.startTimeSeconds * 1e6) / 1e6,
      endTime: Math.round((n.startTimeSeconds + n.durationSeconds) * 1e6) / 1e6,
      velocity,
      confidence: Math.round(Math.min(1.0, Math.max(0.0, n.amplitude)) * 1e4) / 1e4,
    }
  })

  return { notes }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Transcribe polyphonic audio to MIDI note events using Spotify's basic-pitch model.
 *
 * This uses a neural network that can detect multiple simultaneous pitches
 * (chords, polyphony), unlike pyin which is monophonic only.
 *
 * Uses onnxruntime-node for inference and @spotify/basic-pitch post-processing.
 *
 * @param filePath - Path to the audio file (WAV, MP3, FLAC, etc.)
 * @param options - Transcription options
 * @returns Note events with pitch, timing, velocity, and confidence
 */
export const transcribePolyphonic = transcribePolyphonicTS
