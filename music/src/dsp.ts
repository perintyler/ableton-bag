/**
 * Pure TypeScript DSP module — replaces Python/librosa dependency for spectral analysis.
 *
 * Implements FFT, STFT, spectral features, mel filterbanks, and MFCCs
 * with no external dependencies beyond Node's child_process (for ffmpeg audio loading).
 */

import { exec, requireCmd } from './exec.js'

// ---------------------------------------------------------------------------
// Window Functions
// ---------------------------------------------------------------------------

/** Hann window of given length */
export function hannWindow(length: number): Float64Array {
  const w = new Float64Array(length)
  if (length <= 1) {
    w.fill(1)
    return w
  }
  for (let i = 0; i < length; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)))
  }
  return w
}

/** Hamming window of given length */
export function hammingWindow(length: number): Float64Array {
  const w = new Float64Array(length)
  if (length <= 1) {
    w.fill(1)
    return w
  }
  for (let i = 0; i < length; i++) {
    w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (length - 1))
  }
  return w
}

// ---------------------------------------------------------------------------
// FFT — Radix-2 Cooley-Tukey
// ---------------------------------------------------------------------------

/** Next power of 2 >= n */
function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/** Bit-reversal permutation for radix-2 FFT */
function bitReverse(n: number, bits: number): number {
  let result = 0
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (n & 1)
    n >>= 1
  }
  return result
}

/**
 * Compute FFT of a real-valued signal.
 * Input is zero-padded to the next power of 2 if needed.
 * Returns interleaved complex pairs: [re0, im0, re1, im1, ...]
 * Length of result = 2 * nextPow2(signal.length)
 */
export function fft(signal: Float64Array): Float64Array {
  const N = nextPow2(signal.length)
  const bits = Math.log2(N)

  // Bit-reversal permutation into complex array
  const out = new Float64Array(2 * N)
  for (let i = 0; i < N; i++) {
    const j = bitReverse(i, bits)
    out[2 * j] = i < signal.length ? signal[i] : 0
    // imaginary part stays 0
  }

  // Cooley-Tukey iterative radix-2 DIT
  for (let size = 2; size <= N; size *= 2) {
    const halfSize = size / 2
    const angleStep = -2 * Math.PI / size

    for (let i = 0; i < N; i += size) {
      for (let k = 0; k < halfSize; k++) {
        const angle = angleStep * k
        const twRe = Math.cos(angle)
        const twIm = Math.sin(angle)

        const evenIdx = 2 * (i + k)
        const oddIdx = 2 * (i + k + halfSize)

        const eRe = out[evenIdx]
        const eIm = out[evenIdx + 1]

        const oRe = out[oddIdx]
        const oIm = out[oddIdx + 1]

        // Complex multiply: twiddle * odd
        const tRe = twRe * oRe - twIm * oIm
        const tIm = twRe * oIm + twIm * oRe

        out[evenIdx] = eRe + tRe
        out[evenIdx + 1] = eIm + tIm
        out[oddIdx] = eRe - tRe
        out[oddIdx + 1] = eIm - tIm
      }
    }
  }

  return out
}

/**
 * Compute magnitude spectrum from interleaved complex FFT result.
 * Returns magnitudes for bins 0..N/2 (i.e. N/2+1 values).
 */
export function magnitudeSpectrum(fftResult: Float64Array): Float64Array {
  const N = fftResult.length / 2
  const numBins = N / 2 + 1
  const mags = new Float64Array(numBins)
  for (let i = 0; i < numBins; i++) {
    const re = fftResult[2 * i]
    const im = fftResult[2 * i + 1]
    mags[i] = Math.sqrt(re * re + im * im)
  }
  return mags
}

/**
 * Compute power spectrum (magnitude squared) from interleaved complex FFT result.
 * Returns powers for bins 0..N/2 (i.e. N/2+1 values).
 */
export function powerSpectrum(fftResult: Float64Array): Float64Array {
  const N = fftResult.length / 2
  const numBins = N / 2 + 1
  const pows = new Float64Array(numBins)
  for (let i = 0; i < numBins; i++) {
    const re = fftResult[2 * i]
    const im = fftResult[2 * i + 1]
    pows[i] = re * re + im * im
  }
  return pows
}

// ---------------------------------------------------------------------------
// Inverse FFT
// ---------------------------------------------------------------------------

/**
 * Inverse FFT — converts frequency domain back to time domain.
 * Input: Float64Array of interleaved [re, im, re, im, ...]
 * Output: Float64Array of real values (length = input.length / 2)
 */
