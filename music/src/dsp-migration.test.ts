import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spectralCorrectionCurveTS } from './compare.js'
import { extractDrumFeaturesTS } from './drum-features.js'
import { timbreSimilarityTS, mfccDistanceTS } from './similarity.js'

const execFileAsync = promisify(execFile)

let testDir: string
let sine440File: string
let sine1000File: string
let noiseFile: string

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'music-dsp-test-'))

  sine440File = join(testDir, 'sine440.wav')
  sine1000File = join(testDir, 'sine1000.wav')
  noiseFile = join(testDir, 'noise.wav')

  // Generate a 440Hz sine wave, 1 second, 44100Hz
  await execFileAsync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1:sample_rate=44100',
    '-ac', '1', sine440File,
  ])

  // Generate a 1000Hz sine wave, 1 second, 44100Hz
  await execFileAsync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=1:sample_rate=44100',
    '-ac', '1', sine1000File,
  ])

  // Generate white noise, 1 second, 44100Hz
  await execFileAsync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'anoisesrc=d=1:c=white:r=44100:a=0.5',
    '-ac', '1', noiseFile,
  ])
}, 30_000)

afterAll(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true })
  }
})

describe('spectralCorrectionCurveTS', () => {
  it('returns near-zero corrections when comparing a file to itself', async () => {
    const result = await spectralCorrectionCurveTS(sine440File, sine440File)

    expect(result.frequencies).toHaveLength(29)
    expect(result.corrections_dB).toHaveLength(29)
    expect(result.smoothed_dB).toHaveLength(29)

    // All corrections should be ~0 when comparing identical files
    for (const corr of result.corrections_dB) {
      expect(Math.abs(corr)).toBeLessThanOrEqual(0.01)
    }
  }, 30_000)

  it('produces non-zero corrections for different signals', async () => {
    const result = await spectralCorrectionCurveTS(sine440File, sine1000File)

    // There should be some non-zero corrections since the signals differ
    const hasNonZero = result.corrections_dB.some((c) => Math.abs(c) > 0.5)
    expect(hasNonZero).toBe(true)

    // All corrections should be clamped to +/-12 dB
    for (const corr of result.corrections_dB) {
      expect(corr).toBeGreaterThanOrEqual(-12)
      expect(corr).toBeLessThanOrEqual(12)
    }
  }, 30_000)
})

describe('extractDrumFeaturesTS', () => {
  it('returns a 440Hz sine with reasonable brightness', async () => {
    const features = await extractDrumFeaturesTS(sine440File)

    // 440Hz sine: centroid ~440Hz -> brightness = 440/10000*100 = 4.4
    expect(features.brightness).toBeGreaterThan(0)
    expect(features.brightness).toBeLessThan(20) // A pure 440Hz should not be very bright

    // All values in 0-100 range
    for (const key of ['brightness', 'hardness', 'depth', 'roughness', 'boominess', 'warmth', 'sharpness'] as const) {
      expect(features[key]).toBeGreaterThanOrEqual(0)
      expect(features[key]).toBeLessThanOrEqual(100)
    }
  }, 30_000)

  it('returns high brightness for a 1000Hz sine', async () => {
    const features440 = await extractDrumFeaturesTS(sine440File)
    const features1000 = await extractDrumFeaturesTS(sine1000File)

    // 1000Hz should have higher brightness than 440Hz
    expect(features1000.brightness).toBeGreaterThan(features440.brightness)
  }, 30_000)

  it('reports higher roughness for noise than a sine', async () => {
    const sineFeat = await extractDrumFeaturesTS(sine440File)
    const noiseFeat = await extractDrumFeaturesTS(noiseFile)

    // Noise has higher spectral flatness -> higher roughness
    expect(noiseFeat.roughness).toBeGreaterThan(sineFeat.roughness)
  }, 30_000)
})

describe('timbreSimilarityTS', () => {
  it('scores ~1.0 when comparing a file to itself', async () => {
    const result = await timbreSimilarityTS(sine440File, sine440File)

    expect(result.score).toBeGreaterThan(0.9)
    expect(result.mfccSimilarity).toBeGreaterThan(0.99)
    expect(result.spectralConvergence).toBeLessThan(0.01)
    expect(result.centroidDistanceHz).toBeLessThan(1)
    expect(result.bandCorrelation).toBeGreaterThan(0.99)
  }, 30_000)

  it('scores lower for different signals', async () => {
    const same = await timbreSimilarityTS(sine440File, sine440File)
    const diff = await timbreSimilarityTS(sine440File, noiseFile)

    expect(diff.score).toBeLessThan(same.score)
  }, 30_000)
})

describe('mfccDistanceTS', () => {
  it('returns ~0 distance when comparing a file to itself', async () => {
    const result = await mfccDistanceTS(sine440File, sine440File)

    expect(result.distance).toBeLessThan(0.01)
    expect(result.dtwCost).toBeLessThan(0.01)
  }, 30_000)

  it('returns greater distance for different signals', async () => {
    const same = await mfccDistanceTS(sine440File, sine440File)
    const diff = await mfccDistanceTS(sine440File, noiseFile)

    expect(diff.distance).toBeGreaterThan(same.distance)
  }, 30_000)
})
