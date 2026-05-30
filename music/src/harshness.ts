/**
 * Harshness detection module — identifies resonant peaks in the 2-8kHz range
 * and generates EQ recommendations for fixing them.
 *
 * Inspired by soothe2's approach: per-frame STFT, find peaks protruding above
 * the local spectral envelope, track across time, classify, and recommend fixes.
 */

import { loadAudio, stft, fftFrequencies, type STFTOptions } from './dsp.js'
import { hzToEQ8 } from './eq-mapping.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HarshnessOptions {
  /** Sensitivity threshold in dB — peaks must protrude this much above the local envelope (default: 6) */
  sensitivityDb?: number
  /** FFT size (default: 4096) */
  nFft?: number
  /** Hop length in samples (default: 512) */
  hopLength?: number
  /** Sample rate for analysis (default: 44100) */
  sampleRate?: number
  /** Minimum duration in seconds for a region to be reported (default: 0.05) */
  minDurationSec?: number
}

export type HarshType = 'resonance' | 'sibilance' | 'buildup'

export interface HarshRegion {
  /** Center frequency in Hz */
  frequency: number
  /** Bandwidth in Hz (estimated from -3dB points) */
  bandwidth: number
  /** Severity in dB above the local spectral envelope */
  severity: number
  /** Start time in seconds */
  startTime: number
  /** End time in seconds */
  endTime: number
  /** Classification */
  type: HarshType
}

export interface HarshnessBand {
  /** Band name */
  name: string
  /** Lower frequency bound in Hz */
  lowHz: number
  /** Upper frequency bound in Hz */
  highHz: number
  /** Harshness score 0-100 */
  score: number
}

export interface EQFix {
  /** Center frequency in Hz */
  frequency: number
  /** EQ Eight normalized frequency value (0-1) */
  eq8Value: number
  /** Gain in dB (negative = cut) */
  gain: number
  /** Q factor (frequency / bandwidth) */
  q: number
  /** Whether this should be a static or dynamic cut */
  mode: 'static' | 'dynamic'
  /** Human-readable explanation */
  rationale: string
}

export interface HarshnessSummary {
  /** Overall harshness score 0-100 */
  score: number
  /** Detected harsh regions */
  regions: HarshRegion[]
  /** Per-sub-band scores */
  bands: HarshnessBand[]
  /** EQ recommendations (up to 8 for EQ Eight) */
  eqRecommendations: EQFix[]
  /** Duration of audio analyzed in seconds */
  durationSec: number
}

// ---------------------------------------------------------------------------
// Sub-band definitions
// ---------------------------------------------------------------------------

const SUB_BANDS = [
  { name: 'nasal', lowHz: 2000, highHz: 3000, weight: 1.0 },
  { name: 'presence', lowHz: 3000, highHz: 5000, weight: 2.0 }, // perceptually harshest
  { name: 'sibilance', lowHz: 5000, highHz: 8000, weight: 1.0 },
] as const

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert linear magnitude to dB */
function toDB(mag: number): number {
  return 20 * Math.log10(Math.max(mag, 1e-10))
}

/**
 * Compute a local spectral envelope via moving average across frequency bins.
 * Uses a window of `halfWidth * 2 + 1` bins centered on each bin.
 */
function localEnvelope(magnitudes: Float64Array, halfWidth: number): Float64Array {
  const n = magnitudes.length
  const envelope = new Float64Array(n)

  // Running sum for efficiency
  let sum = 0
  for (let i = 0; i < Math.min(halfWidth + 1, n); i++) {
    sum += magnitudes[i]
  }

  for (let i = 0; i < n; i++) {
    const left = i - halfWidth
    const right = i + halfWidth

    // Add the new right element
    if (right >= 0 && right < n && i > 0) {
      sum += magnitudes[right]
    }
    // Remove the element that fell off the left
    if (left - 1 >= 0 && i > 0) {
      sum -= magnitudes[left - 1]
    }

    const actualLeft = Math.max(0, left)
    const actualRight = Math.min(n - 1, right)
    const count = actualRight - actualLeft + 1
    envelope[i] = sum / count
  }

  // Fix: recompute properly since the running sum approach above is approximate
  // for edge cases. Use a clean implementation.
  for (let i = 0; i < n; i++) {
    const left = Math.max(0, i - halfWidth)
    const right = Math.min(n - 1, i + halfWidth)
    let s = 0
    for (let j = left; j <= right; j++) {
      s += magnitudes[j]
    }
    envelope[i] = s / (right - left + 1)
  }

  return envelope
}

interface PeakInfo {
  binIndex: number
  frequency: number
  severityDb: number
  bandwidth: number
}

/**
 * Find peaks in a single frame that protrude above the local envelope.
 */
