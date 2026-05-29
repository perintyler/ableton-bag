import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  fft,
  ifft,
  magnitudeSpectrum,
  powerSpectrum,
  stft,
  stftComplex,
  istft,
  fftFrequencies,
  spectralCentroid,
  spectralBandwidth,
  spectralFlatness,
  spectralRolloff,
  bandEnergy,
  hzToMel,
  melToHz,
  melFilterbank,
  dctII,
  mfcc,
  loadAudio,
  hannWindow,
  hammingWindow,
} from './dsp.js'

// ---------------------------------------------------------------------------
// Helper: write a minimal WAV file from Float64Array samples (16-bit PCM mono)
// ---------------------------------------------------------------------------

function saveTestWav(samples: Float64Array, sr: number, filePath: string): void {
  const numSamples = samples.length
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const dataSize = numSamples * bytesPerSample
  const fileSize = 44 + dataSize

  const buffer = Buffer.alloc(fileSize)
  let offset = 0

  buffer.write('RIFF', offset); offset += 4
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4
  buffer.write('WAVE', offset); offset += 4

  buffer.write('fmt ', offset); offset += 4
  buffer.writeUInt32LE(16, offset); offset += 4
  buffer.writeUInt16LE(1, offset); offset += 2
  buffer.writeUInt16LE(1, offset); offset += 2
  buffer.writeUInt32LE(sr, offset); offset += 4
  buffer.writeUInt32LE(sr * bytesPerSample, offset); offset += 4
  buffer.writeUInt16LE(bytesPerSample, offset); offset += 2
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2

  buffer.write('data', offset); offset += 4
  buffer.writeUInt32LE(dataSize, offset); offset += 4

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    const int16 = Math.round(clamped * 32767)
    buffer.writeInt16LE(int16, offset); offset += 2
  }

  writeFileSync(filePath, buffer)
}

// ---------------------------------------------------------------------------
// Signal generators
// ---------------------------------------------------------------------------

const SR = 44100

/** Generate a sine wave at the given frequency */
function makeSine(freq: number, duration: number, sr: number = SR): Float64Array {
  const n = Math.floor(sr * duration)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin(2 * Math.PI * freq * i / sr)
  }
  return out
}

/** Generate pseudo-random noise in [-1, 1] */
function makeNoise(duration: number, sr: number = SR): Float64Array {
  const n = Math.floor(sr * duration)
  const out = new Float64Array(n)
  // Simple deterministic PRNG for reproducibility
  let seed = 12345
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    out[i] = (seed / 0x7fffffff) * 2 - 1
  }
  return out
}

/** Generate a DC signal (all ones) */
function makeDC(length: number): Float64Array {
  const out = new Float64Array(length)
  out.fill(1)
  return out
}

// ---------------------------------------------------------------------------
// Test WAV files for loadAudio tests
// ---------------------------------------------------------------------------

const testWavDir = tmpdir()
const sineWavPath = join(testWavDir, `dsp-test-sine-${Date.now()}.wav`)
const nonExistentPath = join(testWavDir, `dsp-test-does-not-exist-${Date.now()}.wav`)

beforeAll(() => {
  const sine = makeSine(440, 0.5)
  saveTestWav(sine, SR, sineWavPath)
})

afterAll(() => {
  for (const p of [sineWavPath]) {
    if (existsSync(p)) {
      try { unlinkSync(p) } catch { /* ignore */ }
    }
  }
})

// ===========================================================================
// FFT
// ===========================================================================

