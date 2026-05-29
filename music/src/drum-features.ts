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
 * Extract 7 perceptual drum features from an audio file.
 * Based on DrumGAN research timbral descriptors.
 */
export const extractDrumFeatures = extractDrumFeaturesTS

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
): Promise<SampleMatch[]> {
  const targetFeatures = await extractDrumFeatures(targetFile)

  const results: SampleMatch[] = await Promise.all(
    samplePaths.map(async (path) => {
      const features = await extractDrumFeatures(path)
      const distance = drumFeatureDistance(targetFeatures, features)
      return { path, features, distance }
    })
  )

  results.sort((a, b) => a.distance - b.distance)
  return results
}

