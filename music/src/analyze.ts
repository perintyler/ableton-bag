import {
  loadAudio,
  stft,
  fftFrequencies,
  spectralCentroid as dspSpectralCentroid,
  spectralBandwidth as dspSpectralBandwidth,
  spectralFlatness as dspSpectralFlatness,
  spectralRolloff as dspSpectralRolloff,
  bandEnergy as dspBandEnergy,
} from './dsp.js'

export interface SpectralAnalysis {
  /** Spectral centroid in Hz — higher = brighter */
  centroidHz: number
  /** Spectral bandwidth in Hz — higher = wider frequency spread */
  bandwidthHz: number
  /** Frequency below which 85% of energy sits */
  rolloff85Hz: number
  /** 0 = tonal/ringy, 1 = white noise */
  spectralFlatness: number
  /** Energy distribution by frequency band (percentage) */
  energyBands: {
    subBass: number
    bass: number
    lowMid: number
    mid: number
    upperMid: number
    presence: number
    air: number
  }
  /** Top resonant frequencies in Hz */
  peakFrequencies: number[]
}

export interface TransientAnalysis {
  /** Median attack time in ms (10% to peak) */
  attackMs: number
  /** Median decay time in ms (peak to 10%) */
  decayMs: number
  /** Total detected transient hits */
  hitCount: number
}

export interface AudioAnalysisResult {
  spectral: SpectralAnalysis
  transient: TransientAnalysis
  summary: {
    brightness: 'dark' | 'medium' | 'bright'
    texture: 'tonal' | 'semi-metallic' | 'noisy'
    attack: 'very-fast' | 'fast' | 'medium' | 'slow'
    decay: 'short' | 'medium' | 'long'
  }
}

// ---------------------------------------------------------------------------
// Pure TypeScript implementation using dsp.ts
// ---------------------------------------------------------------------------

/**
 * Analyze the sonic character of an audio file using pure TypeScript DSP.
 * Uses the dsp.ts module — no Python/librosa dependency.
 */
