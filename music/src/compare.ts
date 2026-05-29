import { analyzeTimbre, type AudioAnalysisResult } from './analyze.js'
import { exec } from './exec.js'

export interface EQBandRecommendation {
  band: string
  centerHz: number
  action: 'boost' | 'cut' | 'neutral'
  amountDb: number
  energyDelta: number
}

export interface EQRecommendation {
  bands: EQBandRecommendation[]
  centroidShiftHz: number
  brightnessDirection: 'brighten' | 'darken' | 'neutral'
  /** Maps band recommendations to 0-127 macro range, centered at 63.5 */
  macroValues: {
    low: number
    mid: number
    high: number
  }
}

export interface TimbreComparison {
  source: AudioAnalysisResult
  target: AudioAnalysisResult
  eq: EQRecommendation
}

const BAND_DEFINITIONS: Array<{ key: keyof AudioAnalysisResult['spectral']['energyBands']; name: string; centerHz: number }> = [
  { key: 'subBass', name: 'Sub Bass', centerHz: 50 },
  { key: 'bass', name: 'Bass', centerHz: 200 },
  { key: 'lowMid', name: 'Low Mid', centerHz: 1000 },
  { key: 'mid', name: 'Mid', centerHz: 3000 },
  { key: 'upperMid', name: 'Upper Mid', centerHz: 6000 },
  { key: 'presence', name: 'Presence', centerHz: 10000 },
  { key: 'air', name: 'Air', centerHz: 16000 },
]

/** Scale factor for mapping dB adjustments to 0-127 macro range */
const MACRO_SCALE_FACTOR = 5

/**
 * Clamp a value to the 0-127 MIDI range.
 */
function clampMacro(value: number): number {
  return Math.round(Math.max(0, Math.min(127, value)))
}

/**
 * Compute approximate dB adjustment from energy percentages.
 * Uses 10 * log10(target / source) for each band.
 * Returns 0 if source energy is effectively zero.
 */
function energyToDB(sourceEnergy: number, targetEnergy: number): number {
  if (sourceEnergy < 0.01) {
    // Source has negligible energy in this band
    return targetEnergy > 0.5 ? 6 : 0
  }
  return 10 * Math.log10(targetEnergy / sourceEnergy)
}

/**
 * Build per-band EQ recommendations from source and target analysis results.
 */
function buildBandRecommendations(
  source: AudioAnalysisResult,
  target: AudioAnalysisResult
): EQBandRecommendation[] {
  return BAND_DEFINITIONS.map(({ key, name, centerHz }) => {
    const sourceEnergy = source.spectral.energyBands[key]
    const targetEnergy = target.spectral.energyBands[key]
    const energyDelta = targetEnergy - sourceEnergy
    const amountDb = energyToDB(sourceEnergy, targetEnergy)

    let action: 'boost' | 'cut' | 'neutral'
    if (Math.abs(amountDb) < 1) {
      action = 'neutral'
    } else if (amountDb > 0) {
      action = 'boost'
    } else {
      action = 'cut'
    }

    return {
      band: name,
      centerHz,
      action,
      amountDb: Math.round(amountDb * 10) / 10,
      energyDelta: Math.round(energyDelta * 10) / 10,
    }
  })
}

/**
 * Compute 3-band macro values from source and target analysis results.
 *
 * Macro formula: 63.5 + (dB_adjustment * scale_factor) clamped to 0-127
 *
 * Band groupings:
 * - low: sub-bass + bass
 * - mid: low-mid + mid
 * - high: upper-mid + presence + air
 */
export function suggestMacroValues(
  source: AudioAnalysisResult,
  target: AudioAnalysisResult
): { low: number; mid: number; high: number } {
  const s = source.spectral.energyBands
  const t = target.spectral.energyBands

  // Average dB adjustment per macro band
  const lowSourceEnergy = s.subBass + s.bass
  const lowTargetEnergy = t.subBass + t.bass
  const lowDb = energyToDB(lowSourceEnergy, lowTargetEnergy)

  const midSourceEnergy = s.lowMid + s.mid
  const midTargetEnergy = t.lowMid + t.mid
  const midDb = energyToDB(midSourceEnergy, midTargetEnergy)

  const highSourceEnergy = s.upperMid + s.presence + s.air
  const highTargetEnergy = t.upperMid + t.presence + t.air
  const highDb = energyToDB(highSourceEnergy, highTargetEnergy)

  return {
    low: clampMacro(63.5 + lowDb * MACRO_SCALE_FACTOR),
    mid: clampMacro(63.5 + midDb * MACRO_SCALE_FACTOR),
    high: clampMacro(63.5 + highDb * MACRO_SCALE_FACTOR),
  }
}

