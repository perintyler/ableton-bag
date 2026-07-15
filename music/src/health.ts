/**
 * Health check module — verifies all @barry/music dependencies are available.
 *
 * Call checkHealth() before using any module to get a clear error
 * if something is missing (ffmpeg, onnxruntime-node, ONNX models, etc.).
 */

import { which } from './exec.js'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

export interface HealthCheckResult {
  ready: boolean
  ffmpeg: boolean
  onnxruntime: boolean
  basicPitchModel: boolean
  htdemucsModel: boolean
  errors: string[]
}

/**
 * Check that all @barry/music dependencies are available.
 * Call this before using any module to get a clear error if something is missing.
 */
export async function checkHealth(): Promise<HealthCheckResult> {
  const errors: string[] = []

  // 1. Check ffmpeg
  const ffmpegPath = await which('ffmpeg')
  const ffmpeg = ffmpegPath !== null
  if (!ffmpeg) {
    errors.push('ffmpeg not found on PATH. Install with: brew install ffmpeg')
  }

  // 2. Check onnxruntime-node
  let onnxruntime = false
  try {
    const require = createRequire(import.meta.url)
    require('onnxruntime-node')
    onnxruntime = true
  } catch (e: any) {
    errors.push(`onnxruntime-node not available: ${e.message}`)
  }

  // 3. Check basic-pitch ONNX model (nmp.onnx)
  const basicPitchModel = findBasicPitchModel()
  if (!basicPitchModel) {
    errors.push(
      'basic-pitch ONNX model (nmp.onnx) not found. Searched:\n' +
        '  - music/models/basic-pitch-nmp.onnx\n' +
        '  - ~/audio-tools-venv/lib/python3.{11,12,13}/site-packages/basic_pitch/saved_models/icassp_2022/nmp.onnx'
    )
  }

  // 4. Check htdemucs ONNX model
  const htdemucsModel = findHtdemucsModel()
  if (!htdemucsModel) {
    errors.push(
      'htdemucs.onnx model not found. Searched:\n' +
        '  - music/models/htdemucs.onnx\n' +
        '  - ~/.cache/demucs/htdemucs.onnx\n' +
        '  - ~/models/htdemucs.onnx'
    )
  }

  const ready = ffmpeg && onnxruntime && basicPitchModel && htdemucsModel

  return {
    ready,
    ffmpeg,
    onnxruntime,
    basicPitchModel,
    htdemucsModel,
    errors,
  }
}

/** Search for the basic-pitch nmp.onnx model in known locations. */
function findBasicPitchModel(): boolean {
  const pkgModels = join(dirname(fileURLToPath(import.meta.url)), '..', 'models', 'basic-pitch-nmp.onnx')
  if (existsSync(pkgModels)) return true

  const home = process.env.HOME ?? ''
  const venvCandidates = [
    join(home, 'audio-tools-venv/lib/python3.13/site-packages/basic_pitch/saved_models/icassp_2022/nmp.onnx'),
    join(home, 'audio-tools-venv/lib/python3.12/site-packages/basic_pitch/saved_models/icassp_2022/nmp.onnx'),
    join(home, 'audio-tools-venv/lib/python3.11/site-packages/basic_pitch/saved_models/icassp_2022/nmp.onnx'),
  ]

  for (const candidate of venvCandidates) {
    if (existsSync(candidate)) return true
  }

  return false
}

/** Search for the htdemucs.onnx model in known locations. */
function findHtdemucsModel(): boolean {
  const pkgModels = join(dirname(fileURLToPath(import.meta.url)), '..', 'models', 'htdemucs.onnx')
  if (existsSync(pkgModels)) return true

  const home = process.env.HOME ?? ''
  const cachePaths = [
    join(home, '.cache', 'demucs', 'htdemucs.onnx'),
    join(home, 'models', 'htdemucs.onnx'),
  ]

  for (const p of cachePaths) {
    if (existsSync(p)) return true
  }

  return false
}
