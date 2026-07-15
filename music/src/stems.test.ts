import { describe, it, expect, beforeAll } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { ifft, fft, stftComplex, istft, hannWindow } from './dsp.js'

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// IFFT / ISTFT unit tests (no model needed)
// ---------------------------------------------------------------------------

describe('ifft', () => {
  it('round-trips a simple signal through fft -> ifft', () => {
    // Create a simple signal of length 8 (power of 2)
    const signal = new Float64Array([1, 0, -1, 0, 1, 0, -1, 0])
    const spectrum = fft(signal)
    const recovered = ifft(spectrum)

    expect(recovered.length).toBe(8)
    for (let i = 0; i < signal.length; i++) {
      expect(recovered[i]).toBeCloseTo(signal[i], 10)
    }
  })

  it('round-trips a ramp signal', () => {
    const signal = new Float64Array(16)
    for (let i = 0; i < 16; i++) signal[i] = i / 16
    const spectrum = fft(signal)
    const recovered = ifft(spectrum)

    for (let i = 0; i < signal.length; i++) {
      expect(recovered[i]).toBeCloseTo(signal[i], 10)
    }
  })
})

describe('stftComplex + istft round-trip', () => {
  it('reconstructs a sine wave through stftComplex -> istft', () => {
    // Generate a 440Hz sine at 44100Hz, ~0.1 seconds
    const sr = 44100
    const duration = 0.1
    const numSamples = Math.floor(sr * duration)
    const signal = new Float64Array(numSamples)
    for (let i = 0; i < numSamples; i++) {
      signal[i] = Math.sin(2 * Math.PI * 440 * i / sr)
    }

    const nFft = 1024
    const hopLength = 256
    const opts = { nFft, hopLength, window: 'hann' as const }

    const frames = stftComplex(signal, opts)
    expect(frames.length).toBeGreaterThan(0)

    // Each frame should have (nFft/2 + 1) * 2 values (complex pairs)
    const expectedBins = nFft / 2 + 1
    expect(frames[0].length).toBe(expectedBins * 2)

    // Reconstruct
    const reconstructed = istft(frames, { ...opts, length: numSamples })
    expect(reconstructed.length).toBe(numSamples)

    // The middle portion should match well (edges may have windowing artifacts)
    const start = nFft
    const end = numSamples - nFft
    if (end > start) {
      for (let i = start; i < end; i++) {
        expect(reconstructed[i]).toBeCloseTo(signal[i], 2)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// ONNX model tests (conditional — only run if model file exists)
// ---------------------------------------------------------------------------

const MODEL_PATHS = [
  join(dirname(fileURLToPath(import.meta.url)), '..', 'models', 'htdemucs.onnx'),
  join(process.env.HOME ?? '', '.cache', 'demucs', 'htdemucs.onnx'),
  join(process.env.HOME ?? '', 'models', 'htdemucs.onnx'),
]

const modelPath = MODEL_PATHS.find((p) => existsSync(p))

describe('demucs ONNX model', () => {
  it.skipIf(!modelPath)('loads the ONNX model and has expected input/output names', async () => {
    const require = createRequire(import.meta.url)
    const ort = require('onnxruntime-node') as typeof import('onnxruntime-node')

    const session = await ort.InferenceSession.create(modelPath!)

    // Should have input names
    expect(session.inputNames.length).toBeGreaterThanOrEqual(1)
    // Should have at least 1 output (typically 4 stems or combined)
    expect(session.outputNames.length).toBeGreaterThanOrEqual(1)
  }, 30_000)
})
