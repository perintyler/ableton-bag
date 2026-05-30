/* eslint-disable no-console -- verbose diagnostic output guarded by flag */
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

  // 3. Process in segments
  // The htdemucs ONNX model expects segments of exactly SEGMENT_LENGTH samples (7.8s at 44100Hz).
  // Process the audio in overlapping segments and crossfade to avoid boundary artifacts.
  const SEGMENT_LENGTH = 343980  // model.segment * model.samplerate
  const OVERLAP = Math.floor(SEGMENT_LENGTH * 0.25)  // 25% overlap for crossfading
  const STEP = SEGMENT_LENGTH - OVERLAP

  const numSegments = Math.max(1, Math.ceil((numSamples - OVERLAP) / STEP))
  if (verbose) console.log(`Audio: ${numSamples} samples, processing in ${numSegments} segments of ${SEGMENT_LENGTH} samples`)

  // Allocate output stem accumulators: [4 stems][2 channels][numSamples]
  const stemAccum = STEM_NAMES.map(() => ({
    left: new Float64Array(numSamples),
    right: new Float64Array(numSamples),
    weight: new Float64Array(numSamples),
  }))

  for (let seg = 0; seg < numSegments; seg++) {
    const start = seg * STEP
    const end = Math.min(start + SEGMENT_LENGTH, numSamples)
    const segLen = SEGMENT_LENGTH  // always use full segment length (zero-pad if needed)

    // Extract segment (zero-padded to SEGMENT_LENGTH)
    const segLeft = new Float64Array(segLen)
    const segRight = new Float64Array(segLen)
    const validLen = end - start
    for (let i = 0; i < validLen; i++) {
      segLeft[i] = left[start + i]
      segRight[i] = right[start + i]
    }

    // Create waveform tensor: [1, 2, SEGMENT_LENGTH]
    const waveformData = new Float32Array(2 * segLen)
    for (let i = 0; i < segLen; i++) {
      waveformData[i] = segLeft[i]
      waveformData[segLen + i] = segRight[i]
    }
    const waveformTensor = new ort.Tensor('float32', waveformData, [1, 2, segLen])

    // Build feed dictionary
    const feeds: Record<string, InstanceType<typeof ort.Tensor>> = {}
    for (const name of session.inputNames) {
      feeds[name] = waveformTensor
    }

    // Run inference on this segment
    if (verbose) console.log(`  Segment ${seg + 1}/${numSegments} (${start}-${end})...`)
    const results = await session.run(feeds)

    // Extract stems from output and accumulate with crossfade weights
    const outputTensor = results[session.outputNames[0]]
    const outputData = outputTensor.data as Float32Array
    const outputDims = outputTensor.dims as readonly number[]

    // Build crossfade window (ramp up at start, ramp down at end of overlap regions)
    const window = new Float64Array(segLen)
    for (let i = 0; i < segLen; i++) {
      let w = 1.0
      if (seg > 0 && i < OVERLAP) {
        w = i / OVERLAP  // ramp up in overlap region at start
      }
      if (seg < numSegments - 1 && i >= segLen - OVERLAP) {
        w = (segLen - 1 - i) / OVERLAP  // ramp down in overlap region at end
      }
      window[i] = w
    }

    // Parse output tensor — determine shape
    let numStems: number, numCh: number, stemSamples: number
    if (outputDims.length === 4) {
      numStems = outputDims[1]; numCh = outputDims[2]; stemSamples = outputDims[3]
    } else if (outputDims.length === 3) {
      numStems = outputDims[0]; numCh = outputDims[1]; stemSamples = outputDims[2]
    } else {
      throw new Error(`Unexpected output shape: [${outputDims.join(', ')}]`)
    }

    for (let s = 0; s < Math.min(numStems, STEM_NAMES.length); s++) {
      for (let i = 0; i < Math.min(stemSamples, validLen); i++) {
        const outIdx = start + i
        if (outIdx >= numSamples) break
        const lIdx = s * numCh * stemSamples + 0 * stemSamples + i
        const rIdx = numCh > 1 ? s * numCh * stemSamples + 1 * stemSamples + i : lIdx
        const w = window[i]
        stemAccum[s].left[outIdx] += outputData[lIdx] * w
        stemAccum[s].right[outIdx] += outputData[rIdx] * w
        stemAccum[s].weight[outIdx] += w
      }
    }
  }

  // Normalize by accumulated weights
  for (const accum of stemAccum) {
    for (let i = 0; i < numSamples; i++) {
      if (accum.weight[i] > 0) {
        accum.left[i] /= accum.weight[i]
        accum.right[i] /= accum.weight[i]
      }
    }
  }

  // 7. Save accumulated stems as WAV files
  const stemPaths = new Map<string, string>()

  for (let s = 0; s < STEM_NAMES.length; s++) {
    const stemName = STEM_NAMES[s]
    const outputPath = join(outputDir, `${stemName}.wav`)
    await saveStereoWav(stemAccum[s].left, stemAccum[s].right, DEMUCS_SR, outputPath)
    stemPaths.set(stemName, outputPath)
    if (verbose) console.log(`Saved ${stemName} -> ${outputPath}`)
  }

  return {
    model,
    stems: stemPaths,
    outputDir,
  }
}
