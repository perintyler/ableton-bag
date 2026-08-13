import { describe, it, expect, afterAll } from 'vitest'
import { transcribePolyphonicTS } from './transcribe.js'
import type { TranscriptionResult } from './transcribe.js'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Write a minimal WAV file from Float64Array samples.
 * 16-bit PCM mono WAV.
 */
function saveTestWav(samples: Float64Array, sr: number, filePath: string): void {
  const numSamples = samples.length
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const dataSize = numSamples * bytesPerSample
  const fileSize = 44 + dataSize

  const buffer = Buffer.alloc(fileSize)
  let offset = 0

  // RIFF header
  buffer.write('RIFF', offset); offset += 4
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4
  buffer.write('WAVE', offset); offset += 4

  // fmt sub-chunk
  buffer.write('fmt ', offset); offset += 4
  buffer.writeUInt32LE(16, offset); offset += 4          // sub-chunk size
  buffer.writeUInt16LE(1, offset); offset += 2           // PCM format
  buffer.writeUInt16LE(1, offset); offset += 2           // mono
  buffer.writeUInt32LE(sr, offset); offset += 4          // sample rate
  buffer.writeUInt32LE(sr * bytesPerSample, offset); offset += 4  // byte rate
  buffer.writeUInt16LE(bytesPerSample, offset); offset += 2      // bag align
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2       // bits per sample

  // data sub-chunk
  buffer.write('data', offset); offset += 4
  buffer.writeUInt32LE(dataSize, offset); offset += 4

  // Write PCM samples (clamp to int16 range)
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    const int16 = Math.round(clamped * 32767)
    buffer.writeInt16LE(int16, offset); offset += 2
  }

  writeFileSync(filePath, buffer)
}

const testWavPath = join(tmpdir(), `transcribe-test-${Date.now()}.wav`)

// Generate 2 seconds of 440Hz + 880Hz sine waves at 44100Hz
const sr = 44100
const duration = 2
const numSamples = sr * duration
const samples = new Float64Array(numSamples)
for (let i = 0; i < numSamples; i++) {
  const t = i / sr
  // Mix two tones at equal amplitude, scaled to avoid clipping
  samples[i] = 0.4 * Math.sin(2 * Math.PI * 440 * t) +
               0.4 * Math.sin(2 * Math.PI * 880 * t)
}
saveTestWav(samples, sr, testWavPath)

afterAll(() => {
  if (existsSync(testWavPath)) {
    unlinkSync(testWavPath)
  }
})

describe('transcribePolyphonicTS', () => {
  it('should detect A4 (MIDI 69) and A5 (MIDI 81) in a two-tone signal', async () => {
    const result: TranscriptionResult = await transcribePolyphonicTS(testWavPath, {
      onsetThreshold: 0.3,
      frameThreshold: 0.2,
      minNoteLength: 50,
    })

    expect(result.notes).toBeDefined()
    expect(result.notes.length).toBeGreaterThan(0)

    const pitches = result.notes.map(n => n.pitch)

    // A4 = MIDI 69, A5 = MIDI 81
    // Allow +/- 1 semitone tolerance for the neural network
    const hasA4 = pitches.some(p => p >= 68 && p <= 70)
    const hasA5 = pitches.some(p => p >= 80 && p <= 82)

    expect(hasA4).toBe(true)
    expect(hasA5).toBe(true)

    // Verify note structure
    for (const note of result.notes) {
      expect(note.pitch).toBeGreaterThanOrEqual(0)
      expect(note.pitch).toBeLessThanOrEqual(127)
      expect(note.startTime).toBeGreaterThanOrEqual(0)
      expect(note.endTime).toBeGreaterThan(note.startTime)
      expect(note.velocity).toBeGreaterThanOrEqual(1)
      expect(note.velocity).toBeLessThanOrEqual(127)
      expect(note.confidence).toBeGreaterThanOrEqual(0)
      expect(note.confidence).toBeLessThanOrEqual(1)
    }
  }, 60_000) // 60s timeout for model loading + inference
})