describe('FFT', () => {
  it('fft of all zeros returns all zeros', () => {
    const zeros = new Float64Array(16)
    const result = fft(zeros)
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBeCloseTo(0, 10)
    }
  })

  it('fft of DC signal (all ones) has peak at bin 0', () => {
    const dc = makeDC(8)
    const result = fft(dc)
    // Bin 0 real part should be 8 (sum of all samples)
    expect(result[0]).toBeCloseTo(8, 10)
    // Bin 0 imaginary part should be 0
    expect(result[1]).toBeCloseTo(0, 10)
    // All other bins should be 0 (DC has no frequency content)
    for (let i = 1; i < 8; i++) {
      expect(Math.abs(result[2 * i])).toBeCloseTo(0, 10)
      expect(Math.abs(result[2 * i + 1])).toBeCloseTo(0, 10)
    }
  })

  it('fft of pure sine peaks at the correct bin', () => {
    // 8 samples, sine at bin 1: freq = 1/8 of sample rate
    const N = 8
    const signal = new Float64Array(N)
    for (let i = 0; i < N; i++) {
      signal[i] = Math.sin(2 * Math.PI * 1 * i / N) // bin 1
    }
    const result = fft(signal)
    const mags = magnitudeSpectrum(result)

    // Bin 1 should have the highest magnitude
    let maxBin = 0
    let maxVal = 0
    for (let i = 0; i < mags.length; i++) {
      if (mags[i] > maxVal) {
        maxVal = mags[i]
        maxBin = i
      }
    }
    expect(maxBin).toBe(1)
  })

  it('fft round-trip: ifft(fft(x)) approximates x', () => {
    const signal = new Float64Array([0.1, -0.5, 0.3, 0.8, -0.2, 0.6, -0.7, 0.4])
    const spectrum = fft(signal)
    const recovered = ifft(spectrum)

    expect(recovered.length).toBe(signal.length)
    for (let i = 0; i < signal.length; i++) {
      expect(recovered[i]).toBeCloseTo(signal[i], 8)
    }
  })

  it('fft handles non-power-of-2 input by zero-padding', () => {
    const signal = new Float64Array([1, 2, 3, 4, 5]) // length 5
    const result = fft(signal)
    // Next power of 2 is 8, so result should have 2*8 = 16 values
    expect(result.length).toBe(16)

    // Round-trip should recover original (padded to 8)
    const recovered = ifft(result)
    expect(recovered.length).toBe(8)
    for (let i = 0; i < 5; i++) {
      expect(recovered[i]).toBeCloseTo(signal[i], 8)
    }
    // Zero-padded portion
    for (let i = 5; i < 8; i++) {
      expect(recovered[i]).toBeCloseTo(0, 8)
    }
  })
})

// ===========================================================================
// magnitudeSpectrum
// ===========================================================================

describe('magnitudeSpectrum', () => {
  it('returns correct length (N/2 + 1 for real input)', () => {
    const signal = new Float64Array(16)
    const result = fft(signal)
    const mags = magnitudeSpectrum(result)
    // N = 16, so N/2 + 1 = 9
    expect(mags.length).toBe(9)
  })

  it('magnitude of DC signal is correct', () => {
    const dc = makeDC(8)
    const result = fft(dc)
    const mags = magnitudeSpectrum(result)
    // DC bin magnitude = 8 (sum of all 1s)
    expect(mags[0]).toBeCloseTo(8, 8)
    // All other bins should be ~0
    for (let i = 1; i < mags.length; i++) {
      expect(mags[i]).toBeCloseTo(0, 8)
    }
  })

  it('magnitude of sine at known frequency peaks at correct bin', () => {
    const N = 64
    const binIndex = 5
    const signal = new Float64Array(N)
    for (let i = 0; i < N; i++) {
      signal[i] = Math.cos(2 * Math.PI * binIndex * i / N)
    }
    const result = fft(signal)
    const mags = magnitudeSpectrum(result)

    let maxBin = 0
    let maxVal = 0
    for (let i = 0; i < mags.length; i++) {
      if (mags[i] > maxVal) {
        maxVal = mags[i]
        maxBin = i
      }
    }
    expect(maxBin).toBe(binIndex)
  })
})

// ===========================================================================
// powerSpectrum
// ===========================================================================

describe('powerSpectrum', () => {
  it('power = magnitude^2', () => {
    const signal = new Float64Array([1, -1, 0.5, -0.5, 0.2, -0.2, 0.8, -0.8])
    const result = fft(signal)
    const mags = magnitudeSpectrum(result)
    const pows = powerSpectrum(result)

    expect(pows.length).toBe(mags.length)
    for (let i = 0; i < mags.length; i++) {
      expect(pows[i]).toBeCloseTo(mags[i] * mags[i], 8)
    }
  })
})

// ===========================================================================
// STFT
// ===========================================================================

