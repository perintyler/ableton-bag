#!/usr/bin/env tsx
/**
 * Downloads required ONNX models for @barry/music.
 * Runs automatically via postinstall, or manually: pnpm run download-models
 */

import { existsSync, mkdirSync, createWriteStream } from 'node:fs'
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
}

const MODELS: ModelSpec[] = [
  {
    name: 'basic-pitch',
    filename: 'basic-pitch-nmp.onnx',
    url: 'https://huggingface.co/spotify/basic-pitch/resolve/main/saved_models/icassp_2022/nmp.onnx',
    sizeMB: 0.2,
  },
  {
    name: 'htdemucs',
    filename: 'htdemucs.onnx',
    url: 'https://huggingface.co/MrCitron/demucs-v4-onnx/resolve/main/htdemucs.onnx',
    sizeMB: 303,
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

async function main() {
  mkdirSync(modelsDir, { recursive: true })

  let allPresent = true
  for (const model of MODELS) {
    const dest = join(modelsDir, model.filename)
    if (!existsSync(dest)) {
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
      console.log(`  ${model.name} (${model.filename}) — already downloaded`)
      continue
    }

    console.log(`  ${model.name} (${model.sizeMB} MB)...`)
    try {
      await downloadFile(model.url, dest, model.sizeMB)
    } catch (err) {
      console.error(`  Failed to download ${model.name}: ${(err as Error).message}`)
      console.error(`    Manual download: curl -L -o ${dest} ${model.url}`)
      // Don't fail the install — models can be downloaded later
    }
  }
}

main().catch(console.error)
