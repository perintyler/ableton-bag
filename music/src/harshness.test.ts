import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectHarshness } from './harshness.js'
import { hzToEQ8 } from './eq-mapping.js'

// Mock loadAudio to return synthetic signals instead of reading files
vi.mock('./dsp.js', async () => {
  const actual = await vi.importActual<typeof import('./dsp.js')>('./dsp.js')
  return {
    ...actual,
    loadAudio: vi.fn(),
  }
})

import { loadAudio } from './dsp.js'
const mockLoadAudio = vi.mocked(loadAudio)

const SAMPLE_RATE = 44100

/** Generate a sine wave at a given frequency */
function sine(freq: number, durationSec: number, amplitude: number = 1): Float64Array {
  const n = Math.floor(durationSec * SAMPLE_RATE)
  const samples = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    samples[i] = amplitude * Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE)
  }
  return samples
}

/** Generate pink noise (-3dB/octave) approximation via filtering white noise */
function pinkNoise(durationSec: number, amplitude: number = 0.1): Float64Array {
  const n = Math.floor(durationSec * SAMPLE_RATE)
  const samples = new Float64Array(n)
  // Simple pink noise approximation using Voss-McCartney
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < n; i++) {
    const white = (Math.random() * 2 - 1) * amplitude
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.96900 * b2 + white * 0.1538520
    b3 = 0.86650 * b3 + white * 0.3104856
    b4 = 0.55000 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.0168980
    samples[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
    b6 = white * 0.115926
  }
  return samples
}

/** Add two signals together */
function add(a: Float64Array, b: Float64Array): Float64Array {
  const n = Math.max(a.length, b.length)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = (i < a.length ? a[i] : 0) + (i < b.length ? b[i] : 0)
  }
  return out
}

/** Create a signal with a burst at a specific time range */
function burst(
  freq: number,
  startSec: number,
  endSec: number,
  totalDurationSec: number,
  amplitude: number = 1,
): Float64Array {
  const n = Math.floor(totalDurationSec * SAMPLE_RATE)
  const samples = new Float64Array(n)
  const startIdx = Math.floor(startSec * SAMPLE_RATE)
  const endIdx = Math.floor(endSec * SAMPLE_RATE)
  for (let i = startIdx; i < Math.min(endIdx, n); i++) {
    samples[i] = amplitude * Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE)
  }
  return samples
}

function setupMock(samples: Float64Array) {
  mockLoadAudio.mockResolvedValue({ samples, sampleRate: SAMPLE_RATE })
}

