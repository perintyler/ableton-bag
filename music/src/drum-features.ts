import { exec } from './exec.js'
import {
  loadAudio,
  stft,
  fftFrequencies,
  spectralCentroid,
  spectralFlatness,
  bandEnergy,
} from './dsp.js'

export interface DrumFeatures {
  /** High-frequency content (spectral centroid, normalized 0-100) */
  brightness: number
  /** Attack sharpness (inverse log attack time, 0-100) */
  hardness: number
  /** Low-frequency perception (low-freq centroid, 0-100) */
  depth: number
  /** Noise-like vs tonal (spectral flatness, 0-100) */
  roughness: number
  /** Low-frequency resonance energy (0-100) */
  boominess: number
  /** Mid-frequency warmth (0-100) */
  warmth: number
  /** High-frequency sharpness (0-100) */
  sharpness: number
}

export interface SampleMatch {
  path: string
  features: DrumFeatures
  distance: number
}

/**
 * Pure TypeScript implementation of extractDrumFeatures using dsp.ts.
 */
export async function extractDrumFeaturesTS(
  filePath: string,
): Promise<DrumFeatures> {
  const sr = 44100
  const nFft = 4096
  const hopLength = 512

  const { samples } = await loadAudio(filePath, sr)
  const frames = stft(samples, { nFft, hopLength })
  const freqs = fftFrequencies(sr, nFft)
  const numBins = freqs.length

  // Average magnitude spectrum across all frames
  const avgSpectrum = new Float64Array(numBins)
  for (const frame of frames) {
    for (let i = 0; i < numBins; i++) avgSpectrum[i] += frame[i]
  }
  if (frames.length > 0) {
    for (let i = 0; i < numBins; i++) avgSpectrum[i] /= frames.length
  }

  // --- Brightness: average spectral centroid / 10000 * 100 ---
  let centroidSum = 0
  for (const frame of frames) {
    centroidSum += spectralCentroid(frame, freqs)
  }
  const avgCentroid = frames.length > 0 ? centroidSum / frames.length : 0
  const brightness = Math.min(Math.max(avgCentroid / 10000 * 100, 0), 100)

  // --- Hardness: onset envelope from spectral flux, attack time ---
  // Compute spectral flux (half-wave rectified difference between frames)
  const onsetEnv = new Float64Array(Math.max(0, frames.length))
  for (let t = 1; t < frames.length; t++) {
    let flux = 0
    for (let i = 0; i < numBins; i++) {
      const diff = frames[t][i] - frames[t - 1][i]
      if (diff > 0) flux += diff
    }
    onsetEnv[t] = flux
  }

  let pkIdx = 0
  let pkVal = 0
  for (let i = 0; i < onsetEnv.length; i++) {
    if (onsetEnv[i] > pkVal) {
      pkVal = onsetEnv[i]
      pkIdx = i
    }
  }

  const hopTime = hopLength / sr
  const threshold = pkVal * 0.1
  let aStart = 0
  for (let j = 0; j < pkIdx; j++) {
    if (onsetEnv[j] > threshold) {
      aStart = j
      break
    }
  }

  const latMs = (pkIdx - aStart) * hopTime * 1000
  let hardness: number
  if (latMs < 5) {
    hardness = 100.0
  } else if (latMs > 100) {
    hardness = 0.0
  } else {
    hardness = (1 - (Math.log(latMs) - Math.log(5)) / (Math.log(100) - Math.log(5))) * 100
  }
  hardness = Math.min(Math.max(hardness, 0), 100)

  // --- Depth: centroid of frequencies below 500Hz ---
  const lowMags = new Float64Array(numBins)
  const lowFreqs = new Float64Array(numBins)
  let lowCount = 0
  for (let i = 0; i < numBins; i++) {
    if (freqs[i] < 500) {
      lowMags[lowCount] = avgSpectrum[i]
      lowFreqs[lowCount] = freqs[i]
      lowCount++
    }
  }
  const lowMagsSlice = lowMags.subarray(0, lowCount)
  const lowFreqsSlice = lowFreqs.subarray(0, lowCount)
  let lowSum = 0
  for (let i = 0; i < lowCount; i++) lowSum += lowMagsSlice[i]
  let depth: number
  if (lowSum > 0) {
    const lowCentroid = spectralCentroid(lowMagsSlice, lowFreqsSlice)
    depth = (1 - lowCentroid / 500) * 100
  } else {
    depth = 0
  }
  depth = Math.min(Math.max(depth, 0), 100)

  // --- Roughness: average spectral flatness * 100 ---
  let flatnessSum = 0
  for (const frame of frames) {
    flatnessSum += spectralFlatness(frame)
  }
  const avgFlatness = frames.length > 0 ? flatnessSum / frames.length : 0
  const roughness = Math.min(Math.max(avgFlatness * 100, 0), 100)

  // --- Boominess: bandEnergy 0-150Hz ---
  const boominess = Math.min(Math.max(bandEnergy(avgSpectrum, freqs, 0, 150), 0), 100)

  // --- Warmth: bandEnergy 200-2000Hz ---
  const warmth = Math.min(Math.max(bandEnergy(avgSpectrum, freqs, 200, 2000), 0), 100)

  // --- Sharpness: bandEnergy 4000-22050Hz ---
  const sharpness = Math.min(Math.max(bandEnergy(avgSpectrum, freqs, 4000, 22050), 0), 100)

  return {
    brightness: Math.round(brightness * 100) / 100,
    hardness: Math.round(hardness * 100) / 100,
    depth: Math.round(depth * 100) / 100,
    roughness: Math.round(roughness * 100) / 100,
    boominess: Math.round(boominess * 100) / 100,
    warmth: Math.round(warmth * 100) / 100,
    sharpness: Math.round(sharpness * 100) / 100,
  }
}

