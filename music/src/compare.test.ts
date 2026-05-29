import { describe, it, expect } from 'vitest'
import { suggestMacroValues } from './compare.js'
import type { AudioAnalysisResult } from './analyze.js'

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