describe('STFT', () => {
  it('frame count matches expected: floor((N - nFft) / hopLength) + 1', () => {
    const signal = makeSine(440, 0.1) // 4410 samples
    const nFft = 1024
    const hopLength = 256
    const frames = stft(signal, { nFft, hopLength })

    const expectedFrames = Math.max(0, Math.floor((signal.length - nFft) / hopLength) + 1)
    expect(frames.length).toBe(expectedFrames)
  })

  it('each frame has nFft/2 + 1 bins', () => {
    const signal = makeSine(440, 0.1)
    const nFft = 1024
    const frames = stft(signal, { nFft, hopLength: 256 })

    for (const frame of frames) {
      expect(frame.length).toBe(nFft / 2 + 1)
    }
  })

  it('windowing does not crash on short signals', () => {
    const signal = new Float64Array(100) // shorter than default nFft
    // With nFft=64 (small enough to get at least 1 frame)
    const frames = stft(signal, { nFft: 64, hopLength: 32 })
    expect(frames.length).toBeGreaterThan(0)
  })

  it('returns 0 frames for signal shorter than nFft', () => {
    const signal = new Float64Array(100)
    const frames = stft(signal, { nFft: 256, hopLength: 128 })
    expect(frames.length).toBe(0)
  })
})

// ===========================================================================
// Spectral Features
// ===========================================================================

describe('spectral features', () => {
  it('spectralCentroid of low-freq signal < high-freq signal', () => {
    const N = 2048
    const low = makeSine(200, N / SR)
    const high = makeSine(4000, N / SR)

    const fftLow = fft(low)
    const fftHigh = fft(high)
    const magsLow = magnitudeSpectrum(fftLow)
    const magsHigh = magnitudeSpectrum(fftHigh)
    const freqs = fftFrequencies(SR, N)

    const centroidLow = spectralCentroid(magsLow, freqs)
    const centroidHigh = spectralCentroid(magsHigh, freqs)

    expect(centroidLow).toBeLessThan(centroidHigh)
  })

  it('spectralFlatness of sine is near 0, noise is higher', () => {
    const N = 1024
    const sine = makeSine(440, N / SR)
    const noise = makeNoise(N / SR)

    const magsSine = magnitudeSpectrum(fft(sine))
    const magsNoise = magnitudeSpectrum(fft(noise))

    const flatnessSine = spectralFlatness(magsSine)
    const flatnessNoise = spectralFlatness(magsNoise)

    // Sine with spectral leakage may not be near 0 in short windows,
    // but should still be much less flat than noise
    expect(flatnessSine).toBeLessThan(0.5)
    expect(flatnessNoise).toBeGreaterThan(flatnessSine)
  })

  it('spectralRolloff at 85% returns correct frequency', () => {
    const N = 2048
    const sine = makeSine(440, N / SR)
    const result = fft(sine)
    const mags = magnitudeSpectrum(result)
    const freqs = fftFrequencies(SR, N)

    const rolloff = spectralRolloff(mags, freqs, 0.85)
    // For a pure sine, most energy is in one bin, so rolloff should be near 440Hz
    expect(rolloff).toBeGreaterThan(400)
    expect(rolloff).toBeLessThan(500)
  })

  it('bandEnergy returns ~100% for full range', () => {
    const N = 1024
    const sine = makeSine(440, N / SR)
    const mags = magnitudeSpectrum(fft(sine))
    const freqs = fftFrequencies(SR, N)

    const fullBand = bandEnergy(mags, freqs, 0, SR / 2)
    expect(fullBand).toBeCloseTo(100, 0)
  })

  it('bandEnergy returns partial energy for a restricted range', () => {
    const N = 1024
    const sine = makeSine(440, N / SR)
    const mags = magnitudeSpectrum(fft(sine))
    const freqs = fftFrequencies(SR, N)

    // Band that includes the sine frequency should have ~100%
    const containsBand = bandEnergy(mags, freqs, 400, 500)
    expect(containsBand).toBeGreaterThan(90)

    // Band that excludes the sine frequency should have ~0%
    const excludesBand = bandEnergy(mags, freqs, 1000, 2000)
    expect(excludesBand).toBeLessThan(5)
  })

  it('spectralBandwidth of narrow signal < wide signal', () => {
    const N = 2048
    const sine = makeSine(440, N / SR) // very narrow spectrum
    const noise = makeNoise(N / SR)    // wide spectrum

    const magsSine = magnitudeSpectrum(fft(sine))
    const magsNoise = magnitudeSpectrum(fft(noise))
    const freqs = fftFrequencies(SR, N)

    const centSine = spectralCentroid(magsSine, freqs)
    const centNoise = spectralCentroid(magsNoise, freqs)

    const bwSine = spectralBandwidth(magsSine, freqs, centSine)
    const bwNoise = spectralBandwidth(magsNoise, freqs, centNoise)

    expect(bwSine).toBeLessThan(bwNoise)
  })
})

