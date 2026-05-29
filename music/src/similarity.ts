import {
  loadAudio,
  stft,
  fftFrequencies,
  spectralCentroid,
  mfcc as computeMfcc,
} from './dsp.js'

export interface SimilarityResult {
  /** Overall similarity score 0-1 (1 = identical) */
  score: number
  /** MFCC cosine similarity (0-1, captures timbral fingerprint) */
  mfccSimilarity: number
  /** Spectral convergence (0 = identical spectra, lower = more similar) */
  spectralConvergence: number
  /** Centroid distance in Hz */
  centroidDistanceHz: number
  /** Per-band energy correlation (Pearson r, -1 to 1) */
  bandCorrelation: number
}

export interface MfccDistanceResult {
  /** MFCC cosine distance (0 = identical, 2 = maximally different) */
  distance: number
  /** Average DTW path cost */
  dtwCost: number
}

// ---------------------------------------------------------------------------
// Pure TypeScript helpers
// ---------------------------------------------------------------------------

/** Euclidean distance between two vectors */
function euclidean(a: Float64Array, b: Float64Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)
  if (normA === 0 || normB === 0) return 0
  return dot / (normA * normB)
}

/** Frobenius norm of a Float64Array */
function frobeniusNorm(v: Float64Array): number {
  let sum = 0
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i]
  return Math.sqrt(sum)
}

/** Pearson correlation between two arrays */
function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length
  if (n === 0) return 0
  let sumA = 0, sumB = 0
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i] }
  const meanA = sumA / n, meanB = sumB / n
  let num = 0, denA = 0, denB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  const den = Math.sqrt(denA) * Math.sqrt(denB)
  return den > 0 ? num / den : 0
}

/** Average a 2D array of Float64Arrays column-wise */
function averageMfcc(frames: Float64Array[]): Float64Array {
  if (frames.length === 0) return new Float64Array(0)
  const n = frames[0].length
  const avg = new Float64Array(n)
  for (const frame of frames) {
    for (let i = 0; i < n; i++) avg[i] += frame[i]
  }
  for (let i = 0; i < n; i++) avg[i] /= frames.length
  return avg
}

/**
 * Dynamic Time Warping on two sequences of MFCC vectors.
 * Returns the average path cost.
 */
function dtw(seqA: Float64Array[], seqB: Float64Array[]): number {
  const n = seqA.length, m = seqB.length
  if (n === 0 || m === 0) return 0

  // Use two rows instead of full matrix for memory efficiency
  let prev = new Float64Array(m + 1).fill(Infinity)
  let curr = new Float64Array(m + 1).fill(Infinity)
  prev[0] = 0

  for (let i = 1; i <= n; i++) {
    curr.fill(Infinity)
    for (let j = 1; j <= m; j++) {
      const d = euclidean(seqA[i - 1], seqB[j - 1])
      curr[j] = d + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    ;[prev, curr] = [curr, prev]
  }

  return prev[m] / (n + m)
}

/** Compute band energies for an averaged spectrum */
function computeBandEnergies(avgSpec: Float64Array, freqs: Float64Array): number[] {
  const bands: [number, number][] = [
    [0, 100], [100, 500], [500, 2000], [2000, 4000],
    [4000, 8000], [8000, 12000], [12000, 20000],
  ]
  return bands.map(([lo, hi]) => {
    let energy = 0
    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] >= lo && freqs[i] < hi) {
        energy += avgSpec[i] * avgSpec[i]
      }
    }
    return energy
  })
}

// ---------------------------------------------------------------------------
// Pure TypeScript implementations
// ---------------------------------------------------------------------------

/**
 * Pure TypeScript implementation of timbreSimilarity using dsp.ts.
 */