function findFramePeaks(
  magnitudes: Float64Array,
  frequencies: Float64Array,
  envelope: Float64Array,
  sensitivityDb: number,
  lowBin: number,
  highBin: number,
): PeakInfo[] {
  const peaks: PeakInfo[] = []

  for (let i = Math.max(lowBin, 1); i < Math.min(highBin, magnitudes.length - 1); i++) {
    const magDb = toDB(magnitudes[i])
    const envDb = toDB(envelope[i])
    const protrusion = magDb - envDb

    if (protrusion < sensitivityDb) continue

    // Check it's a local maximum
    if (magnitudes[i] <= magnitudes[i - 1] || magnitudes[i] <= magnitudes[i + 1]) continue

    // Estimate bandwidth via -3dB points
    const threshold = magnitudes[i] * 0.707 // -3dB
    let leftEdge = i
    let rightEdge = i
    while (leftEdge > lowBin && magnitudes[leftEdge] > threshold) leftEdge--
    while (rightEdge < highBin - 1 && magnitudes[rightEdge] > threshold) rightEdge++

    const bw = frequencies[rightEdge] - frequencies[leftEdge]

    peaks.push({
      binIndex: i,
      frequency: frequencies[i],
      severityDb: protrusion,
      bandwidth: Math.max(bw, frequencies[1] - frequencies[0]), // at least 1 bin width
    })
  }

  return peaks
}

interface TrackedPeak {
  frequency: number
  bandwidth: number
  severitySum: number
  frameCount: number
  peakSeverity: number
  firstFrame: number
  lastFrame: number
  frameIndices: number[]
}

/**
 * Track peaks across frames — merge nearby peaks (within 1 semitone) into regions.
 */
function trackPeaks(
  allFramePeaks: PeakInfo[][],
  minFrames: number,
): TrackedPeak[] {
  const tracked: TrackedPeak[] = []
  const active: TrackedPeak[] = []
  const FREQ_TOLERANCE = Math.pow(2, 1 / 12) // 1 semitone ratio

  for (let frame = 0; frame < allFramePeaks.length; frame++) {
    const framePeaks = allFramePeaks[frame]
    const matched = new Set<number>()

    // Try to extend existing active peaks
    for (const peak of framePeaks) {
      let bestMatch: TrackedPeak | null = null
      let bestDist = Infinity

      for (let a = 0; a < active.length; a++) {
        if (matched.has(a)) continue
        const ratio = peak.frequency / active[a].frequency
        const dist = Math.abs(Math.log2(ratio))
        if (dist < Math.log2(FREQ_TOLERANCE) && dist < bestDist) {
          bestDist = dist
          bestMatch = active[a]
          matched.add(a)
        }
      }

      if (bestMatch) {
        bestMatch.severitySum += peak.severityDb
        bestMatch.frameCount++
        bestMatch.peakSeverity = Math.max(bestMatch.peakSeverity, peak.severityDb)
        bestMatch.lastFrame = frame
        bestMatch.frameIndices.push(frame)
        // Update frequency as weighted average
        bestMatch.frequency =
          (bestMatch.frequency * (bestMatch.frameCount - 1) + peak.frequency) / bestMatch.frameCount
        bestMatch.bandwidth =
          (bestMatch.bandwidth * (bestMatch.frameCount - 1) + peak.bandwidth) / bestMatch.frameCount
      } else {
        active.push({
          frequency: peak.frequency,
          bandwidth: peak.bandwidth,
          severitySum: peak.severityDb,
          frameCount: 1,
          peakSeverity: peak.severityDb,
          firstFrame: frame,
          lastFrame: frame,
          frameIndices: [frame],
        })
      }
    }

    // Retire active peaks that haven't been matched for a while
    for (let a = active.length - 1; a >= 0; a--) {
      if (frame - active[a].lastFrame > 5) {
        if (active[a].frameCount >= minFrames) {
          tracked.push(active[a])
        }
        active.splice(a, 1)
      }
    }
  }

  // Flush remaining active peaks
  for (const a of active) {
    if (a.frameCount >= minFrames) {
      tracked.push(a)
    }
  }

  return tracked
}

/**
 * Classify a tracked peak as resonance, sibilance, or buildup.
 */
