import { exec, requireCmd } from './exec.js'
import { existsSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import { mkdir } from 'node:fs/promises'

export interface AudioInfo {
  path: string
  duration: number
  sampleRate: number
  channels: number
  codec: string
  bitRate: number
}

export async function getAudioInfo(filePath: string): Promise<AudioInfo> {
  await requireCmd('ffprobe')
  const { stdout } = await exec('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ])
  const data = JSON.parse(stdout)
  const stream = data.streams?.find((s: any) => s.codec_type === 'audio')
  if (!stream) throw new Error(`No audio stream found in ${filePath}`)

  return {
    path: filePath,
    duration: parseFloat(data.format?.duration ?? stream.duration ?? '0'),
    sampleRate: parseInt(stream.sample_rate ?? '44100', 10),
    channels: stream.channels ?? 2,
    codec: stream.codec_name ?? 'unknown',
    bitRate: parseInt(data.format?.bit_rate ?? '0', 10),
  }
}

export interface FilterOptions {
  input: string
  output: string
  highpass?: number
  lowpass?: number
  sampleRate?: number
  mono?: boolean
}

export async function filter(options: FilterOptions): Promise<string> {
  await requireCmd('ffmpeg')
  const { input, output, highpass, lowpass, sampleRate, mono } = options

  await mkdir(dirname(output), { recursive: true })

  const filters: string[] = []
  if (highpass) filters.push(`highpass=f=${highpass}`)
  if (lowpass) filters.push(`lowpass=f=${lowpass}`)

  const args = ['-y', '-i', input]
  if (filters.length > 0) {
    args.push('-af', filters.join(','))
  }
  if (mono) args.push('-ac', '1')
  if (sampleRate) args.push('-ar', String(sampleRate))
  args.push(output)

  await exec('ffmpeg', args)
  return output
}

export interface IsolateFrequencyBandOptions {
  input: string
  outputDir: string
  bands: Array<{
    name: string
    low?: number
    high?: number
  }>
  mono?: boolean
}

export async function isolateFrequencyBands(
  options: IsolateFrequencyBandOptions
): Promise<Map<string, string>> {
  const { input, outputDir, bands, mono } = options
  await mkdir(outputDir, { recursive: true })
  const ext = extname(input) || '.wav'
  const base = basename(input, ext)

  const results = new Map<string, string>()

  await Promise.all(
    bands.map(async (band) => {
      const outPath = join(outputDir, `${base}_${band.name}${ext}`)
      await filter({
        input,
        output: outPath,
        highpass: band.low,
        lowpass: band.high,
        mono,
      })
      results.set(band.name, outPath)
    })
  )

  return results
}

/** Common frequency bands for drum isolation */
export const DRUM_BANDS = {
  sub: { name: 'sub', high: 80 },
  kick: { name: 'kick', low: 40, high: 200 },
  snare: { name: 'snare', low: 200, high: 3000 },
  hihats: { name: 'hihats', low: 5000 },
  cymbals: { name: 'cymbals', low: 8000 },
  hihatsAndRims: { name: 'hihats_rims', low: 3000, high: 16000 },
} as const

export async function convertToWav(
  input: string,
  output?: string,
  options?: { sampleRate?: number; mono?: boolean }
): Promise<string> {
  await requireCmd('ffmpeg')
  const out = output ?? join(dirname(input), `${basename(input, extname(input))}.wav`)
  await mkdir(dirname(out), { recursive: true })

  const args = ['-y', '-i', input]
  if (options?.sampleRate) args.push('-ar', String(options.sampleRate))
  if (options?.mono) args.push('-ac', '1')
  args.push(out)

  await exec('ffmpeg', args)
  return out
}