export async function analyzeTimbreTS(
  filePath: string,
  options?: { sr?: number; nFft?: number; hopLength?: number }
): Promise<AudioAnalysisResult> {
  const sr = options?.sr ?? 44100
  const nFft = options?.nFft ?? 4096
  const hopLength = options?.hopLength ?? 512

  const { samples } = await loadAudio(filePath, sr)

  // Compute STFT magnitude spectrogram (frames x frequency bins)
  const spectrogram = stft(samples, { nFft, hopLength, window: 'hann' })
  const freqs = fftFrequencies(sr, nFft)
  const numBins = freqs.length

  // Compute average magnitude spectrum across all frames
  const avgSpectrum = new Float64Array(numBins)
  for (const frame of spectrogram) {
    for (let i = 0; i < numBins; i++) {
      avgSpectrum[i] += frame[i]
    }
  }
  const numFrames = spectrogram.length
  if (numFrames > 0) {
    for (let i = 0; i < numBins; i++) {
      avgSpectrum[i] /= numFrames
    }
  }

  // Spectral features (averaged across frames for centroid/bandwidth/rolloff/flatness)
  let centroidSum = 0
  let bandwidthSum = 0
  let rolloffSum = 0
  let flatnessSum = 0

  for (const frame of spectrogram) {
    const c = dspSpectralCentroid(frame, freqs)
    centroidSum += c
    bandwidthSum += dspSpectralBandwidth(frame, freqs, c)
    rolloffSum += dspSpectralRolloff(frame, freqs, 0.85)
    flatnessSum += dspSpectralFlatness(frame)
  }

  const centroid = numFrames > 0 ? centroidSum / numFrames : 0
  const bandwidth = numFrames > 0 ? bandwidthSum / numFrames : 0
  const rolloff = numFrames > 0 ? rolloffSum / numFrames : 0
  const flatness = numFrames > 0 ? flatnessSum / numFrames : 0

  // Energy bands from average spectrum
  const energyBands = {
    subBass: round1(dspBandEnergy(avgSpectrum, freqs, 0, 100)),
    bass: round1(dspBandEnergy(avgSpectrum, freqs, 100, 500)),
    lowMid: round1(dspBandEnergy(avgSpectrum, freqs, 500, 2000)),
    mid: round1(dspBandEnergy(avgSpectrum, freqs, 2000, 4000)),
    upperMid: round1(dspBandEnergy(avgSpectrum, freqs, 4000, 8000)),
    presence: round1(dspBandEnergy(avgSpectrum, freqs, 8000, 12000)),
    air: round1(dspBandEnergy(avgSpectrum, freqs, 12000, 20000)),
  }

  // Peak frequencies: top 5 bins by magnitude in the average spectrum
  const indexed = Array.from(avgSpectrum).map((v, i) => ({ v, i }))
  indexed.sort((a, b) => b.v - a.v)
  const peakFrequencies = indexed.slice(0, 5).map((x) => Math.round(freqs[x.i]))

  // --- Onset / transient analysis ---
  // Compute onset envelope from spectral flux (half-wave rectified difference)
  const onsetEnv = new Float64Array(Math.max(0, numFrames - 1))
  for (let t = 1; t < numFrames; t++) {
    let flux = 0
    for (let i = 0; i < numBins; i++) {
      const diff = spectrogram[t][i] - spectrogram[t - 1][i]
      if (diff > 0) flux += diff
    }
    onsetEnv[t - 1] = flux
  }

  // Find onset peaks (local maxima above a threshold)
  let envMax = -Infinity
  for (let i = 0; i < onsetEnv.length; i++) {
    if (onsetEnv[i] > envMax) envMax = onsetEnv[i]
  }
  const threshold = envMax * 0.3
  const onsetFrames: number[] = []
  for (let i = 1; i < onsetEnv.length - 1; i++) {
    if (
      onsetEnv[i] > threshold &&
      onsetEnv[i] >= onsetEnv[i - 1] &&
      onsetEnv[i] >= onsetEnv[i + 1]
    ) {
      onsetFrames.push(i)
    }
  }

  // Measure attack and decay times from onset envelope segments
  const hopTime = hopLength / sr
  const attackTimes: number[] = []
  const decayTimes: number[] = []

  // Use the strongest onsets (up to 50) for attack/decay measurement
  const sorted = onsetFrames.slice().sort((a, b) => onsetEnv[b] - onsetEnv[a])
  const strongOnsets = sorted.slice(0, 50)

  for (const idx of strongOnsets) {
    const s = Math.max(0, idx - 5)
    const e = Math.min(onsetEnv.length, idx + 50)
    const seg = onsetEnv.slice(s, e)
    if (seg.length < 10) continue

    let segMax = -Infinity
    let pk = 0
    for (let j = 0; j < seg.length; j++) {
      if (seg[j] > segMax) { segMax = seg[j]; pk = j }
    }
    const pv = seg[pk]
    if (pv < 0.1) continue

    const th = pv * 0.1

    // Attack: first crossing of 10% threshold up to peak
    let aStart = 0
    for (let j = 0; j < pk; j++) {
      if (seg[j] > th) {
        aStart = j
        break
      }
    }
    attackTimes.push((pk - aStart) * hopTime)

    // Decay: peak to first crossing below 10% threshold
    let dEnd = seg.length - 1
    for (let j = pk; j < seg.length; j++) {
      if (seg[j] < th) {
        dEnd = j
        break
      }
    }
    decayTimes.push((dEnd - pk) * hopTime)
  }

  const medianAttack = attackTimes.length > 0 ? median(attackTimes) : 0
  const medianDecay = decayTimes.length > 0 ? median(decayTimes) : 0

  // Build summary
  const brightness: AudioAnalysisResult['summary']['brightness'] =
    centroid > 8000 ? 'bright' : centroid > 6000 ? 'medium' : 'dark'

  const texture: AudioAnalysisResult['summary']['texture'] =
    flatness > 0.3 ? 'noisy' : flatness > 0.1 ? 'semi-metallic' : 'tonal'

  const attack: AudioAnalysisResult['summary']['attack'] =
    attackTimes.length > 0 && medianAttack < 0.005
      ? 'very-fast'
      : attackTimes.length > 0 && medianAttack < 0.015
        ? 'fast'
        : attackTimes.length > 0
          ? 'medium'
          : 'slow'

  const decay: AudioAnalysisResult['summary']['decay'] =
    decayTimes.length > 0 && medianDecay < 0.1
      ? 'short'
      : decayTimes.length > 0 && medianDecay < 0.3
        ? 'medium'
        : 'long'

  return {
    spectral: {
      centroidHz: Math.round(centroid),
      bandwidthHz: Math.round(bandwidth),
      rolloff85Hz: Math.round(rolloff),
      spectralFlatness: round4(flatness),
      energyBands,
      peakFrequencies,
    },
    transient: {
      attackMs: round1(medianAttack * 1000),
      decayMs: round1(medianDecay * 1000),
      hitCount: onsetFrames.length,
    },
    summary: { brightness, texture, attack, decay },
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Analyze the sonic character of an audio file using pure TypeScript DSP.
 */
export const analyzeTimbre = analyzeTimbreTS

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function median(arr: number[]): number {
  const sorted = arr.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

