import { exec } from './exec.js'
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { detectOnsets } from './onset.js'
import { filter } from './audio.js'
import {
  GM_DRUMS,
  quantize,
  writeMidiFile,
  type MidiNote,
} from './midi.js'

export interface DrumParts {
  /** Path to kick wav */
  kick: string
  /** Path to snare wav */
  snare: string
  /** Path to hihat wav */
  hihat: string
}

export interface AbletonNote {
  pitch: number
  /** Time in beats */
  time: number
  /** Duration in beats */
  duration: number
  velocity: number
}

export interface DrumPartNotes {
  kick: AbletonNote[]
  snare: AbletonNote[]
  hihat: AbletonNote[]
}

/**
 * Pure ffmpeg implementation of isolateDrumParts.
 * Uses ffmpeg audio filters for frequency-domain separation:
 * - Kick: lowpass at 250 Hz
 * - Snare: bandpass 200-5000 Hz
 * - Hihat: bandpass 3000-16000 Hz
 */
export async function isolateDrumPartsTS(
  drumsFile: string,
  outputDir: string,
  options?: { sr?: number }
): Promise<DrumParts> {
  await mkdir(outputDir, { recursive: true })

  const sr = options?.sr ?? 44100
  const base = basename(drumsFile, extname(drumsFile))

  const kickPath = join(outputDir, `${base}_kick.wav`)
  const snarePath = join(outputDir, `${base}_snare.wav`)
  const hihatPath = join(outputDir, `${base}_hihat.wav`)

  const arArgs = ['-ar', String(sr), '-ac', '1']

  await Promise.all([
    // Kick: lowpass at 250 Hz
    exec('ffmpeg', [
      '-y', '-i', drumsFile,
      '-af', 'lowpass=f=250',
      ...arArgs, kickPath,
    ], { timeout: 120_000 }),
    // Snare: bandpass 200-5000 Hz
    exec('ffmpeg', [
      '-y', '-i', drumsFile,
      '-af', 'bandpass=f=1000:width_type=h:w=4800,highpass=f=200',
      ...arArgs, snarePath,
    ], { timeout: 120_000 }),
    // Hihat: bandpass 3000-16000 Hz
    exec('ffmpeg', [
      '-y', '-i', drumsFile,
      '-af', 'bandpass=f=9500:width_type=h:w=13000,highpass=f=3000',
      ...arArgs, hihatPath,
    ], { timeout: 120_000 }),
  ])

  return {
    kick: kickPath,
    snare: snarePath,
    hihat: hihatPath,
  }
}

/**
 * Isolate drum parts (kick, snare, hihat) from a drum audio file.
 *
 * Uses ffmpeg audio filters for frequency-domain separation.
 *
 * Frequency ranges:
 * - Kick: lowpass at 250 Hz
 * - Snare: bandpass 200-5000 Hz
 * - Hihat: bandpass 3000-16000 Hz
 */
export const isolateDrumParts = isolateDrumPartsTS

/**
 * Convert onset times (in seconds) to Ableton-ready note arrays
 * with quantization to the given tempo grid.
 */
function onsetsToAbletonNotes(
  onsets: Array<{ time: number; velocity: number }>,
  pitch: number,
  tempo: number,
  quantizeDivision: 4 | 8 | 16 | 32
): AbletonNote[] {
  const beatsPerSecond = tempo / 60
  const gridBeats = 4 / quantizeDivision // grid size in beats
  const seen = new Set<number>()
  const notes: AbletonNote[] = []

  for (const onset of onsets) {
    const rawBeat = onset.time * beatsPerSecond
    const quantizedBeat = Math.round(rawBeat / gridBeats) * gridBeats
    // Round to avoid floating point duplicates
    const roundedBeat = Math.round(quantizedBeat * 10000) / 10000

    if (seen.has(roundedBeat)) continue
    seen.add(roundedBeat)

    notes.push({
      pitch,
      time: roundedBeat,
      duration: gridBeats,
      velocity: Math.max(1, Math.min(127, onset.velocity)),
    })
  }

  return notes.sort((a, b) => a.time - b.time)
}

/**
 * Extract drum MIDI from an audio file by isolating parts and detecting onsets.
 *
 * Process:
 * 1. Isolate kick, snare, and hihat via frequency filtering
 * 2. Run onset detection on each isolated part
 * 3. Quantize to the given tempo grid
 * 4. Return Ableton-ready note arrays with GM drum pitches
 *
 * Also saves individual MIDI files to the output directory.
 */
export async function extractDrumMidi(
  drumsFile: string,
  outputDir: string,
  options: { tempo: number; quantize?: 4 | 8 | 16 | 32 }
): Promise<DrumPartNotes> {
  const { tempo, quantize: quantizeDivision = 16 } = options

  // Step 1: Isolate drum parts
  const parts = await isolateDrumParts(drumsFile, outputDir)

  // Step 2: Detect onsets on each part
  const [kickOnsets, snareOnsets, hihatOnsets] = await Promise.all([
    detectOnsets(parts.kick, { minimumInterval: 0.08 }),
    detectOnsets(parts.snare, { minimumInterval: 0.06 }),
    detectOnsets(parts.hihat, { minimumInterval: 0.04 }),
  ])

  // Step 3: Convert to Ableton notes with quantization
  const kickNotes = onsetsToAbletonNotes(kickOnsets, GM_DRUMS.KICK, tempo, quantizeDivision)
  const snareNotes = onsetsToAbletonNotes(snareOnsets, GM_DRUMS.SNARE, tempo, quantizeDivision)
  const hihatNotes = onsetsToAbletonNotes(hihatOnsets, GM_DRUMS.CLOSED_HIHAT, tempo, quantizeDivision)

  // Step 4: Save individual MIDI files
  const base = basename(drumsFile, extname(drumsFile))
  const beatsPerSecond = tempo / 60

  const toMidiNotes = (notes: AbletonNote[]): MidiNote[] =>
    notes.map((n) => ({
      pitch: n.pitch,
      start: n.time / beatsPerSecond,
      duration: n.duration / beatsPerSecond,
      velocity: n.velocity,
      channel: 9,
    }))

  await Promise.all([
    writeMidiFile(join(outputDir, `${base}_kick.mid`), {
      tempo,
      tracks: [{ name: 'Kick', notes: toMidiNotes(kickNotes), isDrum: true }],
    }),
    writeMidiFile(join(outputDir, `${base}_snare.mid`), {
      tempo,
      tracks: [{ name: 'Snare', notes: toMidiNotes(snareNotes), isDrum: true }],
    }),
    writeMidiFile(join(outputDir, `${base}_hihat.mid`), {
      tempo,
      tracks: [{ name: 'HiHat', notes: toMidiNotes(hihatNotes), isDrum: true }],
    }),
  ])

  return {
    kick: kickNotes,
    snare: snareNotes,
    hihat: hihatNotes,
  }
}

/**
 * Split a large note array into batches for Ableton MCP tool calls.
 * Default batch size is 200 notes.
 */
export function drumNotesToBatches(
  notes: AbletonNote[],
  batchSize: number = 200
): AbletonNote[][] {
  const batches: AbletonNote[][] = []
  for (let i = 0; i < notes.length; i += batchSize) {
    batches.push(notes.slice(i, i + batchSize))
  }
  return batches
}
