import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function exec(
  cmd: string,
  args: string[],
  options?: { timeout?: number; maxBuffer?: number }
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(cmd, args, {
    timeout: options?.timeout ?? 300_000,
    maxBuffer: options?.maxBuffer ?? 50 * 1024 * 1024,
  })
}

/**
 * Execute a command and return stdout as a Buffer (for binary data like raw PCM).
 * Node's execFile with encoding:'buffer' returns Buffer but TS types don't reflect this.
 */
export function execBuffer(
  cmd: string,
  args: string[],
  options?: { maxBuffer?: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      {
        maxBuffer: options?.maxBuffer ?? 500 * 1024 * 1024,
        encoding: 'buffer' as BufferEncoding,
      },
      (error, stdout: string | Buffer) => {
        if (error) {
          reject(error)
          return
        }
        // encoding: 'buffer' makes stdout a Buffer at runtime despite TS typing it as string
        resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout))
      }
    )
  })
}

export async function which(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await exec('which', [cmd])
    return stdout.trim() || null
  } catch {
    return null
  }
}

export async function requireCmd(cmd: string): Promise<string> {
  const path = await which(cmd)
  if (!path) throw new Error(`Required command not found: ${cmd}`)
  return path
}
