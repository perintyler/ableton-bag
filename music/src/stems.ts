import { exec, requireCmd } from './exec.js'
import { stftComplex, istft, hannWindow } from './dsp.js'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export type StemModel = 'htdemucs' | 'htdemucs_ft' | 'mdx_extra' | 'mdx_extra_q'
export type TwoStems = 'drums' | 'vocals' | 'bass' | 'other'

export interface SeparateOptions {
  input: string
  outputDir: string
  model?: StemModel
  twoStems?: TwoStems
  device?: 'cpu' | 'cuda'
  /** Path to the ONNX model file (default: searches standard locations) */
  modelPath?: string
  /** Log progress to console (default: false) */
  verbose?: boolean
}

export interface StemResult {
  model: string
  stems: Map<string, string>
  outputDir: string
}

// STFT parameters matching the htdemucs ONNX model
const DEMUCS_NFFT = 4096
const DEMUCS_HOP = 1024
const DEMUCS_SR = 44100
const STEM_NAMES = ['drums', 'bass', 'other', 'vocals']

/**
 * Find the htdemucs ONNX model file.
 * Searches in the package models/ directory and common download locations.
 */
function findModelPath(override?: string): string {
  if (override && existsSync(override)) return override

  const searchPaths = [
    join(dirname(fileURLToPath(import.meta.url)), '..', 'models', 'htdemucs.onnx'),
    join(process.env.HOME ?? '', '.cache', 'demucs', 'htdemucs.onnx'),
    join(process.env.HOME ?? '', 'models', 'htdemucs.onnx'),
  ]

  for (const p of searchPaths) {
    if (existsSync(p)) return p
  }

  throw new Error(
    `htdemucs.onnx model not found. Searched:\n${searchPaths.join('\n')}\n` +
    'Download from https://github.com/sevagh/demucs.onnx/releases and place in one of these locations.'
  )
}

/**
 * Load stereo audio via ffmpeg as interleaved Float32Array at the target sample rate.
 * Returns [left, right] channel arrays.
 */
async function loadStereoAudio(filePath: string, sr: number): Promise<{ left: Float64Array; right: Float64Array; numSamples: number }> {
  await requireCmd('ffmpeg')

  const { execFile } = await import('node:child_process')

  return new Promise((resolve, reject) => {
    const proc = execFile(
      'ffmpeg',
      [
        '-i', filePath,
        '-f', 'f32le',
        '-acodec', 'pcm_f32le',
        '-ac', '2',
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
        const float32 = new Float32Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength / 4
        )

        // Deinterleave stereo: [L, R, L, R, ...] -> separate channels
        const numSamples = float32.length / 2
        const left = new Float64Array(numSamples)
        const right = new Float64Array(numSamples)
        for (let i = 0; i < numSamples; i++) {
          left[i] = float32[2 * i]
          right[i] = float32[2 * i + 1]
        }

        resolve({ left, right, numSamples })
      }
    )
  })
}

/**
 * Save a stereo signal as a WAV file via ffmpeg.
 */
async function saveStereoWav(left: Float64Array, right: Float64Array, sr: number, outputPath: string): Promise<void> {
  await requireCmd('ffmpeg')

  const { execFile } = await import('node:child_process')

  // Interleave channels
  const interleaved = new Float32Array(left.length * 2)
  for (let i = 0; i < left.length; i++) {
    interleaved[2 * i] = left[i]
    interleaved[2 * i + 1] = right[i]
  }

  const buffer = Buffer.from(interleaved.buffer, interleaved.byteOffset, interleaved.byteLength)

  return new Promise((resolve, reject) => {
    const proc = execFile(
      'ffmpeg',
      [
        '-y',
        '-f', 'f32le',
        '-ar', String(sr),
        '-ac', '2',
        '-i', 'pipe:0',
        outputPath,
      ],
      { maxBuffer: 500 * 1024 * 1024 },
      (error) => {
        if (error) {
          reject(new Error(`ffmpeg failed to save ${outputPath}: ${error.message}`))
          return
        }
        resolve()
      }
    )

    proc.stdin!.write(buffer)
    proc.stdin!.end()
  })
}

