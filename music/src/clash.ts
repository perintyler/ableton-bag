/**
 * Frequency clash detection — identifies masking between multiple audio sources
 * and generates EQ recommendations for surgical cuts on the weaker source.
 *
 * Uses 1/3 octave band analysis (29 bands, 31.5Hz–20kHz) to detect where
 * two or more sources compete for the same frequency space, then recommends
 * gentle bell cuts (max -4dB, Q 3–5) on the less prominent source.
 */

import { loadAudio, stft, fftFrequencies } from './dsp.js'
import { hzToEQ8 } from './eq-mapping.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClashSource {
  filePath: string
  label: string
  role: 'lead' | 'support'
}

export interface ClashOptions {
  /** Sample rate for analysis (default: 44100) */
  sampleRate?: number
  /** FFT size (default: 4096) */
  nFft?: number
  /** Hop length in samples (default: 512) */
  hopLength?: number
  /** Minimum relative energy in a band for it to be considered significant (default: 0.034 ~= 1/29) */
  significanceThreshold?: number
  /** Minimum severity to report a clash (default: 0.15) */
  minSeverity?: number
  /** Maximum number of EQ cuts per source (default: 4) */
  maxCutsPerSource?: number
}

export interface SourceProfile {
  label: string
  filePath: string
  role: 'lead' | 'support'
  /** Normalized energy per 1/3 octave band (sums to 1.0) */
  bandEnergy: number[]
  /** Total (unnormalized) energy */
  totalEnergy: number
}

export interface ClashRegion {
  /** Center frequency of the 1/3 octave band */
  centerHz: number
  /** Index of source A */
  sourceAIndex: number
  sourceALabel: string
  /** Index of source B */
  sourceBIndex: number
  sourceBLabel: string
  /** Normalized energy of source A in this band */
  energyA: number
  /** Normalized energy of source B in this band */
  energyB: number
  /** Severity 0-1: geometric mean of both energies */
  severity: number
  /** Human-readable region name */
  region: string
  /** Index of the source that should be cut */
  cutSourceIndex: number
  /** Explanation of why this source was chosen for the cut */
  rationale: string
}

export interface ClashFix {
  sourceIndex: number
  sourceLabel: string
  /** Center frequency to cut */
  frequency: number
  /** EQ Eight normalized frequency value (0-1) */
  eq8Value: number
  /** Gain in dB (negative = cut, capped at -4) */
  gain: number
  /** Q factor */
  q: number
  /** Label of the source this clashes with */
  clashingWith: string
  /** Human-readable explanation */
  rationale: string
}