/**
 * Compare the timbral characteristics of two audio files and generate
 * EQ recommendations to make the source sound more like the target.
 *
 * Uses Python/librosa under the hood via analyzeTimbre.
 */
export interface SpectralCorrectionCurve {
  /** Center frequencies for each band (1/3 octave spacing) */
  frequencies: number[]
  /** Required correction in dB at each frequency */
  corrections_dB: number[]
  /** Smoothed correction curve (less noisy) */
  smoothed_dB: number[]
}

/**
 * Compute a detailed frequency-by-frequency correction curve between two audio files.
 * Returns 1/3 octave center frequencies with per-band correction values in dB.
 * Corrections are clamped to +/-12 dB to avoid extreme adjustments.
 */
export async function spectralCorrectionCurve(
  sourceFile: string,
  targetFile: string,
  options?: { python?: string }
): Promise<SpectralCorrectionCurve> {
  const python = options?.python ?? await findPython()

  const script = `
import librosa
import numpy as np
import json
import sys

source_file = sys.argv[1]
target_file = sys.argv[2]

y_src, sr = librosa.load(source_file, sr=44100, mono=True)
y_tgt, _ = librosa.load(target_file, sr=44100, mono=True)

D_src = np.abs(librosa.stft(y_src, n_fft=4096))
D_tgt = np.abs(librosa.stft(y_tgt, n_fft=4096))
avg_src = np.mean(D_src, axis=1)
avg_tgt = np.mean(D_tgt, axis=1)
freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)

third_octave = [31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
                630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300,
                8000, 10000, 12500, 16000, 20000]

corrections = []
for fc in third_octave:
    lo = fc / (2 ** (1/6))
    hi = fc * (2 ** (1/6))
    mask = (freqs >= lo) & (freqs < hi)
    src_mag = np.mean(avg_src[mask]) if np.any(mask) else 1e-10
    tgt_mag = np.mean(avg_tgt[mask]) if np.any(mask) else 1e-10
    src_mag = max(src_mag, 1e-10)
    tgt_mag = max(tgt_mag, 1e-10)
    corr = 20 * np.log10(tgt_mag / src_mag)
    corr = float(np.clip(corr, -12, 12))
    corrections.append(round(corr, 2))

# 1/3 octave smoothing: 3-point moving average
smoothed = []
for i in range(len(corrections)):
    lo_i = max(0, i - 1)
    hi_i = min(len(corrections), i + 2)
    smoothed.append(round(float(np.mean(corrections[lo_i:hi_i])), 2))

result = {
    "frequencies": third_octave,
    "corrections_dB": corrections,
    "smoothed_dB": smoothed
}
print(json.dumps(result))
`

  const { stdout } = await exec(python, ['-c', script, sourceFile, targetFile], {
    timeout: 120_000,
  })

  const lines = stdout.trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SpectralCorrectionCurve
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

/**
 * Compare the timbral characteristics of two audio files and generate
 * EQ recommendations to make the source sound more like the target.
 *
 * Uses Python/librosa under the hood via analyzeTimbre.
 */
export async function compareTimbre(
  sourceFile: string,
  targetFile: string,
  options?: { python?: string }
): Promise<TimbreComparison> {
  const [source, target] = await Promise.all([
    analyzeTimbre(sourceFile, options),
    analyzeTimbre(targetFile, options),
  ])

  const bands = buildBandRecommendations(source, target)
  const macroValues = suggestMacroValues(source, target)

  const centroidShiftHz = target.spectral.centroidHz - source.spectral.centroidHz
  let brightnessDirection: 'brighten' | 'darken' | 'neutral'
  if (centroidShiftHz > 500) {
    brightnessDirection = 'brighten'
  } else if (centroidShiftHz < -500) {
    brightnessDirection = 'darken'
  } else {
    brightnessDirection = 'neutral'
  }

  return {
    source,
    target,
    eq: {
      bands,
      centroidShiftHz,
      brightnessDirection,
      macroValues,
    },
  }
}
