import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectClashes } from './clash.js'
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

/** Generate broadband noise */
function noise(durationSec: number, amplitude: number = 0.1): Float64Array {
  const n = Math.floor(durationSec * SAMPLE_RATE)
  const samples = new Float64Array(n)
  // Deterministic "noise" via many sines to avoid flaky tests
  for (let f = 50; f < 15000; f += 30) {
    const amp = amplitude / Math.sqrt(f / 50)
    for (let i = 0; i < n; i++) {
      samples[i] += amp * Math.sin(2 * Math.PI * f * i / SAMPLE_RATE + f * 0.7)
    }
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

let callIndex = 0

function setupMocks(...signals: Float64Array[]) {
  callIndex = 0
  mockLoadAudio.mockImplementation(async () => {
    const samples = signals[callIndex % signals.length]
    callIndex++
    return { samples, sampleRate: SAMPLE_RATE }
  })
}

describe('detectClashes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callIndex = 0
  })

  it('detects clash when two sources have energy at the same frequency', async () => {
    // Both sources have a strong 200Hz sine
    const sig1 = sine(200, 2, 0.8)
    const sig2 = sine(200, 2, 0.5)
    setupMocks(sig1, sig2)

    const result = await detectClashes([
      { filePath: '/fake/a.wav', label: 'Kick', role: 'support' },
      { filePath: '/fake/b.wav', label: 'Bass', role: 'support' },
    ])

    expect(result.clashes.length).toBeGreaterThan(0)
    // Should detect a clash in the bass region (200Hz band)
    const bassClash = result.clashes.find(c => c.centerHz >= 160 && c.centerHz <= 250)
    expect(bassClash).toBeDefined()
    expect(bassClash!.severity).toBeGreaterThan(0)

    // Fix should target the weaker source (sig2 has lower amplitude)
    expect(result.fixes.length).toBeGreaterThan(0)
  })

  it('reports no clash for two sines at distant frequencies', async () => {
    // Source A at 200Hz, Source B at 8000Hz — no overlap
    const sig1 = sine(200, 2, 0.8)
    const sig2 = sine(8000, 2, 0.8)
    setupMocks(sig1, sig2)

    const result = await detectClashes([
      { filePath: '/fake/a.wav', label: 'Bass', role: 'support' },
      { filePath: '/fake/b.wav', label: 'HiHats', role: 'support' },
    ])

    // Should have very few or no clashes
    expect(result.score).toBeLessThan(10)
  })

  it('detects moderate clash between broadband noise and a sine', async () => {
    const broadband = noise(2, 0.05)
    const focused = sine(1000, 2, 0.5)
    setupMocks(broadband, focused)

    const result = await detectClashes([
      { filePath: '/fake/noise.wav', label: 'Pad', role: 'support' },
      { filePath: '/fake/sine.wav', label: 'Lead', role: 'support' },
    ])

    expect(result.clashes.length).toBeGreaterThan(0)
    // Should find a clash near 1000Hz
    const midClash = result.clashes.find(c => c.centerHz >= 800 && c.centerHz <= 1250)
    expect(midClash).toBeDefined()
  })

  it('identifies correct pair in three-source scenario', async () => {
    // Source A: 200Hz, Source B: 200Hz, Source C: 8000Hz
    // Clash should be between A and B, not involving C
    const sig1 = sine(200, 2, 0.8)
    const sig2 = sine(200, 2, 0.6)
    const sig3 = sine(8000, 2, 0.8)
    setupMocks(sig1, sig2, sig3)

    const result = await detectClashes([
      { filePath: '/fake/a.wav', label: 'Kick', role: 'support' },
      { filePath: '/fake/b.wav', label: 'Bass', role: 'support' },
      { filePath: '/fake/c.wav', label: 'HiHats', role: 'support' },
    ])

    // The strongest clash should be between Kick and Bass
    const strongest = result.clashes[0]
    expect(strongest).toBeDefined()
    const labels = [strongest.sourceALabel, strongest.sourceBLabel]
    expect(labels).toContain('Kick')
    expect(labels).toContain('Bass')
  })

  it('support always yields to lead via role override', async () => {
    // Lead has LESS energy but should never be cut
    const leadSignal = sine(200, 2, 0.3) // weaker
    const supportSignal = sine(200, 2, 0.8) // stronger

    setupMocks(leadSignal, supportSignal)

    const result = await detectClashes([
      { filePath: '/fake/vocal.wav', label: 'Vocals', role: 'lead' },
      { filePath: '/fake/guitar.wav', label: 'Guitar', role: 'support' },
    ])

    // All fixes should be on Guitar (support), not Vocals (lead)
    for (const fix of result.fixes) {
      expect(fix.sourceLabel).toBe('Guitar')
      expect(fix.sourceIndex).toBe(1)
    }
  })

  it('generates EQ recommendations targeting the weaker source', async () => {
    const sig1 = sine(200, 2, 0.8)
    const sig2 = sine(200, 2, 0.4)
    setupMocks(sig1, sig2)

    const result = await detectClashes([
      { filePath: '/fake/a.wav', label: 'Strong', role: 'support' },
      { filePath: '/fake/b.wav', label: 'Weak', role: 'support' },
    ])

    expect(result.fixes.length).toBeGreaterThan(0)

    for (const fix of result.fixes) {
      expect(fix.gain).toBeLessThan(0)
      expect(fix.gain).toBeGreaterThanOrEqual(-4) // capped at -4dB
      expect(fix.q).toBeGreaterThanOrEqual(3)
      expect(fix.q).toBeLessThanOrEqual(5)
      // EQ8 value should match
      expect(fix.eq8Value).toBeCloseTo(hzToEQ8(fix.frequency), 3)
    }
  })

  it('respects maxCutsPerSource limit', async () => {
    // Create a broadband signal that will clash across many bands
    const broad1 = noise(2, 0.3)
    const broad2 = noise(2, 0.3)
    setupMocks(broad1, broad2)

    const result = await detectClashes(
      [
        { filePath: '/fake/a.wav', label: 'A', role: 'support' },
        { filePath: '/fake/b.wav', label: 'B', role: 'support' },
      ],
      { maxCutsPerSource: 2, minSeverity: 0.05 },
    )

    // Count fixes per source
    const fixesPerSource = new Map<number, number>()
    for (const fix of result.fixes) {
      fixesPerSource.set(fix.sourceIndex, (fixesPerSource.get(fix.sourceIndex) ?? 0) + 1)
    }

    for (const [, count] of fixesPerSource) {
      expect(count).toBeLessThanOrEqual(2)
    }
  })

  it('returns all required fields in summary', async () => {
    const sig1 = sine(500, 1, 0.5)
    const sig2 = sine(500, 1, 0.4)
    setupMocks(sig1, sig2)

    const result = await detectClashes([
      { filePath: '/fake/a.wav', label: 'A', role: 'support' },
      { filePath: '/fake/b.wav', label: 'B', role: 'support' },
    ])

    // Score
    expect(typeof result.score).toBe('number')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)

    // Sources
    expect(result.sources).toHaveLength(2)
    for (const source of result.sources) {
      expect(source.bandEnergy).toHaveLength(29)
      expect(typeof source.totalEnergy).toBe('number')
      expect(source.label).toBeTruthy()
      expect(source.filePath).toBeTruthy()
      expect(['lead', 'support']).toContain(source.role)
      // Band energy should sum to ~1.0
      const sum = source.bandEnergy.reduce((s, e) => s + e, 0)
      expect(sum).toBeCloseTo(1.0, 1)
    }

    // Band frequencies
    expect(result.bandFrequencies).toHaveLength(29)
    expect(result.bandFrequencies[0]).toBe(31.5)
    expect(result.bandFrequencies[28]).toBe(20000)

    // Clashes
    expect(Array.isArray(result.clashes)).toBe(true)
    if (result.clashes.length > 0) {
      const clash = result.clashes[0]
      expect(typeof clash.centerHz).toBe('number')
      expect(typeof clash.severity).toBe('number')
      expect(typeof clash.region).toBe('string')
      expect(typeof clash.cutSourceIndex).toBe('number')
      expect(typeof clash.rationale).toBe('string')
    }

    // Fixes
    expect(Array.isArray(result.fixes)).toBe(true)
    if (result.fixes.length > 0) {
      const fix = result.fixes[0]
      expect(typeof fix.sourceIndex).toBe('number')
      expect(typeof fix.sourceLabel).toBe('string')
      expect(typeof fix.frequency).toBe('number')
      expect(typeof fix.eq8Value).toBe('number')
      expect(typeof fix.gain).toBe('number')
      expect(typeof fix.q).toBe('number')
      expect(typeof fix.clashingWith).toBe('string')
      expect(typeof fix.rationale).toBe('string')
    }
  })

  it('throws if fewer than 2 sources provided', async () => {
    await expect(
      detectClashes([{ filePath: '/fake/a.wav', label: 'A', role: 'support' }])
    ).rejects.toThrow('at least 2 sources')
  })
})
