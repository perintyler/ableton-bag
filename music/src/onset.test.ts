import { describe, it, expect, afterAll } from 'vitest'
import { detectOnsets } from './onset.js'
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

  buffer.write('RIFF', offset); offset += 4
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4
  buffer.write('WAVE', offset); offset += 4

  buffer.write('fmt ', offset); offset += 4
  buffer.writeUInt32LE(16, offset); offset += 4
  buffer.writeUInt16LE(1, offset); offset += 2
  buffer.writeUInt16LE(1, offset); offset += 2
  buffer.writeUInt32LE(sr, offset); offset += 4
  buffer.writeUInt32LE(sr * bytesPerSample, offset); offset += 4
  buffer.writeUInt16LE(bytesPerSample, offset); offset += 2
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2

  buffer.write('data', offset); offset += 4
  buffer.writeUInt32LE(dataSize, offset); offset += 4

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    const int16 = Math.round(clamped * 32767)
    buffer.writeInt16LE(int16, offset); offset += 2
  }

  writeFileSync(filePath, buffer)
}

const testWavPath = join(tmpdir(), `onset-test-${Date.now()}.wav`)

// Generate 2 seconds of audio with periodic clicks (transients) at known positions.
// Click at 0.25s, 0.75s, 1.25s, 1.75s — four clicks spaced 0.5s apart.
const sr = 44100
const duration = 2.0
const numSamples = Math.floor(sr * duration)
const samples = new Float64Array(numSamples)

const clickTimes = [0.25, 0.75, 1.25, 1.75]
const clickDurationSamples = Math.floor(sr * 0.005) // 5ms click

for (const t of clickTimes) {
  const startSample = Math.floor(t * sr)
  for (let i = 0; i < clickDurationSamples && startSample + i < numSamples; i++) {
    // Sharp impulse that decays quickly
    samples[startSample + i] = 0.9 * Math.exp(-i / (clickDurationSamples * 0.2))
  }
}

saveTestWav(samples, sr, testWavPath)

afterAll(() => {
  if (existsSync(testWavPath)) {
    try { unlinkSync(testWavPath) } catch { /* ignore */ }
  }
})

describe('detectOnsets', () => {
  it('detects onsets in a signal with clear transients', async () => {
    const onsets = await detectOnsets(testWavPath, {
      silenceThreshold: -40,
      minimumInterval: 0.1,
    })

    // Should detect at least 2 of the 4 clicks (onset detection is approximate)
    expect(onsets.length).toBeGreaterThanOrEqual(2)

    // Each onset should have time and velocity
    for (const onset of onsets) {
      expect(typeof onset.time).toBe('number')
      expect(typeof onset.velocity).toBe('number')
      expect(onset.velocity).toBeGreaterThanOrEqual(40)
      expect(onset.velocity).toBeLessThanOrEqual(127)
    }

    // Onset times should be within the file duration
    for (const onset of onsets) {
      expect(onset.time).toBeGreaterThanOrEqual(0)
      expect(onset.time).toBeLessThanOrEqual(duration)
    }
  })

  it('returns empty array for silence', async () => {
    const silentPath = join(tmpdir(), `onset-silent-${Date.now()}.wav`)
    const silent = new Float64Array(sr) // 1 second of silence
    saveTestWav(silent, sr, silentPath)

    try {
      const onsets = await detectOnsets(silentPath)
      expect(onsets).toEqual([])
    } finally {
      if (existsSync(silentPath)) {
        try { unlinkSync(silentPath) } catch { /* ignore */ }
      }
    }
  })
})