export function ifft(spectrum: Float64Array): Float64Array {
  const N = spectrum.length / 2

  // Conjugate the input (negate imaginary parts)
  const conjugated = new Float64Array(spectrum.length)
  for (let i = 0; i < N; i++) {
    conjugated[2 * i] = spectrum[2 * i]
    conjugated[2 * i + 1] = -spectrum[2 * i + 1]
  }

  // Forward FFT of conjugated signal
  // We reuse the FFT butterfly logic directly since fft() zero-pads,
  // but here N is already a power of 2 and we have complex input.
  const bits = Math.log2(N)

  // Bit-reversal permutation
  const out = new Float64Array(2 * N)
  for (let i = 0; i < N; i++) {
    const j = bitReverse(i, bits)
    out[2 * j] = conjugated[2 * i]
    out[2 * j + 1] = conjugated[2 * i + 1]
  }

  // Cooley-Tukey iterative radix-2 DIT
  for (let size = 2; size <= N; size *= 2) {
    const halfSize = size / 2
    const angleStep = -2 * Math.PI / size

    for (let i = 0; i < N; i += size) {
      for (let k = 0; k < halfSize; k++) {
        const angle = angleStep * k
        const twRe = Math.cos(angle)
        const twIm = Math.sin(angle)

        const evenIdx = 2 * (i + k)
        const oddIdx = 2 * (i + k + halfSize)

        const eRe = out[evenIdx]
        const eIm = out[evenIdx + 1]

        const oRe = out[oddIdx]
        const oIm = out[oddIdx + 1]

        const tRe = twRe * oRe - twIm * oIm
        const tIm = twRe * oIm + twIm * oRe

        out[evenIdx] = eRe + tRe
        out[evenIdx + 1] = eIm + tIm
        out[oddIdx] = eRe - tRe
        out[oddIdx + 1] = eIm - tIm
      }
    }
  }

  // Conjugate and divide by N to get IFFT result, extract real parts
  const result = new Float64Array(N)
  for (let i = 0; i < N; i++) {
    result[i] = out[2 * i] / N
  }

  return result
}

// ---------------------------------------------------------------------------
// STFT
// ---------------------------------------------------------------------------

export interface STFTOptions {
  /** FFT size (default 4096). Will be rounded up to next power of 2. */
  nFft?: number
  /** Hop length in samples (default 512) */
  hopLength?: number
  /** Window function (default 'hann') */
  window?: 'hann' | 'hamming' | 'none'
}

/**
 * Compute Short-Time Fourier Transform magnitude spectrogram.
 * Returns 2D array: [frames][frequency bins] where frequency bins = nFft/2 + 1.
 */
export function stft(signal: Float64Array, options?: STFTOptions): Float64Array[] {
  const nFft = nextPow2(options?.nFft ?? 4096)
  const hopLength = options?.hopLength ?? 512
  const windowType = options?.window ?? 'hann'

  const win =
    windowType === 'hann'
      ? hannWindow(nFft)
      : windowType === 'hamming'
        ? hammingWindow(nFft)
        : null

  const numBins = nFft / 2 + 1
  const numFrames = Math.max(0, Math.floor((signal.length - nFft) / hopLength) + 1)
  const frames: Float64Array[] = []

  const frame = new Float64Array(nFft)

  for (let t = 0; t < numFrames; t++) {
    const start = t * hopLength

    // Extract and window the frame
    for (let i = 0; i < nFft; i++) {
      const idx = start + i
      const sample = idx < signal.length ? signal[idx] : 0
      frame[i] = win ? sample * win[i] : sample
    }

    const fftResult = fft(frame)
    const mags = magnitudeSpectrum(fftResult)
    frames.push(mags)
  }

  return frames
}

/**
 * Complex STFT — returns interleaved [re, im] pairs per bin, per frame.
 * Needed for ISTFT reconstruction (magnitude alone loses phase info).
 * Each frame has (nFft/2 + 1) * 2 values: [re0, im0, re1, im1, ...]
 */