export async function timbreSimilarityTS(
  fileA: string,
  fileB: string,
): Promise<SimilarityResult> {
  const sr = 44100
  const nFft = 4096

  const [audioA, audioB] = await Promise.all([
    loadAudio(fileA, sr),
    loadAudio(fileB, sr),
  ])

  // MFCC cosine similarity
  const mfccA = computeMfcc(audioA.samples, sr, { nMfcc: 13 })
  const mfccB = computeMfcc(audioB.samples, sr, { nMfcc: 13 })
  const avgMfccA = averageMfcc(mfccA)
  const avgMfccB = averageMfcc(mfccB)
  let mfccSim = cosineSimilarity(avgMfccA, avgMfccB)
  mfccSim = Math.max(0, Math.min(1, mfccSim))

  // Spectral convergence
  const framesA = stft(audioA.samples, { nFft, hopLength: 512 })
  const framesB = stft(audioB.samples, { nFft, hopLength: 512 })
  const freqs = fftFrequencies(sr, nFft)
  const numBins = freqs.length

  const avgSpecA = new Float64Array(numBins)
  const avgSpecB = new Float64Array(numBins)
  for (const f of framesA) for (let i = 0; i < numBins; i++) avgSpecA[i] += f[i]
  for (const f of framesB) for (let i = 0; i < numBins; i++) avgSpecB[i] += f[i]
  if (framesA.length > 0) for (let i = 0; i < numBins; i++) avgSpecA[i] /= framesA.length
  if (framesB.length > 0) for (let i = 0; i < numBins; i++) avgSpecB[i] /= framesB.length

  const diff = new Float64Array(numBins)
  for (let i = 0; i < numBins; i++) diff[i] = avgSpecB[i] - avgSpecA[i]
  const normTarget = frobeniusNorm(avgSpecB)
  const spectralConv = normTarget > 0 ? frobeniusNorm(diff) / normTarget : 0

  // Centroid distance
  let centA = 0, centB = 0
  for (const f of framesA) centA += spectralCentroid(f, freqs)
  for (const f of framesB) centB += spectralCentroid(f, freqs)
  if (framesA.length > 0) centA /= framesA.length
  if (framesB.length > 0) centB /= framesB.length
  const centroidDist = Math.abs(centA - centB)

  // Band energy correlation
  const bandsA = computeBandEnergies(avgSpecA, freqs)
  const bandsB = computeBandEnergies(avgSpecB, freqs)
  const bandCorr = pearsonCorrelation(bandsA, bandsB)

  // Overall score
  const spectralSim = Math.max(0, 1 - spectralConv)
  const centroidSim = 1 - Math.min(centroidDist / 5000, 1)
  let score = 0.4 * mfccSim + 0.3 * spectralSim + 0.2 * bandCorr + 0.1 * centroidSim
  score = Math.max(0, Math.min(1, score))

  return {
    score: Math.round(score * 1e6) / 1e6,
    mfccSimilarity: Math.round(mfccSim * 1e6) / 1e6,
    spectralConvergence: Math.round(spectralConv * 1e6) / 1e6,
    centroidDistanceHz: Math.round(centroidDist * 100) / 100,
    bandCorrelation: Math.round(bandCorr * 1e6) / 1e6,
  }
}

/**
 * Pure TypeScript implementation of mfccDistance using dsp.ts.
 */
export async function mfccDistanceTS(
  fileA: string,
  fileB: string,
): Promise<MfccDistanceResult> {
  const sr = 44100

  const [audioA, audioB] = await Promise.all([
    loadAudio(fileA, sr),
    loadAudio(fileB, sr),
  ])

  const mfccA = computeMfcc(audioA.samples, sr, { nMfcc: 13 })
  const mfccB = computeMfcc(audioB.samples, sr, { nMfcc: 13 })

  // DTW cost
  const dtwCost = dtw(mfccA, mfccB)

  // Cosine distance using averaged vectors
  const meanA = averageMfcc(mfccA)
  const meanB = averageMfcc(mfccB)
  const sim = cosineSimilarity(meanA, meanB)
  const distance = 1 - sim

  return {
    distance: Math.round(distance * 1e6) / 1e6,
    dtwCost: Math.round(dtwCost * 1e6) / 1e6,
  }
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

/**
 * Compute a multi-metric timbre similarity score between two audio files.
 *
 * Uses MFCC cosine similarity, spectral convergence, centroid distance,
 * and per-band energy correlation. Returns an overall score from 0 to 1
 * where 1 means identical timbre.
 */
export const timbreSimilarity = timbreSimilarityTS

/**
 * Compute the MFCC cosine distance between two audio files using
 * Dynamic Time Warping (DTW) for sequences of different lengths.
 *
 * Returns a distance from 0 (identical) to 2 (maximally different),
 * along with the average DTW path cost.
 */
export const mfccDistance = mfccDistanceTS