/**
 * Compute complex-as-channels spectrogram for demucs ONNX model.
 * Takes stereo channels, computes STFT, and packs as [1, 4, freq_bins, frames]
 * where the 4 channels are: left_real, left_imag, right_real, right_imag.
 */
function computeComplexAsChannels(
  left: Float64Array,
  right: Float64Array
): { data: Float32Array; freqBins: number; numFrames: number } {
  const stftOpts = { nFft: DEMUCS_NFFT, hopLength: DEMUCS_HOP, window: 'hann' as const }

  const leftFrames = stftComplex(left, stftOpts)
  const rightFrames = stftComplex(right, stftOpts)

  const numFrames = leftFrames.length
  const freqBins = leftFrames[0].length / 2 // Each frame has [re, im] pairs

  // Pack into [1, 4, freq_bins, frames] layout (batch, channel, freq, time)
  const data = new Float32Array(4 * freqBins * numFrames)

  for (let t = 0; t < numFrames; t++) {
    for (let f = 0; f < freqBins; f++) {
      // Channel 0: left real
      data[0 * freqBins * numFrames + f * numFrames + t] = leftFrames[t][2 * f]
      // Channel 1: left imag
      data[1 * freqBins * numFrames + f * numFrames + t] = leftFrames[t][2 * f + 1]
      // Channel 2: right real
      data[2 * freqBins * numFrames + f * numFrames + t] = rightFrames[t][2 * f]
      // Channel 3: right imag
      data[3 * freqBins * numFrames + f * numFrames + t] = rightFrames[t][2 * f + 1]
    }
  }

  return { data, freqBins, numFrames }
}

/**
 * Reconstruct a stereo stem from complex-as-channels spectrogram output.
 * Takes [1, 2, freq_bins, frames] (2 channels for stereo, complex re+im interleaved)
 * and runs ISTFT on each channel.
 */
function reconstructStereoFromSpec(
  stemData: Float32Array,
  channels: number,
  freqBins: number,
  numFrames: number,
  targetLength: number
): { left: Float64Array; right: Float64Array } {
  const stftOpts = { nFft: DEMUCS_NFFT, hopLength: DEMUCS_HOP, window: 'hann' as const, length: targetLength }

  // If the model outputs complex-as-channels (4 channels: L_re, L_im, R_re, R_im)
  if (channels === 4) {
    const leftFrames: Float64Array[] = []
    const rightFrames: Float64Array[] = []

    for (let t = 0; t < numFrames; t++) {
      const leftFrame = new Float64Array(freqBins * 2)
      const rightFrame = new Float64Array(freqBins * 2)

      for (let f = 0; f < freqBins; f++) {
        leftFrame[2 * f] = stemData[0 * freqBins * numFrames + f * numFrames + t]
        leftFrame[2 * f + 1] = stemData[1 * freqBins * numFrames + f * numFrames + t]
        rightFrame[2 * f] = stemData[2 * freqBins * numFrames + f * numFrames + t]
        rightFrame[2 * f + 1] = stemData[3 * freqBins * numFrames + f * numFrames + t]
      }

      leftFrames.push(leftFrame)
      rightFrames.push(rightFrame)
    }

    return {
      left: istft(leftFrames, stftOpts),
      right: istft(rightFrames, stftOpts),
    }
  }

  // If the model outputs stereo waveforms directly (2 channels)
  const halfLen = stemData.length / 2
  const left = new Float64Array(halfLen)
  const right = new Float64Array(halfLen)
  for (let i = 0; i < halfLen; i++) {
    left[i] = stemData[i]
    right[i] = stemData[halfLen + i]
  }
  return { left, right }
}