// ===========================================================================
// Mel Scale
// ===========================================================================

describe('mel scale', () => {
  it('hzToMel(0) = 0', () => {
    expect(hzToMel(0)).toBe(0)
  })

  it('melToHz(hzToMel(440)) approximates 440 (round-trip)', () => {
    const mel = hzToMel(440)
    const hz = melToHz(mel)
    expect(hz).toBeCloseTo(440, 6)
  })

  it('mel scale is monotonically increasing', () => {
    const frequencies = [0, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
    for (let i = 1; i < frequencies.length; i++) {
      expect(hzToMel(frequencies[i])).toBeGreaterThan(hzToMel(frequencies[i - 1]))
    }
  })

  it('hzToMel and melToHz are inverses for various values', () => {
    const values = [100, 1000, 5000, 12000]
    for (const hz of values) {
      expect(melToHz(hzToMel(hz))).toBeCloseTo(hz, 4)
    }
  })
})

// ===========================================================================
// MFCC
// ===========================================================================

describe('MFCC', () => {
  it('returns correct shape: [numFrames, nMfcc]', () => {
    const signal = makeSine(440, 0.5)
    const nMfcc = 13
    const nFft = 2048
    const hopLength = 512
    const result = mfcc(signal, SR, { nMfcc, nFft, hopLength })

    const expectedFrames = Math.max(0, Math.floor((signal.length - nFft) / hopLength) + 1)
    expect(result.length).toBe(expectedFrames)
    for (const frame of result) {
      expect(frame.length).toBe(nMfcc)
    }
  })

  it('different signals produce different MFCCs', () => {
    const sine = makeSine(440, 0.5)
    const noise = makeNoise(0.5)

    const mfccSine = mfcc(sine, SR, { nMfcc: 13, nFft: 2048, hopLength: 512 })
    const mfccNoise = mfcc(noise, SR, { nMfcc: 13, nFft: 2048, hopLength: 512 })

    // At least some coefficients should differ
    let totalDiff = 0
    const minFrames = Math.min(mfccSine.length, mfccNoise.length)
    for (let f = 0; f < minFrames; f++) {
      for (let c = 0; c < 13; c++) {
        totalDiff += Math.abs(mfccSine[f][c] - mfccNoise[f][c])
      }
    }
    expect(totalDiff).toBeGreaterThan(0)
  })

  it('same signal produces same MFCCs', () => {
    const signal = makeSine(440, 0.5)
    const opts = { nMfcc: 13, nFft: 2048, hopLength: 512 }
    const result1 = mfcc(signal, SR, opts)
    const result2 = mfcc(signal, SR, opts)

    expect(result1.length).toBe(result2.length)
    for (let f = 0; f < result1.length; f++) {
      for (let c = 0; c < 13; c++) {
        expect(result1[f][c]).toBeCloseTo(result2[f][c], 10)
      }
    }
  })
})

// ===========================================================================
// melFilterbank
// ===========================================================================

describe('melFilterbank', () => {
  it('returns correct number of filters (nMels)', () => {
    const nMels = 40
    const filters = melFilterbank(SR, 2048, nMels)
    expect(filters.length).toBe(nMels)
  })

  it('each filter is non-negative', () => {
    const filters = melFilterbank(SR, 2048, 40)
    for (const filter of filters) {
      for (let i = 0; i < filter.length; i++) {
        expect(filter[i]).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('filters are triangular (rise then fall, no second rise)', () => {
    const filters = melFilterbank(SR, 2048, 40)
    for (const filter of filters) {
      // Find the peak
      let peakIdx = 0
      let peakVal = 0
      for (let i = 0; i < filter.length; i++) {
        if (filter[i] > peakVal) {
          peakVal = filter[i]
          peakIdx = i
        }
      }
      if (peakVal === 0) continue // skip empty filters

      // Before peak: monotonically non-decreasing (among non-zero values)
      let lastNonZero = 0
      for (let i = 0; i <= peakIdx; i++) {
        if (filter[i] > 0) {
          expect(filter[i]).toBeGreaterThanOrEqual(lastNonZero - 1e-10)
          lastNonZero = filter[i]
        }
      }

      // After peak: monotonically non-increasing until zero
      let prevVal = peakVal
      for (let i = peakIdx + 1; i < filter.length; i++) {
        if (filter[i] > 0) {
          expect(filter[i]).toBeLessThanOrEqual(prevVal + 1e-10)
          prevVal = filter[i]
        }
      }
    }
  })

  it('each filter has the correct length (nFft/2 + 1)', () => {
    const nFft = 2048
    const filters = melFilterbank(SR, nFft, 40)
    for (const filter of filters) {
      expect(filter.length).toBe(nFft / 2 + 1)
    }
  })
})

// ===========================================================================
// dctII
// ===========================================================================

describe('dctII', () => {
  it('dctII of known input matches expected output', () => {
    // For a constant input of all 1s of length N, DCT-II (ortho) should
    // produce sqrt(N) at index 0 and 0 elsewhere.
    const N = 8
    const input = new Float64Array(N)
    input.fill(1)
    const result = dctII(input)

    // k=0: sum * sqrt(1/N) = N * sqrt(1/N) = sqrt(N)
    expect(result[0]).toBeCloseTo(Math.sqrt(N), 6)
    // All other coefficients should be ~0
    for (let k = 1; k < N; k++) {
      expect(result[k]).toBeCloseTo(0, 6)
    }
  })

  it('length is preserved', () => {
    const input = new Float64Array([1, 2, 3, 4, 5])
    const result = dctII(input)
    expect(result.length).toBe(input.length)
  })

  it('energy is preserved (Parseval for orthonormal DCT)', () => {
    const input = new Float64Array([1, -2, 3, -4, 5, -6, 7, -8])
    const result = dctII(input)

    let inputEnergy = 0
    let outputEnergy = 0
    for (let i = 0; i < input.length; i++) {
      inputEnergy += input[i] * input[i]
      outputEnergy += result[i] * result[i]
    }
    expect(outputEnergy).toBeCloseTo(inputEnergy, 6)
  })
})

// ===========================================================================
// loadAudio
// ===========================================================================

describe('loadAudio', () => {
  it('loads a WAV file and returns Float64Array', async () => {
    const result = await loadAudio(sineWavPath, SR)
    expect(result.samples).toBeInstanceOf(Float64Array)
    expect(result.sampleRate).toBe(SR)
    // 0.5 seconds at 44100Hz = 22050 samples
    expect(result.samples.length).toBeCloseTo(22050, -2)
  })

  it('respects sample rate parameter', async () => {
    const targetSr = 22050
    const result = await loadAudio(sineWavPath, targetSr)
    expect(result.sampleRate).toBe(targetSr)
    // At 22050Hz, 0.5s = 11025 samples
    expect(result.samples.length).toBeCloseTo(11025, -2)
  })

  it('throws on non-existent file', async () => {
    await expect(loadAudio(nonExistentPath)).rejects.toThrow()
  })
})

// ===========================================================================
// Window Functions
// ===========================================================================

describe('window functions', () => {
  it('hannWindow: center is 1.0, edges are 0.0', () => {
    const N = 64
    const w = hannWindow(N)
    expect(w.length).toBe(N)
    expect(w[0]).toBeCloseTo(0, 10)
    expect(w[N - 1]).toBeCloseTo(0, 10)
    // Center (for even N, the closest sample to center)
    const mid = Math.floor((N - 1) / 2)
    expect(w[mid]).toBeGreaterThan(0.9)
  })

  it('hammingWindow: center is 1.0, edges > 0', () => {
    const N = 64
    const w = hammingWindow(N)
    expect(w.length).toBe(N)
    // Hamming edges are ~0.08, not 0
    expect(w[0]).toBeGreaterThan(0.05)
    expect(w[0]).toBeLessThan(0.15)
    expect(w[N - 1]).toBeGreaterThan(0.05)
    expect(w[N - 1]).toBeLessThan(0.15)
    // Center should be 1.0
    const mid = Math.floor((N - 1) / 2)
    expect(w[mid]).toBeGreaterThan(0.95)
  })

  it('correct length', () => {
    for (const n of [1, 16, 100, 512]) {
      expect(hannWindow(n).length).toBe(n)
      expect(hammingWindow(n).length).toBe(n)
    }
  })

  it('hannWindow is symmetric', () => {
    const N = 65
    const w = hannWindow(N)
    for (let i = 0; i < Math.floor(N / 2); i++) {
      expect(w[i]).toBeCloseTo(w[N - 1 - i], 10)
    }
  })

  it('hammingWindow is symmetric', () => {
    const N = 65
    const w = hammingWindow(N)
    for (let i = 0; i < Math.floor(N / 2); i++) {
      expect(w[i]).toBeCloseTo(w[N - 1 - i], 10)
    }
  })
})

// ===========================================================================
// stftComplex + istft round-trip
// ===========================================================================

describe('stftComplex + istft', () => {
  it('round-trip preserves energy (within tolerance)', () => {
    const signal = makeSine(440, 0.2)
    const nFft = 1024
    const hopLength = 256
    const opts = { nFft, hopLength, window: 'hann' as const }

    const frames = stftComplex(signal, opts)
    const reconstructed = istft(frames, { ...opts, length: signal.length })

    // Compute RMS of original and reconstructed in the stable middle region
    const start = nFft
    const end = signal.length - nFft
    if (end > start) {
      let origEnergy = 0
      let reconEnergy = 0
      for (let i = start; i < end; i++) {
        origEnergy += signal[i] * signal[i]
        reconEnergy += reconstructed[i] * reconstructed[i]
      }
      // Energy should be very close
      const ratio = reconEnergy / origEnergy
      expect(ratio).toBeGreaterThan(0.9)
      expect(ratio).toBeLessThan(1.1)
    }
  })

  it('different window sizes work', () => {
    const signal = makeSine(440, 0.2)

    for (const nFft of [256, 512, 1024, 2048]) {
      const hopLength = nFft / 4
      const opts = { nFft, hopLength, window: 'hann' as const }

      const frames = stftComplex(signal, opts)
      expect(frames.length).toBeGreaterThan(0)

      const reconstructed = istft(frames, { ...opts, length: signal.length })
      expect(reconstructed.length).toBe(signal.length)

      // Check middle region matches
      const start = nFft
      const end = signal.length - nFft
      if (end > start) {
        for (let i = start; i < end; i += 100) {
          expect(reconstructed[i]).toBeCloseTo(signal[i], 1)
        }
      }
    }
  })

  it('hamming window also works for round-trip', () => {
    const signal = makeSine(880, 0.2)
    const nFft = 1024
    const hopLength = 256
    const opts = { nFft, hopLength, window: 'hamming' as const }

    const frames = stftComplex(signal, opts)
    const reconstructed = istft(frames, { ...opts, length: signal.length })

    const start = nFft
    const end = signal.length - nFft
    if (end > start) {
      for (let i = start; i < end; i += 100) {
        expect(reconstructed[i]).toBeCloseTo(signal[i], 1)
      }
    }
  })
})

// ===========================================================================
// fftFrequencies
// ===========================================================================

describe('fftFrequencies', () => {
  it('returns correct number of bins', () => {
    const freqs = fftFrequencies(SR, 1024)
    expect(freqs.length).toBe(1024 / 2 + 1)
  })

  it('first bin is 0 Hz, last bin is Nyquist', () => {
    const nFft = 1024
    const freqs = fftFrequencies(SR, nFft)
    expect(freqs[0]).toBe(0)
    expect(freqs[freqs.length - 1]).toBeCloseTo(SR / 2, 0)
  })

  it('bins are evenly spaced', () => {
    const nFft = 1024
    const freqs = fftFrequencies(SR, nFft)
    const expectedSpacing = SR / nFft
    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i] - freqs[i - 1]).toBeCloseTo(expectedSpacing, 4)
    }
  })
})
