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