/**
 * Separate audio into stems using the htdemucs ONNX model.
 * Pure TypeScript — no Python required.
 *
 * Requires:
 * - onnxruntime-node (npm, already a dependency)
 * - htdemucs.onnx model file
 * - ffmpeg for audio I/O
 */
export async function separate(options: SeparateOptions): Promise<StemResult> {
  const {
    input,
    outputDir,
    model = 'htdemucs',
    modelPath: modelPathOverride,
  } = options

  const verbose = options.verbose ?? false
  const modelPath = findModelPath(modelPathOverride)

  await mkdir(outputDir, { recursive: true })

  // Load onnxruntime-node
  const require = createRequire(import.meta.url)
  const ort = require('onnxruntime-node') as typeof import('onnxruntime-node')

  // 1. Load audio as stereo at 44100Hz
  const { left, right, numSamples } = await loadStereoAudio(input, DEMUCS_SR)

  // 2. Load the ONNX model and inspect its inputs/outputs
  const session = await ort.InferenceSession.create(modelPath)

  if (verbose) console.log('ONNX model loaded:', modelPath)
  if (verbose) console.log('Input names:', session.inputNames)
  if (verbose) console.log('Output names:', session.outputNames)

  // 3. Prepare the waveform tensor: [1, 2, paddedSamples]
  // The htdemucs ONNX model internally reshapes to {1, 4, -1, segment_size}.
  // The input sample count must be divisible by the model's segment alignment.
  const SEGMENT_ALIGN = 343980
  const paddedSamples = Math.ceil(numSamples / SEGMENT_ALIGN) * SEGMENT_ALIGN

  const waveformData = new Float32Array(2 * paddedSamples)
  for (let i = 0; i < numSamples; i++) {
    waveformData[i] = left[i]
    waveformData[paddedSamples + i] = right[i]
  }
  // Remaining samples are zero-padded (Float32Array initializes to 0)
  const waveformTensor = new ort.Tensor('float32', waveformData, [1, 2, paddedSamples])

  if (verbose) console.log(`Audio: ${numSamples} samples, padded to ${paddedSamples} (align ${SEGMENT_ALIGN})`)

  // 4. Compute complex-as-channels spectrogram: [1, 4, freq_bins, frames]
  // Use padded audio for spectrogram to match waveform length
  const paddedLeft = new Float64Array(paddedSamples)
  const paddedRight = new Float64Array(paddedSamples)
  paddedLeft.set(left)
  paddedRight.set(right)
  const { data: specData, freqBins, numFrames } = computeComplexAsChannels(paddedLeft, paddedRight)
  const spectrogramTensor = new ort.Tensor('float32', specData, [1, 4, freqBins, numFrames])

  // 5. Build the feed dictionary using the model's actual input names
  const feeds: Record<string, InstanceType<typeof ort.Tensor>> = {}
  for (const name of session.inputNames) {
    const nameLower = name.toLowerCase()
    if (nameLower.includes('stft') || nameLower.includes('spec')) {
      feeds[name] = spectrogramTensor
    } else {
      feeds[name] = waveformTensor
    }
  }

  // 6. Run inference
  if (verbose) console.log('Running demucs inference...')
  const results = await session.run(feeds)

  // 7. Extract stem outputs and save as WAV
  const stemPaths = new Map<string, string>()
  const outputNames = session.outputNames

  // Handle single-output models (all stems packed in one tensor)
  // vs multi-output models (one tensor per stem)
  if (outputNames.length === 1) {
    // Single output: shape is [batch, stems, channels, samples] or [stems, channels, samples]
    const tensor = results[outputNames[0]]
    const tensorData = tensor.data as Float32Array
    const dims = tensor.dims as readonly number[]

    if (verbose) console.log(`Output tensor shape: [${dims.join(', ')}]`)

    let numStems: number
    let numChannels: number
    let stemSamples: number
    let stemOffset: (s: number, ch: number, i: number) => number

    if (dims.length === 4) {
      // [batch, stems, channels, samples]
      numStems = dims[1]
      numChannels = dims[2]
      stemSamples = dims[3]
      stemOffset = (s, ch, i) => s * numChannels * stemSamples + ch * stemSamples + i
    } else if (dims.length === 3) {
      // [stems, channels, samples]
      numStems = dims[0]
      numChannels = dims[1]
      stemSamples = dims[2]
      stemOffset = (s, ch, i) => s * numChannels * stemSamples + ch * stemSamples + i
    } else if (dims.length === 2) {
      // [stems, samples] — mono stems
      numStems = dims[0]
      numChannels = 1
      stemSamples = dims[1]
      stemOffset = (s, _ch, i) => s * stemSamples + i
    } else {
      throw new Error(`Unexpected output tensor shape: [${dims.join(', ')}]`)
    }

    for (let s = 0; s < Math.min(numStems, STEM_NAMES.length); s++) {
      const stemName = STEM_NAMES[s]
      const stemLeft = new Float64Array(stemSamples)
      const stemRight = new Float64Array(stemSamples)

      for (let i = 0; i < stemSamples; i++) {
        stemLeft[i] = tensorData[stemOffset(s, 0, i)]
        stemRight[i] = numChannels > 1 ? tensorData[stemOffset(s, 1, i)] : tensorData[stemOffset(s, 0, i)]
      }

      const trimmedLeft = stemLeft.length > numSamples ? stemLeft.slice(0, numSamples) : stemLeft
      const trimmedRight = stemRight.length > numSamples ? stemRight.slice(0, numSamples) : stemRight

      const outputPath = join(outputDir, `${stemName}.wav`)
      await saveStereoWav(trimmedLeft, trimmedRight, DEMUCS_SR, outputPath)
      stemPaths.set(stemName, outputPath)
      if (verbose) console.log(`Saved ${stemName} -> ${outputPath}`)
    }
  } else {
    // Multi-output: one tensor per stem
    for (let s = 0; s < STEM_NAMES.length && s < outputNames.length; s++) {
      const stemName = STEM_NAMES[s]
      const outputName = outputNames[s]
      const tensor = results[outputName]
      const tensorData = tensor.data as Float32Array
      const tensorDims = tensor.dims as readonly number[]

      let stemLeft: Float64Array
      let stemRight: Float64Array

      if (tensorDims.length === 3) {
        // Shape: [1, 2, samples] — direct stereo waveform
        const stemSamples = tensorDims[2]
        stemLeft = new Float64Array(stemSamples)
        stemRight = new Float64Array(stemSamples)
        for (let i = 0; i < stemSamples; i++) {
          stemLeft[i] = tensorData[i]
          stemRight[i] = tensorData[stemSamples + i]
        }
      } else if (tensorDims.length === 4) {
        // Shape: [1, channels, freq_bins, frames] — spectrogram needing ISTFT
        const channels = tensorDims[1]
        const fBins = tensorDims[2]
        const tFrames = tensorDims[3]
        const result = reconstructStereoFromSpec(tensorData, channels, fBins, tFrames, numSamples)
        stemLeft = result.left
        stemRight = result.right
      } else {
        throw new Error(`Unexpected tensor shape for output "${outputName}": [${tensorDims.join(', ')}]`)
      }

      const trimmedLeft = stemLeft.length > numSamples ? stemLeft.slice(0, numSamples) : stemLeft
      const trimmedRight = stemRight.length > numSamples ? stemRight.slice(0, numSamples) : stemRight

      const outputPath = join(outputDir, `${stemName}.wav`)
      await saveStereoWav(trimmedLeft, trimmedRight, DEMUCS_SR, outputPath)
      stemPaths.set(stemName, outputPath)
      if (verbose) console.log(`Saved ${stemName} -> ${outputPath}`)
    }
  }

  return {
    model,
    stems: stemPaths,
    outputDir,
  }
}
