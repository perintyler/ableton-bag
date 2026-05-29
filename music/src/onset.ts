import { requireCmd } from './exec.js'
import { execFile } from 'node:child_process'

export interface Onset {
  /** Time in seconds */
  time: number
  /** Estimated velocity (0-127) */
  velocity: number
}

export interface OnsetDetectionOptions {
  /** Silence threshold in dB (default: -40) */
  silenceThreshold?: number
  /** Minimum duration between onsets in seconds (default: 0.03) */
  minimumInterval?: number
}

/**
 * Detect onsets (transient attacks) in an audio file using ffmpeg's silencedetect
 * and energy-based analysis. Returns onset times with estimated velocities.
 *
 * This uses ffmpeg's `ebur128` and `astats` filters for energy analysis,
 * combined with onset detection via amplitude envelope following.
 */
export async function detectOnsets(
  filePath: string,
  options?: OnsetDetectionOptions
): Promise<Onset[]> {
  await requireCmd('ffmpeg')

  const threshold = options?.silenceThreshold ?? -40
  const minInterval = options?.minimumInterval ?? 0.03

  // Use ffmpeg to extract raw PCM samples for analysis.
  // Must use execFile with encoding: 'buffer' to get raw binary PCM data.
  // Using exec() returns stdout as UTF-8 string, which corrupts binary data.
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    execFile(
      'ffmpeg',
      [
        '-i', filePath,
        '-ac', '1',
        '-ar', '8000', // downsample for faster analysis
        '-f', 'f32le',
        '-v', 'quiet',
        'pipe:1',
      ],
      {
        maxBuffer: 100 * 1024 * 1024,
        encoding: 'buffer' as any,
      },
      (error, stdout) => {
        if (error) {
          reject(new Error(`ffmpeg failed to decode ${filePath}: ${error.message}`))
          return
        }
        resolve(stdout as unknown as Buffer)
      }
    )
  })

  const samples = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 4
  )
  const sr = 8000
  const hopSize = 64 // ~8ms hop
  const frameSize = 256 // ~32ms window

  // Compute spectral flux (onset strength)
  const energies: number[] = []
  for (let i = 0; i < samples.length - frameSize; i += hopSize) {
    let energy = 0
    for (let j = 0; j < frameSize; j++) {
      energy += samples[i + j] * samples[i + j]
    }
    energies.push(energy / frameSize)
  }

  // Compute onset strength as positive first-order difference of energy
  const onsetStrength: number[] = []
  for (let i = 1; i < energies.length; i++) {
    onsetStrength.push(Math.max(0, energies[i] - energies[i - 1]))
  }

  if (onsetStrength.length === 0) return []

  // Adaptive threshold: mean + 1.5 * std
  const mean = onsetStrength.reduce((a, b) => a + b, 0) / onsetStrength.length
  const std = Math.sqrt(
    onsetStrength.reduce((a, b) => a + (b - mean) ** 2, 0) / onsetStrength.length
  )
  const adaptiveThreshold = mean + 1.5 * std

  // Peak picking with minimum interval
  const onsets: Onset[] = []
  let lastOnsetTime = -Infinity
  let maxStrength = -Infinity
  for (let i = 0; i < onsetStrength.length; i++) {
    if (onsetStrength[i] > maxStrength) maxStrength = onsetStrength[i]
  }

  for (let i = 1; i < onsetStrength.length - 1; i++) {
    const val = onsetStrength[i]
    if (
      val > adaptiveThreshold &&
      val > onsetStrength[i - 1] &&
      val >= onsetStrength[i + 1]
    ) {
      const time = ((i + 1) * hopSize) / sr
      if (time - lastOnsetTime >= minInterval) {
        // Map strength to velocity (40-127)
        const velocity = Math.round((val / maxStrength) * 87 + 40)
        onsets.push({
          time,
          velocity: Math.min(127, Math.max(40, velocity)),
        })
        lastOnsetTime = time
      }
    }
  }

  return onsets
}

/**
 * Detect onsets using aubio (if available). Falls back to built-in detection.
 */
export async function detectOnsetsAubio(
  filePath: string,
  options?: { method?: 'energy' | 'hfc' | 'complex' | 'specdiff' }
): Promise<Onset[]> {
  const method = options?.method ?? 'hfc'

  try {
    await requireCmd('aubionotes')
  } catch {
    // Fall back to built-in
    return detectOnsets(filePath)
  }

  const { stdout } = await exec('aubionotes', [
    '-i', filePath,
    '-O', method,
  ])

  // aubionotes outputs: pitch velocity_on time_on duration
  const onsets: Onset[] = []
  for (const line of stdout.trim().split('\n')) {
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 3) {
      const velocity = parseInt(parts[1], 10)
      const time = parseFloat(parts[2])
      if (!isNaN(time) && !isNaN(velocity)) {
        onsets.push({ time, velocity })
      }
    }
  }

  return onsets
}