/**
 * Python/librosa fallback for extractDrumFeatures.
 */
export async function extractDrumFeaturesPython(
  filePath: string,
  options?: { python?: string }
): Promise<DrumFeatures> {
  const python = options?.python ?? await findPython()

  const script = `
import librosa
import numpy as np
import json
import sys

y, sr = librosa.load(sys.argv[1], sr=44100, mono=True)

# Full spectrum analysis
D = np.abs(librosa.stft(y, n_fft=4096))
avg_spectrum = np.mean(D, axis=1)
freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
total_energy = np.sum(avg_spectrum ** 2)
total_energy = max(total_energy, 1e-10)

# Brightness: spectral centroid / 10000 * 100, clamped 0-100
centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)[0]))
brightness = float(min(max(centroid / 10000 * 100, 0), 100))

# Hardness: based on log attack time
onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)
hop_time = 512 / sr
pk_idx = np.argmax(onset_env)
pk_val = onset_env[pk_idx]
threshold = pk_val * 0.1
a_start = 0
for j in range(pk_idx):
    if onset_env[j] > threshold:
        a_start = j
        break
lat_ms = (pk_idx - a_start) * hop_time * 1000
if lat_ms < 5:
    hardness = 100.0
elif lat_ms > 100:
    hardness = 0.0
else:
    # Log-scale mapping: 5ms->100, 100ms->0
    hardness = (1 - (np.log(lat_ms) - np.log(5)) / (np.log(100) - np.log(5))) * 100
hardness = min(max(float(hardness), 0), 100)

# Depth: spectral centroid of frequencies below 500Hz, normalized 0-100
mask_low = freqs < 500
low_spec = avg_spectrum[mask_low]
low_freqs = freqs[mask_low]
if np.sum(low_spec) > 0:
    low_centroid = float(np.sum(low_freqs * low_spec) / np.sum(low_spec))
    # Normalize: 0Hz->100, 500Hz->0 (lower centroid = more depth)
    depth = (1 - low_centroid / 500) * 100
else:
    depth = 0.0
depth = float(min(max(depth, 0), 100))

# Roughness: spectral flatness * 100
flatness = float(np.mean(librosa.feature.spectral_flatness(y=y)[0]))
roughness = float(min(max(flatness * 100, 0), 100))

# Boominess: energy ratio below 150Hz vs total
mask_boom = freqs < 150
boom_energy = float(np.sum(avg_spectrum[mask_boom] ** 2))
boominess = float(min(max(boom_energy / total_energy * 100, 0), 100))

# Warmth: energy ratio 200-2000Hz vs total
mask_warm = (freqs >= 200) & (freqs < 2000)
warm_energy = float(np.sum(avg_spectrum[mask_warm] ** 2))
warmth = float(min(max(warm_energy / total_energy * 100, 0), 100))

# Sharpness: energy ratio above 4000Hz vs total
mask_sharp = freqs >= 4000
sharp_energy = float(np.sum(avg_spectrum[mask_sharp] ** 2))
sharpness = float(min(max(sharp_energy / total_energy * 100, 0), 100))

result = {
    "brightness": float(round(brightness, 2)),
    "hardness": float(round(hardness, 2)),
    "depth": float(round(depth, 2)),
    "roughness": float(round(roughness, 2)),
    "boominess": float(round(boominess, 2)),
    "warmth": float(round(warmth, 2)),
    "sharpness": float(round(sharpness, 2)),
}
print(json.dumps(result))
`

  const { stdout } = await exec(python, ['-c', script, filePath], {
    timeout: 120_000,
  })

  const lines = stdout.trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as DrumFeatures
}

/**
 * Extract 7 perceptual drum features from an audio file.
 * Based on DrumGAN research timbral descriptors.
 *
 * Tries the pure TypeScript implementation first, falls back to Python/librosa.
 */
export async function extractDrumFeatures(
  filePath: string,
  options?: { python?: string }
): Promise<DrumFeatures> {
  try {
    return await extractDrumFeaturesTS(filePath)
  } catch {
    return extractDrumFeaturesPython(filePath, options)
  }
}

const FEATURE_KEYS: (keyof DrumFeatures)[] = [
  'brightness', 'hardness', 'depth', 'roughness', 'boominess', 'warmth', 'sharpness',
]

/**
 * Compute Euclidean distance between two DrumFeatures in 7D space.
 * Returns a normalized value between 0 and 1.
 */
export function drumFeatureDistance(a: DrumFeatures, b: DrumFeatures): number {
  let sumSq = 0
  for (const key of FEATURE_KEYS) {
    const diff = a[key] - b[key]
    sumSq += diff * diff
  }
  const maxDistance = Math.sqrt(7 * 100 * 100)
  return Math.sqrt(sumSq) / maxDistance
}

/**
 * Find the closest matching sample(s) to a target file from a list of sample paths.
 * Returns all samples sorted by distance (closest first).
 */
export async function findClosestSample(
  targetFile: string,
  samplePaths: string[],
  options?: { python?: string }
): Promise<SampleMatch[]> {
  const targetFeatures = await extractDrumFeatures(targetFile, options)

  const results: SampleMatch[] = await Promise.all(
    samplePaths.map(async (path) => {
      const features = await extractDrumFeatures(path, options)
      const distance = drumFeatureDistance(targetFeatures, features)
      return { path, features, distance }
    })
  )

  results.sort((a, b) => a.distance - b.distance)
  return results
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

  const { requireCmd } = await import('./exec.js')
  await requireCmd('python3')
  return 'python3'
}