export interface ClashSummary {
  /** Overall clash score 0-100 */
  score: number
  /** Per-source energy profiles */
  sources: SourceProfile[]
  /** Detected clash regions, sorted by severity descending */
  clashes: ClashRegion[]
  /** EQ fix recommendations per source */
  fixes: ClashFix[]
  /** The 29 band center frequencies used */
  bandFrequencies: number[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THIRD_OCTAVE_CENTERS = [
  31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
  630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300,
  8000, 10000, 12500, 16000, 20000,
]

const SIXTH_OCTAVE = Math.pow(2, 1 / 6)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute 1/3 octave energy profile from an average magnitude spectrum.
 * Returns a 29-element array normalized to sum to 1.0.
 */
export function computeEnergyProfile(
  avgSpectrum: Float64Array,
  frequencies: Float64Array,
): { normalized: number[]; totalEnergy: number } {
  const numBins = frequencies.length
  const bandEnergy: number[] = []
  let totalEnergy = 0

  for (const fc of THIRD_OCTAVE_CENTERS) {
    const lo = fc / SIXTH_OCTAVE
    const hi = fc * SIXTH_OCTAVE

    let energy = 0
    for (let i = 0; i < numBins; i++) {
      if (frequencies[i] >= lo && frequencies[i] < hi) {
        energy += avgSpectrum[i] * avgSpectrum[i] // power
      }
    }

    bandEnergy.push(energy)
    totalEnergy += energy
  }

  // Normalize to sum to 1.0
  const normalized = totalEnergy > 0
    ? bandEnergy.map(e => e / totalEnergy)
    : bandEnergy.map(() => 0)

  return { normalized, totalEnergy }
}

/** Map a frequency to a human-readable region name */
export function classifyRegion(hz: number): string {
  if (hz < 60) return 'sub'
  if (hz < 250) return 'bass'
  if (hz < 500) return 'low-mid'
  if (hz < 2000) return 'mid'
  if (hz < 4000) return 'upper-mid'
  if (hz < 8000) return 'presence'
  return 'air'
}

/** Q factor based on frequency region */
function qForFrequency(hz: number): number {
  if (hz < 250) return 3
  if (hz < 4000) return 4
  return 5
}

/**
 * Merge fixes that fall within the same 1/3 octave band per source.
 * Keeps the one with highest severity.
 */
export function mergeNearbyFixes(fixes: ClashFix[]): ClashFix[] {
  // Group by sourceIndex
  const bySource = new Map<number, ClashFix[]>()
  for (const fix of fixes) {
    const group = bySource.get(fix.sourceIndex) ?? []
    group.push(fix)
    bySource.set(fix.sourceIndex, group)
  }

  const merged: ClashFix[] = []

  for (const [, sourceFixes] of bySource) {
    // Sort by frequency
    sourceFixes.sort((a, b) => a.frequency - b.frequency)

    const deduped: ClashFix[] = []
    for (const fix of sourceFixes) {
      // Check if this frequency falls within the same 1/3 octave as the last added
      if (deduped.length > 0) {
        const last = deduped[deduped.length - 1]
        const ratio = fix.frequency / last.frequency
        if (ratio < SIXTH_OCTAVE * SIXTH_OCTAVE) {
          // Same 1/3 octave — keep the one with deeper cut (more negative gain)
          if (fix.gain < last.gain) {
            deduped[deduped.length - 1] = fix
          }
          continue
        }
      }
      deduped.push(fix)
    }

    merged.push(...deduped)
  }

  return merged
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Detect frequency clashes between multiple audio sources.
 *
 * Loads each source, computes its 1/3 octave energy profile, then for each
 * pair of sources identifies bands where both have significant energy.
 * Recommends gentle EQ cuts on the weaker source in each clashing band.
 */
export async function detectClashes(
  sources: ClashSource[],
  options?: ClashOptions,
): Promise<ClashSummary> {
  if (sources.length < 2) {
    throw new Error('detectClashes requires at least 2 sources')
  }

  const sampleRate = options?.sampleRate ?? 44100
  const nFft = options?.nFft ?? 4096
  const hopLength = options?.hopLength ?? 512
  const significanceThreshold = options?.significanceThreshold ?? (1 / 29)
  const minSeverity = options?.minSeverity ?? 0.15
  const maxCutsPerSource = options?.maxCutsPerSource ?? 4

  // 1. Load all sources and compute average magnitude spectrum
  const profiles: SourceProfile[] = []
  const frequencies = fftFrequencies(sampleRate, nFft)

  for (const source of sources) {
    const { samples } = await loadAudio(source.filePath, sampleRate)
    const frames = stft(samples, { nFft, hopLength, window: 'hann' })
    const numBins = frequencies.length

    // Average magnitude across all frames
    const avgSpectrum = new Float64Array(numBins)
    for (const frame of frames) {
      for (let i = 0; i < numBins; i++) avgSpectrum[i] += frame[i]
    }
    if (frames.length > 0) {
      for (let i = 0; i < numBins; i++) avgSpectrum[i] /= frames.length
    }

    // 2. Compute 1/3 octave energy profile
    const { normalized, totalEnergy } = computeEnergyProfile(avgSpectrum, frequencies)

    profiles.push({
      label: source.label,
      filePath: source.filePath,
      role: source.role,
      bandEnergy: normalized,
      totalEnergy,
    })
  }

  // 3. Pairwise clash detection
  const clashes: ClashRegion[] = []
  const numBands = THIRD_OCTAVE_CENTERS.length

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i]
      const b = profiles[j]

      for (let band = 0; band < numBands; band++) {
        const energyA = a.bandEnergy[band]
        const energyB = b.bandEnergy[band]

        // Skip if either source has negligible energy in this band
        if (energyA < significanceThreshold || energyB < significanceThreshold) continue

        // Geometric mean severity
        const severity = Math.min(1, 2 * Math.sqrt(energyA * energyB))

        if (severity < minSeverity) continue

        // Determine which source to cut
        let cutSourceIndex: number
        let rationale: string

        if (a.role === 'lead' && b.role !== 'lead') {
          cutSourceIndex = j
          rationale = `${b.label} yields to lead ${a.label}`
        } else if (b.role === 'lead' && a.role !== 'lead') {
          cutSourceIndex = i
          rationale = `${a.label} yields to lead ${b.label}`
        } else if (energyA <= energyB) {
          cutSourceIndex = i
          rationale = `${a.label} has less energy (${(energyA * 100).toFixed(1)}% vs ${(energyB * 100).toFixed(1)}%)`
        } else {
          cutSourceIndex = j
          rationale = `${b.label} has less energy (${(energyB * 100).toFixed(1)}% vs ${(energyA * 100).toFixed(1)}%)`
        }

        const centerHz = THIRD_OCTAVE_CENTERS[band]

        clashes.push({
          centerHz,
          sourceAIndex: i,
          sourceALabel: a.label,
          sourceBIndex: j,
          sourceBLabel: b.label,
          energyA,
          energyB,
          severity,
          region: classifyRegion(centerHz),
          cutSourceIndex,
          rationale,
        })
      }
    }
  }