export function stftComplex(signal: Float64Array, options?: STFTOptions): Float64Array[] {
  const nFft = nextPow2(options?.nFft ?? 4096)
  const hopLength = options?.hopLength ?? 512
  const windowType = options?.window ?? 'hann'

  const win =
    windowType === 'hann'
      ? hannWindow(nFft)
      : windowType === 'hamming'
        ? hammingWindow(nFft)
        : null

  const numBins = nFft / 2 + 1
  const numFrames = Math.max(0, Math.floor((signal.length - nFft) / hopLength) + 1)
  const frames: Float64Array[] = []

  const frame = new Float64Array(nFft)

  for (let t = 0; t < numFrames; t++) {
    const start = t * hopLength

    for (let i = 0; i < nFft; i++) {
      const idx = start + i
      const sample = idx < signal.length ? signal[idx] : 0
      frame[i] = win ? sample * win[i] : sample
    }

    const fftResult = fft(frame)

    // Extract only the first numBins complex pairs (positive frequencies)
    const complexFrame = new Float64Array(numBins * 2)
    for (let i = 0; i < numBins; i++) {
      complexFrame[2 * i] = fftResult[2 * i]
      complexFrame[2 * i + 1] = fftResult[2 * i + 1]
    }
    frames.push(complexFrame)
  }

  return frames
}

/**
 * Inverse Short-Time Fourier Transform.
 * Reconstructs a time-domain signal from STFT frames using overlap-add.
 *
 * @param frames - Array of complex STFT frames (each is [re, im, re, im, ...] interleaved)
 * @param options - nFft, hopLength, window settings (must match the forward STFT).
 *                  `length` optionally specifies the desired output length.
 * @returns Reconstructed time-domain signal
 */
export function istft(frames: Float64Array[], options?: STFTOptions & { length?: number }): Float64Array {
  const nFft = nextPow2(options?.nFft ?? 4096)
  const hopLength = options?.hopLength ?? 512
  const windowType = options?.window ?? 'hann'

  const win =
    windowType === 'hann'
      ? hannWindow(nFft)
      : windowType === 'hamming'
        ? hammingWindow(nFft)
        : null

  const numFrames = frames.length
  const expectedLength = options?.length ?? (nFft + (numFrames - 1) * hopLength)

  const output = new Float64Array(expectedLength)
  const windowSum = new Float64Array(expectedLength)

  for (let t = 0; t < numFrames; t++) {
    const complexFrame = frames[t]
    const numBins = complexFrame.length / 2

    // Reconstruct full-length complex spectrum from positive-frequency bins
    const fullSpectrum = new Float64Array(2 * nFft)
    for (let i = 0; i < numBins; i++) {
      fullSpectrum[2 * i] = complexFrame[2 * i]
      fullSpectrum[2 * i + 1] = complexFrame[2 * i + 1]
    }
    // Mirror negative frequencies (conjugate symmetry for real signals)
    for (let i = numBins; i < nFft; i++) {
      fullSpectrum[2 * i] = fullSpectrum[2 * (nFft - i)]       // real part
      fullSpectrum[2 * i + 1] = -fullSpectrum[2 * (nFft - i) + 1]  // negated imaginary
    }

    // IFFT to get time-domain segment
    const timeDomain = ifft(fullSpectrum)

    // Apply synthesis window and overlap-add
    const start = t * hopLength
    for (let i = 0; i < nFft; i++) {
      const pos = start + i
      if (pos >= expectedLength) break
      const w = win ? win[i] : 1
      output[pos] += timeDomain[i] * w
      windowSum[pos] += w * w
    }
  }

  // Normalize by the sum of squared windows (COLA condition)
  for (let i = 0; i < expectedLength; i++) {
    if (windowSum[i] > 1e-8) {
      output[i] /= windowSum[i]
    }
  }

  return output
}

/**
 * Get frequency values (in Hz) for each FFT bin.
 * Returns array of length nFft/2 + 1.
 */
export function fftFrequencies(sr: number, nFft: number): Float64Array {
  const n = nextPow2(nFft)
  const numBins = n / 2 + 1
  const freqs = new Float64Array(numBins)
  for (let i = 0; i < numBins; i++) {
    freqs[i] = (i * sr) / n
  }
  return freqs
}

// ---------------------------------------------------------------------------
// Spectral Features
// ---------------------------------------------------------------------------

/**
 * Spectral centroid — the "center of mass" of the spectrum.
 * Returns frequency in Hz.
 */
export function spectralCentroid(
  magnitudes: Float64Array,
  frequencies: Float64Array
): number {
  let weightedSum = 0
  let totalMag = 0
  for (let i = 0; i < magnitudes.length; i++) {
    weightedSum += frequencies[i] * magnitudes[i]
    totalMag += magnitudes[i]
  }
  return totalMag > 0 ? weightedSum / totalMag : 0
}

