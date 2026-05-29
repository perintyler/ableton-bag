import { describe, it, expect, afterAll } from 'vitest'
import { suggestMacroValues, compareTimbre, spectralCorrectionCurve } from './compare.js'
import type { AudioAnalysisResult } from './analyze.js'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

function makeAnalysis(bands: Partial<AudioAnalysisResult['spectral']['energyBands']>): AudioAnalysisResult {
  return {
    spectral: {
      centroidHz: 5000,
      bandwidthHz: 3000,
      rolloff85Hz: 8000,
      spectralFlatness: 0.05,
      energyBands: {
        subBass: 0, bass: 0, lowMid: 0, mid: 0, upperMid: 0, presence: 0, air: 0,
        ...bands,
      },
      peakFrequencies: [1000],
    },
    transient: { attackMs: 10, decayMs: 20, hitCount: 100 },
    summary: { brightness: 'medium', texture: 'tonal', attack: 'fast', decay: 'short' },
  }
}

describe('suggestMacroValues', () => {
  it('returns center (63-64) when source equals target', () => {
    const analysis = makeAnalysis({ bass: 50, lowMid: 25, mid: 15, upperMid: 10 })
    const result = suggestMacroValues(analysis, analysis)
    expect(result.low).toBeCloseTo(64, 0)
    expect(result.mid).toBeCloseTo(64, 0)
    expect(result.high).toBeCloseTo(64, 0)
  })

  it('boosts mid when target has more mid energy', () => {
    const source = makeAnalysis({ lowMid: 10, mid: 10 })
    const target = makeAnalysis({ lowMid: 30, mid: 30 })
    const result = suggestMacroValues(source, target)
    expect(result.mid).toBeGreaterThan(64)
  })

  it('cuts high when target has less high energy', () => {
    const source = makeAnalysis({ upperMid: 30, presence: 20, air: 10 })
    const target = makeAnalysis({ upperMid: 10, presence: 5, air: 2 })
    const result = suggestMacroValues(source, target)
    expect(result.high).toBeLessThan(64)
  })

  it('clamps values to 0-127 range', () => {
    const source = makeAnalysis({ bass: 0.01, subBass: 0.01 })
    const target = makeAnalysis({ bass: 99, subBass: 99 })
    const result = suggestMacroValues(source, target)
    expect(result.low).toBeLessThanOrEqual(127)
    expect(result.low).toBeGreaterThanOrEqual(0)
  })
})

// --- Tests for compareTimbre, spectralCorrectionCurve, buildBandRecommendations ---

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

const sr = 44100
const sourceWavPath = join(tmpdir(), `compare-source-${Date.now()}.wav`)
const targetWavPath = join(tmpdir(), `compare-target-${Date.now()}.wav`)

// Source: 440Hz sine (dark, tonal)
const sourceSamples = new Float64Array(sr)
for (let i = 0; i < sr; i++) {
  sourceSamples[i] = Math.sin(2 * Math.PI * 440 * i / sr)
}
saveTestWav(sourceSamples, sr, sourceWavPath)

// Target: 4000Hz sine (bright, tonal)
const targetSamples = new Float64Array(sr)
for (let i = 0; i < sr; i++) {
  targetSamples[i] = Math.sin(2 * Math.PI * 4000 * i / sr)
}
saveTestWav(targetSamples, sr, targetWavPath)

afterAll(() => {
  for (const f of [sourceWavPath, targetWavPath]) {
    if (existsSync(f)) {
      try { unlinkSync(f) } catch { /* ignore */ }
    }
  }
})

describe('compareTimbre', () => {
  it('returns TimbreComparison with source, target, eq fields', async () => {
    const result = await compareTimbre(sourceWavPath, targetWavPath)

    // Verify top-level shape
    expect(result).toHaveProperty('source')
    expect(result).toHaveProperty('target')
    expect(result).toHaveProperty('eq')

    // source and target should be AudioAnalysisResult
    expect(result.source.spectral).toHaveProperty('centroidHz')
    expect(result.target.spectral).toHaveProperty('centroidHz')

    // eq should have bands, centroidShiftHz, brightnessDirection, macroValues
    expect(result.eq).toHaveProperty('bands')
    expect(result.eq).toHaveProperty('centroidShiftHz')
    expect(result.eq).toHaveProperty('brightnessDirection')
    expect(result.eq).toHaveProperty('macroValues')
    expect(typeof result.eq.macroValues.low).toBe('number')
    expect(typeof result.eq.macroValues.mid).toBe('number')
    expect(typeof result.eq.macroValues.high).toBe('number')
  })

  it('returns 7 band recommendations (via buildBandRecommendations)', async () => {
    const result = await compareTimbre(sourceWavPath, targetWavPath)

    expect(result.eq.bands.length).toBe(7)
    for (const band of result.eq.bands) {
      expect(band).toHaveProperty('band')
      expect(band).toHaveProperty('centerHz')
      expect(band).toHaveProperty('action')
      expect(band).toHaveProperty('amountDb')
      expect(band).toHaveProperty('energyDelta')
      expect(['boost', 'cut', 'neutral']).toContain(band.action)
    }
  })
})

describe('spectralCorrectionCurve', () => {
  it('returns frequencies array of length 29 (THIRD_OCTAVE_CENTERS)', async () => {
    const result = await spectralCorrectionCurve(sourceWavPath, targetWavPath)

    expect(result.frequencies.length).toBe(29)
    expect(result.corrections_dB.length).toBe(29)
    expect(result.smoothed_dB.length).toBe(29)

    // First frequency should be 31.5 Hz
    expect(result.frequencies[0]).toBe(31.5)
    // Last should be 20000 Hz
    expect(result.frequencies[28]).toBe(20000)

    // Corrections should be clamped to +/- 12 dB
    for (const c of result.corrections_dB) {
      expect(c).toBeGreaterThanOrEqual(-12)
      expect(c).toBeLessThanOrEqual(12)
    }
  })
})