  // 4. Sort by severity descending
  clashes.sort((a, b) => b.severity - a.severity)

  // 5. Generate fixes
  const rawFixes: ClashFix[] = clashes.map(clash => {
    const gain = Math.max(-4, -(clash.severity * 3))
    const q = qForFrequency(clash.centerHz)
    const clashingWith = clash.cutSourceIndex === clash.sourceAIndex
      ? clash.sourceBLabel
      : clash.sourceALabel

    return {
      sourceIndex: clash.cutSourceIndex,
      sourceLabel: profiles[clash.cutSourceIndex].label,
      frequency: clash.centerHz,
      eq8Value: hzToEQ8(clash.centerHz),
      gain: Math.round(gain * 10) / 10,
      q,
      clashingWith,
      rationale: `Cut ${classifyRegion(clash.centerHz)} at ${clash.centerHz}Hz (severity ${(clash.severity * 100).toFixed(0)}%) — ${clash.rationale}`,
    }
  })

  // 6. Merge nearby fixes and limit per source
  const mergedFixes = mergeNearbyFixes(rawFixes)

  // Limit to maxCutsPerSource per source
  const countPerSource = new Map<number, number>()
  const fixes: ClashFix[] = []
  // Sort merged fixes by gain (deepest cuts first) to keep the most important
  mergedFixes.sort((a, b) => a.gain - b.gain)
  for (const fix of mergedFixes) {
    const count = countPerSource.get(fix.sourceIndex) ?? 0
    if (count < maxCutsPerSource) {
      fixes.push(fix)
      countPerSource.set(fix.sourceIndex, count + 1)
    }
  }

  // 7. Overall score
  const numPairs = (profiles.length * (profiles.length - 1)) / 2
  const severitySum = clashes.reduce((sum, c) => sum + c.severity, 0)
  const score = Math.round(Math.min(100, 100 * severitySum / (numBands * numPairs)))

  return {
    score,
    sources: profiles,
    clashes,
    fixes,
    bandFrequencies: [...THIRD_OCTAVE_CENTERS],
  }
}
