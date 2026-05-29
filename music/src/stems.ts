import { exec, requireCmd, which } from './exec.js'
import { mkdir } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { existsSync } from 'node:fs'

export type StemModel = 'htdemucs' | 'htdemucs_ft' | 'mdx_extra' | 'mdx_extra_q'
export type TwoStems = 'drums' | 'vocals' | 'bass' | 'other'

export interface SeparateOptions {
  input: string
  outputDir: string
  model?: StemModel
  twoStems?: TwoStems
  device?: 'cpu' | 'cuda'
  /** Python executable path (default: python3) */
  python?: string
}

export interface StemResult {
  model: string
  stems: Map<string, string>
  outputDir: string
}

/**
 * Check if demucs is available and return the python path to use.
 * Checks common venv locations and system python.
 */
export async function findDemucs(): Promise<{ python: string; available: boolean }> {
  // Check common venv locations
  const venvPaths = [
    join(process.env.HOME ?? '', 'audio-tools-venv', 'bin', 'python3'),
    join(process.env.HOME ?? '', '.venvs', 'audio', 'bin', 'python3'),
  ]

  for (const pythonPath of venvPaths) {
    if (existsSync(pythonPath)) {
      try {
        await exec(pythonPath, ['-m', 'demucs', '--help'])
        return { python: pythonPath, available: true }
      } catch {
        // demucs not installed in this venv
      }
    }
  }

  // Try system python
  const systemPython = await which('python3')
  if (systemPython) {
    try {
      await exec(systemPython, ['-m', 'demucs', '--help'])
      return { python: systemPython, available: true }
    } catch {
      // demucs not installed
    }
  }

  return { python: 'python3', available: false }
}

/**
 * Separate audio into stems using Demucs.
 * Requires demucs to be installed in a Python environment.
 *
 * Uses a custom Python script to save via soundfile instead of torchaudio
 * to avoid torchcodec compatibility issues.
 */
export async function separate(options: SeparateOptions): Promise<StemResult> {
  const {
    input,
    outputDir,
    model = 'htdemucs',
    twoStems,
    device = 'cpu',
    python,
  } = options

  const { python: resolvedPython, available } = python
    ? { python, available: true }
    : await findDemucs()

  if (!available) {
    throw new Error(
      'Demucs not found. Install it with: python3 -m pip install demucs soundfile'
    )
  }

  await mkdir(outputDir, { recursive: true })

  // Use a Python script that saves with soundfile to avoid torchcodec issues
  const script = `
import torch
import torchaudio
from demucs.pretrained import get_model
from demucs.apply import apply_model
import soundfile as sf
import os, sys, json

model = get_model('${model}')
model.eval()

wav, sr = torchaudio.load(sys.argv[1])
if sr != model.samplerate:
    wav = torchaudio.functional.resample(wav, sr, model.samplerate)
    sr = model.samplerate

wav = wav.unsqueeze(0)

with torch.no_grad():
    sources = apply_model(model, wav, device='${device}', progress=True)

outdir = sys.argv[2]
os.makedirs(outdir, exist_ok=True)
result = {}

for i, name in enumerate(model.sources):
    stem = sources[0, i].numpy().T
    outpath = os.path.join(outdir, f"{name}.wav")
    sf.write(outpath, stem, sr)
    result[name] = outpath

print(json.dumps(result))
`

  const { stdout, stderr } = await exec(
    resolvedPython,
    ['-c', script, input, outputDir],
    { timeout: 600_000 }
  )

  // Parse the JSON output from the last line
  const lines = stdout.trim().split('\n')
  const jsonLine = lines[lines.length - 1]
  const stemPaths = JSON.parse(jsonLine) as Record<string, string>

  return {
    model,
    stems: new Map(Object.entries(stemPaths)),
    outputDir,
  }
}

/**
 * Quick check of available stem separation backends
 */
export async function checkBackends(): Promise<{
  demucs: boolean
  ffmpeg: boolean
}> {
  const [demucsResult, ffmpegPath] = await Promise.all([
    findDemucs(),
    which('ffmpeg'),
  ])

  return {
    demucs: demucsResult.available,
    ffmpeg: ffmpegPath !== null,
  }
}
