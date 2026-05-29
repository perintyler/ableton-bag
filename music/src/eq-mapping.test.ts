import { describe, it, expect } from 'vitest'
import { hzToEQ8, eq8ToHz, EQ8_PRESETS, EQ8_FILTER_TYPES } from './eq-mapping.js'

describe('hzToEQ8', () => {
  it('maps 20Hz to 0', () => {
    expect(hzToEQ8(20)).toBeCloseTo(0, 2)
  })

  it('maps 20000Hz to 1', () => {
    expect(hzToEQ8(20000)).toBeCloseTo(1, 2)
  })

  it('maps common frequencies correctly', () => {
    // 100Hz should be roughly 0.233
    const val100 = hzToEQ8(100)
    expect(val100).toBeGreaterThan(0.2)
    expect(val100).toBeLessThan(0.3)

    // 1000Hz should be roughly 0.567
    const val1k = hzToEQ8(1000)
    expect(val1k).toBeGreaterThan(0.5)
    expect(val1k).toBeLessThan(0.6)
  })

  it('clamps below 20Hz to 0', () => {
    expect(hzToEQ8(10)).toBe(0)
  })

  it('clamps above 20kHz to 1', () => {
    expect(hzToEQ8(30000)).toBe(1)
  })
})

describe('eq8ToHz', () => {
  it('maps 0 to 20Hz', () => {
    expect(eq8ToHz(0)).toBeCloseTo(20, 0)
  })

  it('maps 1 to 20000Hz', () => {
    expect(eq8ToHz(1)).toBeCloseTo(20000, -2)
  })

  it('is inverse of hzToEQ8', () => {
    const testFreqs = [50, 100, 250, 500, 1000, 2000, 5000, 10000, 15000]
    for (const freq of testFreqs) {
      const roundTrip = eq8ToHz(hzToEQ8(freq))
      expect(roundTrip).toBeCloseTo(freq, -1)
    }
  })
})

describe('EQ8_PRESETS', () => {
  it('has valid normalized values', () => {
    for (const [_key, val] of Object.entries(EQ8_PRESETS)) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(1)
    }
  })

  it('preset order matches frequency order', () => {
    expect(EQ8_PRESETS.HPF_30).toBeLessThan(EQ8_PRESETS.HPF_100)
    expect(EQ8_PRESETS.HPF_100).toBeLessThan(EQ8_PRESETS.MUD)
    expect(EQ8_PRESETS.MUD).toBeLessThan(EQ8_PRESETS.PRESENCE)
    expect(EQ8_PRESETS.PRESENCE).toBeLessThan(EQ8_PRESETS.AIR)
  })
})

describe('EQ8_FILTER_TYPES', () => {
  it('has standard filter type values', () => {
    expect(EQ8_FILTER_TYPES.BELL).toBe(3)
    expect(EQ8_FILTER_TYPES.LOW_SHELF).toBe(2)
    expect(EQ8_FILTER_TYPES.HIGH_SHELF).toBe(4)
  })
})
