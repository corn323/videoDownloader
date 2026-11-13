import { spawn } from 'node:child_process'
import type { ErrorCode } from '@shared/errors'
import { AppError, sanitizeDetail } from '@shared/errors'
import { stripAnsi } from '@shared/progress'

export interface RunProcessOptions {
  timeoutMs?: number
  maxBufferBytes?: number
  captureStdout?: boolean
  signal?: AbortSignal
  cwd?: string
  env?: NodeJS.ProcessEnv
  missingCode?: ErrorCode
  onStdoutLine?: (line: string) => void
  onStderrLine?: (line: string) => void
}

export interface RunProcessResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  aborted: boolean
  overflow: boolean
}

export function killProcessTree(pid: number | undefined): void {
  if (!pid) return
  try {
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        windowsHide: true,
        shell: false,
        stdio: 'ignore'
      })
      killer.on('error', () => undefined)
    } else {
      process.kill(pid, 'SIGKILL')
    }
  } catch {
    // Process may already be gone.
  }
}

export function runProcess(exe: string, args: string[], options: RunProcessOptions = {}): Promise<RunProcessResult> {
  return new Promise((resolve, reject) => {
    const maxBuffer = options.maxBufferBytes ?? 8 * 1024 * 1024
    const captureStdout = options.captureStdout ?? true
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(exe, args, {
        windowsHide: true,
        shell: false,
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (error) {
      reject(new AppError(options.missingCode ?? 'UNKNOWN', `failed to spawn process: ${String(error)}`))
      return
    }

    let stdout = ''
    let stderr = ''
    let stdoutBytes: Buffer = Buffer.alloc(0)
    let stderrBytes: Buffer = Buffer.alloc(0)
    const stdoutDecoder = new TextDecoder('utf-8')
    const stderrDecoder = new TextDecoder('utf-8')
    let timedOut = false
    let aborted = false
    let overflow = false
    let settled = false
    let timer: NodeJS.Timeout | null = null

    const cleanup = (): void => {
      if (timer) clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
    }

    const flushLines = (source: 'stdout' | 'stderr', final = false): void => {
      const decoder = source === 'stdout' ? stdoutDecoder : stderrDecoder
      let buffer = source === 'stdout' ? stdoutBytes : stderrBytes
      if (buffer.length === 0 && !final) return
      const decoded = decoder.decode(buffer, { stream: !final })
      const split = splitLines(decoded)
      for (const line of split.lines) {
        const clean = stripAnsi(line)
        if (source === 'stdout') options.onStdoutLine?.(clean)
        else options.onStderrLine?.(clean)
      }
      const rest = split.rest
      buffer = rest ? Buffer.from(rest, 'utf8') : Buffer.alloc(0)
      if (source === 'stdout') stdoutBytes = buffer
      else stderrBytes = buffer
    }

    const finish = (code: number | null, error?: Error): void => {
      if (settled) return
      settled = true
      cleanup()
      flushLines('stdout', true)
      flushLines('stderr', true)
      if (error) {
        reject(error)
        return
      }
      resolve({ code, stdout, stderr, timedOut, aborted, overflow })
    }

    function onAbort(): void {
      aborted = true
      killProcessTree(child.pid)
    }

    if (options.signal) {
      if (options.signal.aborted) {
        onAbort()
      } else {
        options.signal.addEventListener('abort', onAbort, { once: true })
      }
    }

    if (options.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true
        killProcessTree(child.pid)
      }, options.timeoutMs)
    }

    child.on('error', (error: NodeJS.ErrnoException) => {
      const code = error.code === 'ENOENT' ? options.missingCode ?? 'UNKNOWN' : options.missingCode ?? 'UNKNOWN'
      finish(null, new AppError(code, sanitizeDetail(error.message)))
    })

    child.stdout?.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      const text = buf.toString('utf8')
      if (captureStdout) stdout = appendCapped(stdout, text, maxBuffer)
      stdoutBytes = Buffer.concat([stdoutBytes, buf])
      if (stdout.length + stderr.length > maxBuffer) {
        overflow = true
        killProcessTree(child.pid)
      }
      flushLines('stdout')
      if (stdoutBytes.length > 1024 * 1024) stdoutBytes = stdoutBytes.subarray(-512 * 1024)
    })

    child.stderr?.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      const text = buf.toString('utf8')
      stderr = appendCapped(stderr, text, Math.min(maxBuffer, 256 * 1024))
      stderrBytes = Buffer.concat([stderrBytes, buf])
      if (stderrBytes.length > 1024 * 1024) stderrBytes = stderrBytes.subarray(-512 * 1024)
      flushLines('stderr')
    })

    child.on('close', (code) => {
      finish(code)
    })
  })
}

function appendCapped(current: string, chunk: string, cap: number): string {
  if (current.length >= cap) return current
  const next = current + chunk
  return next.length > cap ? next.slice(0, cap) : next
}

function splitLines(buffer: string): { lines: string[]; rest: string } {
  const lines = buffer.split(/\r?\n/)
  const rest = lines.pop() ?? ''
  return { lines, rest }
}
