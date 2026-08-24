#!/usr/bin/env tsx
/**
 * Downloads required ONNX models for @barry/music.
 * Runs automatically via postinstall, or manually: pnpm run download-models
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, createWriteStream, readFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { get } from 'node:https'
import { IncomingMessage } from 'node:http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const modelsDir = join(__dirname, '..', 'models')

interface ModelSpec {
  name: string
  filename: string
  url: string
  sizeMB: number
  /** sha256 of the expected file. Third-party mirrors can change bytes; this pins them. */
  sha256: string
}

const MODELS: ModelSpec[] = [
  {
    name: 'basic-pitch',
    filename: 'basic-pitch-nmp.onnx',
    url: 'https://huggingface.co/daserge/basic-pitch-onnx/resolve/main/nmp.onnx',
    sizeMB: 0.2,
    sha256: '2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec',
  },
  {
    name: 'htdemucs',
    filename: 'htdemucs.onnx',
    url: 'https://huggingface.co/MrCitron/demucs-v4-onnx/resolve/main/htdemucs.onnx',
    sizeMB: 303,
    sha256: '7ed6e26883845a16a6d170069a4ff99b8410c2a64d0a2570ed0eb852eea234a2',
  },
]

async function downloadFile(url: string, dest: string, sizeMB: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (url: string) => {
      get(url, (res: IncomingMessage) => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location
          if (location) return follow(location)
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} downloading ${url}`))
          return
        }

        const total = parseInt(res.headers['content-length'] || '0', 10)
        let downloaded = 0
        let lastPercent = 0

        const file = createWriteStream(dest)
        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          const percent = total > 0 ? Math.floor(downloaded / total * 100) : 0
          if (percent >= lastPercent + 10) {
            process.stdout.write(`\r  ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)}/${sizeMB} MB)`)
            lastPercent = percent
          }
        })
        res.pipe(file)
        file.on('finish', () => {
          file.close()
          process.stdout.write('\r  100% — done\n')
          resolve()
        })
        file.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

/**
 * sha256 of a file on disk.
 *
 * The models come from community mirrors — the original Spotify URL for
 * basic-pitch went dead and its HuggingFace repo now holds only a README — so
 * the bytes are pinned rather than trusted. The basic-pitch hash was confirmed
 * identical across two independent mirrors before being pinned here.
 */
function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

async function main() {
  mkdirSync(modelsDir, { recursive: true })

  // Present AND intact — an existence-only check let a corrupted or
  // mirror-substituted file short-circuit verification entirely.
  let allPresent = true
  for (const model of MODELS) {
    const dest = join(modelsDir, model.filename)
    if (!existsSync(dest) || sha256File(dest) !== model.sha256) {
      allPresent = false
      break
    }
  }

  if (allPresent) {
    console.log('@barry/music: all models present')
    return
  }

  console.log('@barry/music: downloading required ONNX models...')

  for (const model of MODELS) {
    const dest = join(modelsDir, model.filename)
    if (existsSync(dest)) {
      const have = sha256File(dest)
      if (have === model.sha256) {
        console.log(`  ${model.name} (${model.filename}) — already downloaded`)
        continue
      }
      console.error(`  ${model.name}: checksum mismatch on disk, re-downloading`)
      console.error(`    expected ${model.sha256}`)
      console.error(`    found    ${have}`)
      unlinkSync(dest)
    }

    console.log(`  ${model.name} (${model.sizeMB} MB)...`)
    try {
      await downloadFile(model.url, dest, model.sizeMB)
      const got = sha256File(dest)
      if (got !== model.sha256) {
        unlinkSync(dest)
        throw new Error(
          `checksum mismatch (expected ${model.sha256}, got ${got}) — the mirror served different bytes`,
        )
      }
    } catch (err) {
      console.error(`  Failed to download ${model.name}: ${(err as Error).message}`)
      console.error(`    Manual download: curl -L -o ${dest} ${model.url}`)
      // Don't fail the install — models can be downloaded later
    }
  }
}

main().catch(console.error)
