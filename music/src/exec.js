import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
export async function exec(cmd, args, options) {
    return execFileAsync(cmd, args, {
        timeout: options?.timeout ?? 300_000,
        maxBuffer: options?.maxBuffer ?? 50 * 1024 * 1024,
    });
}
export async function which(cmd) {
    try {
        const { stdout } = await exec('which', [cmd]);
        return stdout.trim() || null;
    }
    catch {
        return null;
    }
}
export async function requireCmd(cmd) {
    const path = await which(cmd);
    if (!path)
        throw new Error(`Required command not found: ${cmd}`);
    return path;
}