function classifyPeak(
  peak: TrackedPeak,
  totalFrames: number,
): HarshType {
  const durationRatio = peak.frameCount / totalFrames

  // Sibilance: 5-8kHz range and transient (not continuous)
  if (peak.frequency >= 5000 && durationRatio < 0.8) {
    return 'sibilance'
  }

  // Resonance: present for >80% of the duration
  if (durationRatio >= 0.8) {
    return 'resonance'
  }

  // Buildup: check if severity increases over time
  if (peak.frameIndices.length >= 3) {
    const midpoint = Math.floor(peak.frameIndices.length / 2)
    const firstHalf = peak.frameIndices.slice(0, midpoint)
    const secondHalf = peak.frameIndices.slice(midpoint)
    if (secondHalf.length > firstHalf.length * 1.3) {
      return 'buildup'
    }
  }

  // Default based on frequency
  if (peak.frequency >= 5000) return 'sibilance'
  return 'resonance'
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Detect harshness (resonant peaks in the 2-8kHz range) in an audio file.
 *
 * Returns regions, per-band scores, an overall score, and EQ recommendations
 * compatible with Ableton's EQ Eight.
 */
export async function detectHarshness(
  filePath: string,
  options?: HarshnessOptions,
): Promise<HarshnessSummary> {
  const sensitivityDb = options?.sensitivityDb ?? 6
  const nFft = options?.nFft ?? 4096
  const hopLength = options?.hopLength ?? 512
  const sampleRate = options?.sampleRate ?? 44100
  const minDurationSec = options?.minDurationSec ?? 0.05

  // Load and compute STFT
  const { samples } = await loadAudio(filePath, sampleRate)
  const spectrogram = stft(samples, { nFft, hopLength, window: 'hann' })
  const frequencies = fftFrequencies(sampleRate, nFft)
  const totalFrames = spectrogram.length
  const durationSec = samples.length / sampleRate
  const secPerFrame = hopLength / sampleRate
  const minFrames = Math.max(1, Math.ceil(minDurationSec / secPerFrame))

  // Find bin range for 2-8kHz
  let lowBin = 0
  let highBin = frequencies.length - 1
  for (let i = 0; i < frequencies.length; i++) {
    if (frequencies[i] >= 2000 && lowBin === 0) lowBin = i
    if (frequencies[i] >= 8000) { highBin = i; break }
  }

  // Envelope half-width: ~200Hz worth of bins
  const binSpacing = frequencies[1] - frequencies[0]
  const envelopeHalfWidth = Math.max(1, Math.round(200 / binSpacing))

  // Per-frame peak detection
  const allFramePeaks: PeakInfo[][] = []
  const bandEnergies = SUB_BANDS.map(() => ({ peakEnergy: 0, totalEnergy: 0 }))

  for (let frame = 0; frame < totalFrames; frame++) {
    const magnitudes = spectrogram[frame]
    const envelope = localEnvelope(magnitudes, envelopeHalfWidth)
    const peaks = findFramePeaks(magnitudes, frequencies, envelope, sensitivityDb, lowBin, highBin)
    allFramePeaks.push(peaks)

    // Accumulate per-band energy stats
    for (let b = 0; b < SUB_BANDS.length; b++) {
      const band = SUB_BANDS[b]
      for (let i = 0; i < magnitudes.length; i++) {
        if (frequencies[i] >= band.lowHz && frequencies[i] < band.highHz) {
          const power = magnitudes[i] * magnitudes[i]
          bandEnergies[b].totalEnergy += power
          const envDb = toDB(envelope[i])
          const magDb = toDB(magnitudes[i])
          if (magDb - envDb > sensitivityDb) {
            bandEnergies[b].peakEnergy += power
          }
        }
      }
    }
  }

  // Track peaks across frames
  const trackedPeaks = trackPeaks(allFramePeaks, minFrames)

  // Convert to HarshRegion entries
  const regions: HarshRegion[] = trackedPeaks.map((peak) => ({
    frequency: Math.round(peak.frequency),
    bandwidth: Math.round(peak.bandwidth),
    severity: Math.round((peak.severitySum / peak.frameCount) * 10) / 10,
    startTime: Math.round(peak.firstFrame * secPerFrame * 1000) / 1000,
    endTime: Math.round(peak.lastFrame * secPerFrame * 1000) / 1000,
    type: classifyPeak(peak, totalFrames),
  }))

  // Sort by severity descending
  regions.sort((a, b) => b.severity - a.severity)

  // Per-band scores (0-100)
  const bands: HarshnessBand[] = SUB_BANDS.map((band, i) => {
    const ratio = bandEnergies[i].totalEnergy > 0
      ? bandEnergies[i].peakEnergy / bandEnergies[i].totalEnergy
      : 0
    return {
      name: band.name,
      lowHz: band.lowHz,
      highHz: band.highHz,
      score: Math.round(Math.min(100, ratio * 500)),
    }
  })

  // Overall score: weighted combination
  let weightedSum = 0
  let totalWeight = 0
  for (let i = 0; i < bands.length; i++) {
    weightedSum += bands[i].score * SUB_BANDS[i].weight
    totalWeight += SUB_BANDS[i].weight
  }
  const score = Math.round(weightedSum / totalWeight)

  // Generate EQ recommendations (up to 8 bands for EQ Eight)
  const eqRecommendations: EQFix[] = regions.slice(0, 8).map((region) => {
    const q = region.bandwidth > 0 ? region.frequency / region.bandwidth : 4
    const gain = Math.max(-6, -region.severity * 0.5)
    const mode: 'static' | 'dynamic' = region.type === 'resonance' ? 'static' : 'dynamic'

    const typeLabel =
      region.type === 'sibilance' ? 'sibilant peak' :
      region.type === 'buildup' ? 'building resonance' :
      'static resonance'

    return {
      frequency: region.frequency,
      eq8Value: hzToEQ8(region.frequency),
      gain: Math.round(gain * 10) / 10,
      q: Math.round(Math.min(q, 18) * 10) / 10, // EQ Eight max Q is ~18
      mode,
      rationale: `${typeLabel} at ${region.frequency}Hz, ${region.severity.toFixed(1)}dB above envelope`,
    }
  })

  return {
    score,
    regions,
    bands,
    eqRecommendations,
    durationSec: Math.round(durationSec * 100) / 100,
  }
}
