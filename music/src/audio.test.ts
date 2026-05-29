import { describe, it, expect, afterAll } from 'vitest'
import { getAudioInfo, convertToWav, filter, DRUM_BANDS } from './audio.js'
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
  buffer.writeUInt32LE(16, offset); offset += 4
  buffer.writeUInt16LE(1, offset); offset += 2           // PCM format
  buffer.writeUInt16LE(1, offset); offset += 2           // mono
  buffer.writeUInt32LE(sr, offset); offset += 4          // sample rate
  buffer.writeUInt32LE(sr * bytesPerSample, offset); offset += 4
  buffer.writeUInt16LE(bytesPerSample, offset); offset += 2
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2

  // data sub-chunk
  buffer.write('data', offset); offset += 4
  buffer.writeUInt32LE(dataSize, offset); offset += 4

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    const int16 = Math.round(clamped * 32767)
    buffer.writeInt16LE(int16, offset); offset += 2
  }

  writeFileSync(filePath, buffer)
}

const testDir = join(tmpdir(), `audio-test-${Date.now()}`)
const testWavPath = join(testDir, 'test-440.wav')
const convertedPath = join(testDir, 'test-converted.wav')
const filteredPath = join(testDir, 'test-filtered.wav')

// Generate 1 second of 440Hz sine at 44100Hz
const sr = 44100
const samples = new Float64Array(sr)
for (let i = 0; i < sr; i++) {
  samples[i] = Math.sin(2 * Math.PI * 440 * i / sr)
}

import { mkdirSync } from 'node:fs'
mkdirSync(testDir, { recursive: true })
saveTestWav(samples, sr, testWavPath)

const tempFiles = [testWavPath, convertedPath, filteredPath]

afterAll(() => {
  for (const f of tempFiles) {
    if (existsSync(f)) {
      try { unlinkSync(f) } catch { /* ignore */ }
    }
  }
  try { require('node:fs').rmdirSync(testDir) } catch { /* ignore */ }
})

describe('getAudioInfo', () => {
  it('returns duration, sample rate, and channels for a generated WAV', async () => {
    const info = await getAudioInfo(testWavPath)

    expect(info.duration).toBeGreaterThan(0.9)
    expect(info.duration).toBeLessThan(1.1)
    expect(info.sampleRate).toBe(44100)
    expect(info.channels).toBe(1)
    expect(info.path).toBe(testWavPath)
    expect(info.codec).toBe('pcm_s16le')
  })
})

describe('convertToWav', () => {
  it('converts a WAV to WAV (identity), output exists', async () => {
    const result = await convertToWav(testWavPath, convertedPath)

    expect(result).toBe(convertedPath)
    expect(existsSync(convertedPath)).toBe(true)

    // Verify the output is a valid audio file
    const info = await getAudioInfo(convertedPath)
    expect(info.duration).toBeGreaterThan(0.9)
    expect(info.sampleRate).toBe(44100)
  })
})

describe('filter', () => {
  it('applies highpass filter, output exists', async () => {
    const result = await filter({
      input: testWavPath,
      output: filteredPath,
      highpass: 1000,
    })

    expect(result).toBe(filteredPath)
    expect(existsSync(filteredPath)).toBe(true)

    const info = await getAudioInfo(filteredPath)
    expect(info.duration).toBeGreaterThan(0.9)
  })
})

describe('DRUM_BANDS', () => {
  it('has kick/snare/hihat band definitions', () => {
    expect(DRUM_BANDS.kick).toEqual({ name: 'kick', low: 40, high: 200 })
    expect(DRUM_BANDS.snare).toEqual({ name: 'snare', low: 200, high: 3000 })
    expect(DRUM_BANDS.hihats).toEqual({ name: 'hihats', low: 5000 })
  })

  it('has sub and cymbal bands', () => {
    expect(DRUM_BANDS.sub).toEqual({ name: 'sub', high: 80 })
    expect(DRUM_BANDS.cymbals).toEqual({ name: 'cymbals', low: 8000 })
  })
})
