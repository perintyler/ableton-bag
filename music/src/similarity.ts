import { exec, requireCmd } from './exec.js'
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
// Python fallbacks
// ---------------------------------------------------------------------------

/**
 * Python/librosa fallback for timbreSimilarity.
 */
export async function timbreSimilarityPython(
  fileA: string,
  fileB: string,
  options?: { python?: string }
): Promise<SimilarityResult> {
  const python = options?.python ?? await findPython()

  const script = `
import librosa
import numpy as np
import json
import sys

file_a = sys.argv[1]
file_b = sys.argv[2]

y_a, sr = librosa.load(file_a, sr=44100, mono=True)
y_b, _ = librosa.load(file_b, sr=44100, mono=True)

# --- MFCC cosine similarity ---
mfcc_a = np.mean(librosa.feature.mfcc(y=y_a, sr=sr, n_mfcc=13), axis=1)
mfcc_b = np.mean(librosa.feature.mfcc(y=y_b, sr=sr, n_mfcc=13), axis=1)
dot = np.dot(mfcc_a, mfcc_b)
norm_a = np.linalg.norm(mfcc_a)
norm_b = np.linalg.norm(mfcc_b)
mfcc_sim = float(dot / (norm_a * norm_b)) if (norm_a > 0 and norm_b > 0) else 0.0
# Clamp to 0-1 range
mfcc_sim = max(0.0, min(1.0, mfcc_sim))

# --- Spectral convergence ---
D_a = np.abs(librosa.stft(y_a, n_fft=4096))
D_b = np.abs(librosa.stft(y_b, n_fft=4096))
avg_spec_a = np.mean(D_a, axis=1)
avg_spec_b = np.mean(D_b, axis=1)
norm_target = np.linalg.norm(avg_spec_b)
spectral_conv = float(np.linalg.norm(avg_spec_b - avg_spec_a) / norm_target) if norm_target > 0 else 0.0

# --- Centroid distance ---
cent_a = float(np.mean(librosa.feature.spectral_centroid(y=y_a, sr=sr)[0]))
cent_b = float(np.mean(librosa.feature.spectral_centroid(y=y_b, sr=sr)[0]))
centroid_dist = abs(cent_a - cent_b)

# --- Band energy correlation ---
freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)

def band_energies(avg_spec):
    bands = [(0, 100), (100, 500), (500, 2000), (2000, 4000), (4000, 8000), (8000, 12000), (12000, 20000)]
    energies = []
    for lo, hi in bands:
        mask = (freqs >= lo) & (freqs < hi)
        energies.append(float(np.sum(avg_spec[mask] ** 2)))
    return np.array(energies)

bands_a = band_energies(avg_spec_a)
bands_b = band_energies(avg_spec_b)

# Pearson correlation
if np.std(bands_a) > 0 and np.std(bands_b) > 0:
    band_corr = float(np.corrcoef(bands_a, bands_b)[0, 1])
else:
    band_corr = 0.0

# --- Overall score ---
spectral_sim = max(0.0, 1.0 - spectral_conv)
centroid_sim = 1.0 - min(centroid_dist / 5000.0, 1.0)
score = 0.4 * mfcc_sim + 0.3 * spectral_sim + 0.2 * band_corr + 0.1 * centroid_sim
score = max(0.0, min(1.0, score))

result = {
    "score": round(score, 6),
    "mfccSimilarity": round(mfcc_sim, 6),
    "spectralConvergence": round(spectral_conv, 6),
    "centroidDistanceHz": round(centroid_dist, 2),
    "bandCorrelation": round(band_corr, 6),
}
print(json.dumps(result))
`

  const { stdout } = await exec(python, ['-c', script, fileA, fileB], {
    timeout: 120_000,
  })

  const lines = stdout.trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SimilarityResult
}

/**
 * Python/librosa fallback for mfccDistance.
 */
