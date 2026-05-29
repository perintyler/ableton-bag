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

/**
 * Compute a multi-metric timbre similarity score between two audio files.
 *
 * Uses MFCC cosine similarity, spectral convergence, centroid distance,
 * and per-band energy correlation. Returns an overall score from 0 to 1
 * where 1 means identical timbre.
 *
 * Uses Python/librosa under the hood.
 */
export async function timbreSimilarity(
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
 * Compute the MFCC cosine distance between two audio files using
 * Dynamic Time Warping (DTW) for sequences of different lengths.
 *
 * Returns a distance from 0 (identical) to 2 (maximally different),
 * along with the average DTW path cost.
 *
 * Uses Python/librosa under the hood.
 */
export async function mfccDistance(
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