describe('detectHarshness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('detects a 3.5kHz resonance on pink noise', async () => {
    const noise = pinkNoise(2, 0.05)
    const resonance = sine(3500, 2, 0.5)
    setupMock(add(noise, resonance))

    const result = await detectHarshness('/fake/test.wav')

    expect(result.score).toBeGreaterThan(0)
    expect(result.regions.length).toBeGreaterThan(0)

    // The strongest region should be near 3500Hz
    const strongest = result.regions[0]
    expect(strongest.frequency).toBeGreaterThan(3000)
    expect(strongest.frequency).toBeLessThan(4000)
    expect(strongest.severity).toBeGreaterThan(0)
    expect(strongest.type).toBe('resonance')
  })

  it('returns low score for clean pink noise', async () => {
    // Use a deterministic "noise" to avoid flaky tests
    const n = Math.floor(2 * SAMPLE_RATE)
    const samples = new Float64Array(n)
    // Smooth broadband signal — sum of many evenly-spaced low-amplitude sines
    for (let f = 100; f < 10000; f += 50) {
      const amp = 0.01 / Math.sqrt(f / 100) // pink-ish rolloff
      for (let i = 0; i < n; i++) {
        samples[i] += amp * Math.sin(2 * Math.PI * f * i / SAMPLE_RATE)
      }
    }
    setupMock(samples)

    const result = await detectHarshness('/fake/clean.wav', { sensitivityDb: 8 })

    expect(result.score).toBeLessThan(30)
  })

  it('detects 6kHz sibilance burst', async () => {
    const noise = pinkNoise(3, 0.02)
    // Burst at 6kHz from 1.0-1.5s and 2.0-2.5s
    const b1 = burst(6000, 1.0, 1.5, 3, 0.4)
    const b2 = burst(6000, 2.0, 2.5, 3, 0.4)
    setupMock(add(add(noise, b1), b2))

    const result = await detectHarshness('/fake/sibilant.wav')

    expect(result.regions.length).toBeGreaterThan(0)

    // Should find regions near 6kHz
    const sibilantRegions = result.regions.filter(
      r => r.frequency > 5500 && r.frequency < 6500
    )
    expect(sibilantRegions.length).toBeGreaterThan(0)

    // Sibilance band should have a score
    const sibBand = result.bands.find(b => b.name === 'sibilance')
    expect(sibBand).toBeDefined()
    expect(sibBand!.score).toBeGreaterThan(0)
  })

  it('detects multiple resonances', async () => {
    const noise = pinkNoise(2, 0.03)
    const r1 = sine(2500, 2, 0.4) // nasal band
    const r2 = sine(6000, 2, 0.4) // sibilance band
    setupMock(add(add(noise, r1), r2))

    const result = await detectHarshness('/fake/multi.wav')

    expect(result.regions.length).toBeGreaterThanOrEqual(2)

    const freqs = result.regions.map(r => r.frequency)
    const has2500 = freqs.some(f => f > 2200 && f < 2800)
    const has6000 = freqs.some(f => f > 5500 && f < 6500)
    expect(has2500).toBe(true)
    expect(has6000).toBe(true)
  })

  it('generates EQ recommendations with correct hzToEQ8 values', async () => {
    const noise = pinkNoise(2, 0.03)
    const resonance = sine(3500, 2, 0.5)
    setupMock(add(noise, resonance))

    const result = await detectHarshness('/fake/eq.wav')

    expect(result.eqRecommendations.length).toBeGreaterThan(0)

    const rec = result.eqRecommendations[0]
    expect(rec.frequency).toBeGreaterThan(3000)
    expect(rec.frequency).toBeLessThan(4000)
    expect(rec.gain).toBeLessThan(0) // should be a cut
    expect(rec.gain).toBeGreaterThanOrEqual(-6) // capped at -6dB
    expect(rec.q).toBeGreaterThan(0)

    // EQ8 value should match hzToEQ8 for the detected frequency
    const expectedEQ8 = hzToEQ8(rec.frequency)
    expect(rec.eq8Value).toBeCloseTo(expectedEQ8, 3)
  })

  it('caps EQ recommendations at 8 bands', async () => {
    // Create many resonances
    const noise = pinkNoise(2, 0.02)
    let signal = noise
    for (const freq of [2200, 2500, 2800, 3200, 3800, 4500, 5500, 6500, 7200]) {
      signal = add(signal, sine(freq, 2, 0.3))
    }
    setupMock(signal)

    const result = await detectHarshness('/fake/many.wav')

    expect(result.eqRecommendations.length).toBeLessThanOrEqual(8)
  })

  it('returns all required fields in summary', async () => {
    const noise = pinkNoise(1, 0.05)
    const resonance = sine(4000, 1, 0.3)
    setupMock(add(noise, resonance))

    const result = await detectHarshness('/fake/fields.wav')

    expect(typeof result.score).toBe('number')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(Array.isArray(result.regions)).toBe(true)
    expect(Array.isArray(result.bands)).toBe(true)
    expect(Array.isArray(result.eqRecommendations)).toBe(true)
    expect(typeof result.durationSec).toBe('number')

    // Should have 3 sub-bands
    expect(result.bands).toHaveLength(3)
    expect(result.bands.map(b => b.name)).toEqual(['nasal', 'presence', 'sibilance'])
  })

  it('respects sensitivityDb option', async () => {
    const noise = pinkNoise(2, 0.03)
    const resonance = sine(3500, 2, 0.3)
    const signal = add(noise, resonance)
    setupMock(signal)

    // Low sensitivity = more detections
    const lowSens = await detectHarshness('/fake/sens.wav', { sensitivityDb: 3 })
    mockLoadAudio.mockResolvedValue({ samples: signal, sampleRate: SAMPLE_RATE })

    // High sensitivity = fewer detections
    const highSens = await detectHarshness('/fake/sens.wav', { sensitivityDb: 12 })

    expect(lowSens.regions.length).toBeGreaterThanOrEqual(highSens.regions.length)
  })
})
