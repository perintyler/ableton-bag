import { exec, requireCmd } from './exec.js'

export interface SpectralAnalysis {
  /** Spectral centroid in Hz — higher = brighter */
  centroidHz: number
  /** Spectral bandwidth in Hz — higher = wider frequency spread */
  bandwidthHz: number
  /** Frequency below which 85% of energy sits */
  rolloff85Hz: number
  /** 0 = tonal/ringy, 1 = white noise */
  spectralFlatness: number
  /** Energy distribution by frequency band (percentage) */
  energyBands: {
    subBass: number
    bass: number
    lowMid: number
    mid: number
    upperMid: number
    presence: number
    air: number
  }
  /** Top resonant frequencies in Hz */
  peakFrequencies: number[]
}

export interface TransientAnalysis {
  /** Median attack time in ms (10% to peak) */
  attackMs: number
  /** Median decay time in ms (peak to 10%) */
  decayMs: number
  /** Total detected transient hits */
  hitCount: number
}

export interface AudioAnalysisResult {
  spectral: SpectralAnalysis
  transient: TransientAnalysis
  summary: {
    brightness: 'dark' | 'medium' | 'bright'
    texture: 'tonal' | 'semi-metallic' | 'noisy'
    attack: 'very-fast' | 'fast' | 'medium' | 'slow'
    decay: 'short' | 'medium' | 'long'
  }
}

/**
 * Analyze the sonic character of an audio file.
 * Uses Python/librosa under the hood for spectral analysis.
 * Useful for understanding timbral qualities to replicate with synthesizers.
 */
export async function analyzeTimbre(
  filePath: string,
  options?: { python?: string }
): Promise<AudioAnalysisResult> {
  const python = options?.python ?? await findPython()

  const script = `
import librosa
import numpy as np
import json
import sys

y, sr = librosa.load(sys.argv[1], sr=44100, mono=True)

centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)[0])
bandwidth = np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)[0])
rolloff = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)[0])
flatness = float(np.mean(librosa.feature.spectral_flatness(y=y)[0]))

D = np.abs(librosa.stft(y, n_fft=4096))
avg_spectrum = np.mean(D, axis=1)
freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
total_energy = np.sum(avg_spectrum ** 2)

def band_pct(lo, hi):
    mask = (freqs >= lo) & (freqs < hi)
    return float(np.sum(avg_spectrum[mask] ** 2) / total_energy * 100) if total_energy > 0 else 0

peaks = freqs[np.argsort(avg_spectrum)[-5:][::-1]].tolist()

onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)
onset_frames = librosa.onset.onset_detect(y=y, sr=sr, units='frames', hop_length=512)
hop_time = 512 / sr

attack_times = []
decay_times = []
strong = np.argsort(onset_env)[-min(50, len(onset_env)):]
for idx in strong:
    s = max(0, idx - 5)
    e = min(len(onset_env), idx + 50)
    seg = onset_env[s:e]
    if len(seg) < 10: continue
    pk = np.argmax(seg)
    pv = seg[pk]
    if pv < 0.1: continue
    th = pv * 0.1
    a_start = 0
    for j in range(pk):
        if seg[j] > th: a_start = j; break
    attack_times.append((pk - a_start) * hop_time)
    d_end = len(seg) - 1
    for j in range(pk, len(seg)):
        if seg[j] < th: d_end = j; break
    decay_times.append((d_end - pk) * hop_time)

result = {
    "spectral": {
        "centroidHz": round(float(centroid)),
        "bandwidthHz": round(float(bandwidth)),
        "rolloff85Hz": round(float(rolloff)),
        "spectralFlatness": round(flatness, 4),
        "energyBands": {
            "subBass": round(band_pct(0, 100), 1),
            "bass": round(band_pct(100, 500), 1),
            "lowMid": round(band_pct(500, 2000), 1),
            "mid": round(band_pct(2000, 4000), 1),
            "upperMid": round(band_pct(4000, 8000), 1),
            "presence": round(band_pct(8000, 12000), 1),
            "air": round(band_pct(12000, 20000), 1),
        },
        "peakFrequencies": [round(f) for f in peaks],
    },
    "transient": {
        "attackMs": round(float(np.median(attack_times) * 1000), 1) if attack_times else 0,
        "decayMs": round(float(np.median(decay_times) * 1000), 1) if decay_times else 0,
        "hitCount": len(onset_frames),
    },
    "summary": {
        "brightness": "bright" if centroid > 8000 else "medium" if centroid > 6000 else "dark",
        "texture": "noisy" if flatness > 0.3 else "semi-metallic" if flatness > 0.1 else "tonal",
        "attack": "very-fast" if (np.median(attack_times) < 0.005 if attack_times else False) else "fast" if (np.median(attack_times) < 0.015 if attack_times else False) else "medium" if attack_times else "slow",
        "decay": "short" if (np.median(decay_times) < 0.1 if decay_times else False) else "medium" if (np.median(decay_times) < 0.3 if decay_times else False) else "long",
    }
}
print(json.dumps(result))
`

  const { stdout } = await exec(python, ['-c', script, filePath], {
    timeout: 120_000,
  })

  const lines = stdout.trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as AudioAnalysisResult
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

  await requireCmd('python3')
  return 'python3'
}