/**
 * Spectral bandwidth — weighted standard deviation around the centroid.
 * Returns bandwidth in Hz.
 */
export function spectralBandwidth(
  magnitudes: Float64Array,
  frequencies: Float64Array,
  centroid: number
): number {
  let weightedVariance = 0
  let totalMag = 0
  for (let i = 0; i < magnitudes.length; i++) {
    const diff = frequencies[i] - centroid
    weightedVariance += magnitudes[i] * diff * diff
    totalMag += magnitudes[i]
  }
  return totalMag > 0 ? Math.sqrt(weightedVariance / totalMag) : 0
}

/**
 * Spectral flatness — ratio of geometric mean to arithmetic mean.
 * 0 = perfectly tonal, 1 = white noise.
 */
export function spectralFlatness(magnitudes: Float64Array): number {
  const n = magnitudes.length
  if (n === 0) return 0

  // Use log-domain for geometric mean to avoid overflow/underflow
  let logSum = 0
  let arithmeticSum = 0
  let nonZeroCount = 0

  for (let i = 0; i < n; i++) {
    const m = magnitudes[i]
    arithmeticSum += m
    if (m > 0) {
      logSum += Math.log(m)
      nonZeroCount++
    } else {
      // A single zero makes geometric mean = 0
      return 0
    }
  }

  if (arithmeticSum === 0) return 0

  const geometricMean = Math.exp(logSum / n)
  const arithmeticMean = arithmeticSum / n

  return geometricMean / arithmeticMean
}

/**
 * Spectral rolloff — frequency below which a given percentage of total
 * spectral energy is concentrated.
 * @param percent Fraction 0-1, default 0.85
 */
export function spectralRolloff(
  magnitudes: Float64Array,
  frequencies: Float64Array,
  percent: number = 0.85
): number {
  let totalEnergy = 0
  for (let i = 0; i < magnitudes.length; i++) {
    totalEnergy += magnitudes[i] * magnitudes[i]
  }

  const threshold = totalEnergy * percent
  let cumulative = 0

  for (let i = 0; i < magnitudes.length; i++) {
    cumulative += magnitudes[i] * magnitudes[i]
    if (cumulative >= threshold) {
      return frequencies[i]
    }
  }

  return frequencies[frequencies.length - 1]
}

/**
 * Energy in a frequency band as a percentage of total energy.
 * Uses squared magnitudes (power).
 */
export function bandEnergy(
  magnitudes: Float64Array,
  frequencies: Float64Array,
  lowHz: number,
  highHz: number
): number {
  let bandPower = 0
  let totalPower = 0

  for (let i = 0; i < magnitudes.length; i++) {
    const power = magnitudes[i] * magnitudes[i]
    totalPower += power
    if (frequencies[i] >= lowHz && frequencies[i] < highHz) {
      bandPower += power
    }
  }

  return totalPower > 0 ? (bandPower / totalPower) * 100 : 0
}

// ---------------------------------------------------------------------------
// Mel Scale & MFCC
// ---------------------------------------------------------------------------

/** Convert frequency in Hz to mel scale (Slaney formula) */
export function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700)
}

/** Convert mel scale value to Hz */
export function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1)
}

/**
 * Create a mel filterbank matrix.
 * Returns an array of nMels filters, each of length nFft/2+1.
 * @param sr Sample rate in Hz
 * @param nFft FFT size
 * @param nMels Number of mel bands (default 128)
 */
export function melFilterbank(
  sr: number,
  nFft: number,
  nMels: number = 128
): Float64Array[] {
  const n = nextPow2(nFft)
  const numBins = n / 2 + 1
  const fMax = sr / 2

  // Mel-spaced center frequencies
  const melMin = hzToMel(0)
  const melMax = hzToMel(fMax)
  const melPoints = new Float64Array(nMels + 2)
  for (let i = 0; i < nMels + 2; i++) {
    melPoints[i] = melMin + (i * (melMax - melMin)) / (nMels + 1)
  }

  // Convert mel points to FFT bin indices
  const binIndices = new Float64Array(nMels + 2)
  for (let i = 0; i < nMels + 2; i++) {
    const hz = melToHz(melPoints[i])
    binIndices[i] = (hz * n) / sr
  }

  // Build triangular filters
  const filters: Float64Array[] = []
  for (let m = 0; m < nMels; m++) {
    const filter = new Float64Array(numBins)
    const left = binIndices[m]
    const center = binIndices[m + 1]
    const right = binIndices[m + 2]

    for (let k = 0; k < numBins; k++) {
      if (k >= left && k <= center && center > left) {
        filter[k] = (k - left) / (center - left)
      } else if (k > center && k <= right && right > center) {
        filter[k] = (right - k) / (right - center)
      }
    }

    // Normalize by filter width (Slaney-style)
    const width = 2 * (melToHz(melPoints[m + 2]) - melToHz(melPoints[m])) / ((melToHz(melPoints[m + 2]) - melToHz(melPoints[m + 1])) + (melToHz(melPoints[m + 1]) - melToHz(melPoints[m])))
    if (width > 0) {
      const norm = 2 / (melToHz(melPoints[m + 2]) - melToHz(melPoints[m]))
      for (let k = 0; k < numBins; k++) {
        filter[k] *= norm
      }
    }

    filters.push(filter)
  }

  return filters
}

