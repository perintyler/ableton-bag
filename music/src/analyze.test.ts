import { describe, it, expect, afterAll } from 'vitest'
import { analyzeTimbreTS } from './analyze.js'
import type { AudioAnalysisResult } from './analyze.js'
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
  buffer.writeUInt16LE(bytesPerSample, offset); offset += 2      // block align
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

const testWavPath = join(tmpdir(), `analyze-test-${Date.now()}.wav`)

// Generate 1 second of 440Hz sine at 44100Hz
const sr = 44100
const samples = new Float64Array(sr)
for (let i = 0; i < sr; i++) {
  samples[i] = Math.sin(2 * Math.PI * 440 * i / sr)
}
saveTestWav(samples, sr, testWavPath)

afterAll(() => {
  if (existsSync(testWavPath)) {
    try { unlinkSync(testWavPath) } catch { /* ignore */ }
  }
})

describe('analyzeTimbreTS', () => {
  it('returns correct AudioAnalysisResult type shape', async () => {
    const result = await analyzeTimbreTS(testWavPath)

    // Verify all required fields exist
    expect(result).toHaveProperty('spectral')
    expect(result).toHaveProperty('transient')
    expect(result).toHaveProperty('summary')

    expect(result.spectral).toHaveProperty('centroidHz')
    expect(result.spectral).toHaveProperty('bandwidthHz')
    expect(result.spectral).toHaveProperty('rolloff85Hz')
    expect(result.spectral).toHaveProperty('spectralFlatness')
    expect(result.spectral).toHaveProperty('energyBands')
    expect(result.spectral).toHaveProperty('peakFrequencies')

    expect(result.spectral.energyBands).toHaveProperty('subBass')
    expect(result.spectral.energyBands).toHaveProperty('bass')
    expect(result.spectral.energyBands).toHaveProperty('lowMid')
    expect(result.spectral.energyBands).toHaveProperty('mid')
    expect(result.spectral.energyBands).toHaveProperty('upperMid')
    expect(result.spectral.energyBands).toHaveProperty('presence')
    expect(result.spectral.energyBands).toHaveProperty('air')

    expect(result.transient).toHaveProperty('attackMs')
    expect(result.transient).toHaveProperty('decayMs')
    expect(result.transient).toHaveProperty('hitCount')

    expect(result.summary).toHaveProperty('brightness')
    expect(result.summary).toHaveProperty('texture')
    expect(result.summary).toHaveProperty('attack')
    expect(result.summary).toHaveProperty('decay')

    // Verify types
    expect(typeof result.spectral.centroidHz).toBe('number')
    expect(typeof result.spectral.spectralFlatness).toBe('number')
    expect(Array.isArray(result.spectral.peakFrequencies)).toBe(true)
  })

  it('detects spectral centroid near 440Hz for a pure sine wave', async () => {
    const result = await analyzeTimbreTS(testWavPath)

    // Centroid should be close to 440Hz for a pure sine tone
    expect(result.spectral.centroidHz).toBeGreaterThan(400)
    expect(result.spectral.centroidHz).toBeLessThan(480)
  })

  it('reports low spectral flatness for a pure tone', async () => {
    const result = await analyzeTimbreTS(testWavPath)

    // Pure sine wave should have very low flatness (close to 0)
    expect(result.spectral.spectralFlatness).toBeLessThan(0.05)
  })

  it('reports small bandwidth for a pure sine wave', async () => {
    const result = await analyzeTimbreTS(testWavPath)

    // A pure sine has very narrow bandwidth
    expect(result.spectral.bandwidthHz).toBeLessThan(300)
  })

  it('classifies a pure sine as dark and tonal', async () => {
    const result = await analyzeTimbreTS(testWavPath)

    // 440Hz centroid is well below 6000Hz threshold
    expect(result.summary.brightness).toBe('dark')
    // Low flatness = tonal
    expect(result.summary.texture).toBe('tonal')
  })

  it('reports 440Hz among peak frequencies', async () => {
    const result = await analyzeTimbreTS(testWavPath)

    // At least one peak should be near 440Hz
    const hasNear440 = result.spectral.peakFrequencies.some(
      (f) => f >= 420 && f <= 460
    )
    expect(hasNear440).toBe(true)
  })

  it('satisfies AudioAnalysisResult type constraint', async () => {
    const result = await analyzeTimbreTS(testWavPath)

    // TypeScript compile-time check — this assignment must work
    const _typed: AudioAnalysisResult = result

    // Summary values should be from the allowed union types
    expect(['dark', 'medium', 'bright']).toContain(result.summary.brightness)
    expect(['tonal', 'semi-metallic', 'noisy']).toContain(result.summary.texture)
    expect(['very-fast', 'fast', 'medium', 'slow']).toContain(result.summary.attack)
    expect(['short', 'medium', 'long']).toContain(result.summary.decay)
  })
})