export async function mfccDistancePython(
  fileA: string,
  fileB: string,
  options?: { python?: string }
): Promise<MfccDistanceResult> {
  const python = options?.python ?? await findPython()

  const script = `
import librosa
import numpy as np
import json
import sys

file_a = sys.argv[1]
file_b = sys.argv[2]

y_a, sr = librosa.load(file_a, sr=44100, mono=True)
y_b, _ = librosa.load(file_b, sr=44100, mono=True)

# Compute full MFCC frame sequences (13 coefficients per frame)
mfcc_a = librosa.feature.mfcc(y=y_a, sr=sr, n_mfcc=13).T  # (frames_a, 13)
mfcc_b = librosa.feature.mfcc(y=y_b, sr=sr, n_mfcc=13).T  # (frames_b, 13)

n = len(mfcc_a)
m = len(mfcc_b)

# Build cost matrix using euclidean distance between frame vectors
cost = np.zeros((n, m))
for i in range(n):
    cost[i, :] = np.sqrt(np.sum((mfcc_a[i] - mfcc_b) ** 2, axis=1))

# DTW dynamic programming
dtw = np.full((n + 1, m + 1), np.inf)
dtw[0, 0] = 0.0
for i in range(1, n + 1):
    for j in range(1, m + 1):
        dtw[i, j] = cost[i - 1, j - 1] + min(dtw[i - 1, j], dtw[i, j - 1], dtw[i - 1, j - 1])

# Trace back optimal warping path to get path length
i, j = n, m
path_length = 0
path_cost = 0.0
while i > 0 and j > 0:
    path_cost += cost[i - 1, j - 1]
    path_length += 1
    candidates = [(dtw[i - 1, j - 1], i - 1, j - 1), (dtw[i - 1, j], i - 1, j), (dtw[i, j - 1], i, j - 1)]
    _, i, j = min(candidates, key=lambda x: x[0])

avg_cost = float(path_cost / path_length) if path_length > 0 else 0.0

# MFCC cosine distance using averaged vectors
mean_a = np.mean(mfcc_a, axis=0)
mean_b = np.mean(mfcc_b, axis=0)
norm_a = np.linalg.norm(mean_a)
norm_b = np.linalg.norm(mean_b)
if norm_a > 0 and norm_b > 0:
    cos_sim = np.dot(mean_a, mean_b) / (norm_a * norm_b)
    distance = float(1.0 - cos_sim)  # 0 = identical, 2 = maximally different
else:
    distance = 2.0

result = {
    "distance": round(distance, 6),
    "dtwCost": round(avg_cost, 6),
}
print(json.dumps(result))
`

  const { stdout } = await exec(python, ['-c', script, fileA, fileB], {
    timeout: 120_000,
  })

  const lines = stdout.trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as MfccDistanceResult
}

// ---------------------------------------------------------------------------
// Main exports — try TS first, fall back to Python
// ---------------------------------------------------------------------------

/**
 * Compute a multi-metric timbre similarity score between two audio files.
 *
 * Uses MFCC cosine similarity, spectral convergence, centroid distance,
 * and per-band energy correlation. Returns an overall score from 0 to 1
 * where 1 means identical timbre.
 *
 * Tries the pure TypeScript implementation first, falls back to Python/librosa.
 */
export async function timbreSimilarity(
  fileA: string,
  fileB: string,
  options?: { python?: string }
): Promise<SimilarityResult> {
  try {
    return await timbreSimilarityTS(fileA, fileB)
  } catch {
    return timbreSimilarityPython(fileA, fileB, options)
  }
}

/**
 * Compute the MFCC cosine distance between two audio files using
 * Dynamic Time Warping (DTW) for sequences of different lengths.
 *
 * Returns a distance from 0 (identical) to 2 (maximally different),
 * along with the average DTW path cost.
 *
 * Tries the pure TypeScript implementation first, falls back to Python/librosa.
 */
export async function mfccDistance(
  fileA: string,
  fileB: string,
  options?: { python?: string }
): Promise<MfccDistanceResult> {
  try {
    return await mfccDistanceTS(fileA, fileB)
  } catch {
    return mfccDistancePython(fileA, fileB, options)
  }
}

async function findPython(): Promise<string> {
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')

  const venvPython = join(
    process.env.HOME ?? '',
    'audio-tools-venv',
    'bin',
    'python3'
  )
  if (existsSync(venvPython)) return venvPython

  await requireCmd('python3')
  return 'python3'
}