/**
 * DCT Type-II (orthogonal, used for MFCC computation).
 * Matches scipy.fftpack.dct(type=2, norm='ortho').
 */
export function dctII(input: Float64Array): Float64Array {
  const N = input.length
  const result = new Float64Array(N)

  for (let k = 0; k < N; k++) {
    let sum = 0
    for (let n = 0; n < N; n++) {
      sum += input[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N))
    }
    // Orthogonal normalization
    if (k === 0) {
      result[k] = sum * Math.sqrt(1 / N)
    } else {
      result[k] = sum * Math.sqrt(2 / N)
    }
  }

  return result
}

/**
 * Compute MFCCs (Mel-Frequency Cepstral Coefficients) from a signal.
 * Returns 2D array: [frames][nMfcc coefficients].
 */
export function mfcc(
  signal: Float64Array,
  sr: number,
  options?: {
    nMfcc?: number
    nMels?: number
    nFft?: number
    hopLength?: number
  }
): Float64Array[] {
  const nMfcc = options?.nMfcc ?? 13
  const nMels = options?.nMels ?? 128
  const nFft = options?.nFft ?? 2048
  const hopLength = options?.hopLength ?? 512

  // Compute magnitude spectrogram
  const spectrogram = stft(signal, { nFft, hopLength, window: 'hann' })

  // Build mel filterbank
  const filters = melFilterbank(sr, nFft, nMels)

  // Apply mel filterbank to each frame
  const mfccs: Float64Array[] = []

  for (const frame of spectrogram) {
    // Mel spectrum: dot product of each filter with magnitude spectrum
    const melSpec = new Float64Array(nMels)
    for (let m = 0; m < nMels; m++) {
      let sum = 0
      const filt = filters[m]
      const len = Math.min(frame.length, filt.length)
      for (let k = 0; k < len; k++) {
        sum += filt[k] * frame[k]
      }
      // Apply power (squared) and log
      melSpec[m] = Math.log(Math.max(sum * sum, 1e-10))
    }

    // DCT to get cepstral coefficients
    const dctResult = dctII(melSpec)

    // Keep only the first nMfcc coefficients
    mfccs.push(dctResult.slice(0, nMfcc) as Float64Array)
  }

  return mfccs
}

// ---------------------------------------------------------------------------
// Audio Loading via ffmpeg
// ---------------------------------------------------------------------------

/**
 * Load an audio file as a Float64Array using ffmpeg.
 * Decodes any format to mono raw PCM at the specified sample rate.
 * @param filePath Path to the audio file
 * @param sr Target sample rate (default 44100)
 */
export async function loadAudio(
  filePath: string,
  sr: number = 44100
): Promise<{ samples: Float64Array; sampleRate: number }> {
  await requireCmd('ffmpeg')

  const { execFile } = await import('node:child_process')

  return new Promise((resolve, reject) => {
    const proc = execFile(
      'ffmpeg',
      [
        '-i', filePath,
        '-f', 'f64le',
        '-acodec', 'pcm_f64le',
        '-ac', '1',
        '-ar', String(sr),
        'pipe:1',
      ],
      {
        maxBuffer: 500 * 1024 * 1024,
        encoding: 'buffer' as any,
      },
      (error, stdout) => {
        if (error) {
          reject(new Error(`ffmpeg failed to load ${filePath}: ${error.message}`))
          return
        }
        const buffer = stdout as unknown as Buffer
        const float64 = new Float64Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength / 8
        )
        // Copy to ensure ownership (the buffer may be shared)
        const samples = new Float64Array(float64.length)
        samples.set(float64)
        resolve({ samples, sampleRate: sr })
      }
    )
  })
}
