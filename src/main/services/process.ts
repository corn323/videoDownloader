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
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (error) {
      reject(new AppError(options.missingCode ?? 'UNKNOWN', `failed to spawn process: ${String(error)}`))
      return
    }

    let stdout = ''
    let stderr = ''
    let stdoutRest = ''
    let stderrRest = ''
    let timedOut = false
    let aborted = false
    let overflow = false
    let settled = false
    let timer: NodeJS.Timeout | null = null

    const cleanup = (): void => {
      if (timer) clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
    }

    const finish = (code: number | null, error?: Error): void => {
      if (settled) return
      settled = true
      cleanup()
      if (stdoutRest) options.onStdoutLine?.(stripAnsi(stdoutRest))
      if (stderrRest) options.onStderrLine?.(stripAnsi(stderrRest))
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

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      if (captureStdout) stdout = appendCapped(stdout, chunk, maxBuffer)
      stdoutRest += chunk
      if (stdout.length + stderr.length > maxBuffer) {
        overflow = true
        killProcessTree(child.pid)
      }
      const split = splitLines(stdoutRest)
      stdoutRest = split.rest
      for (const line of split.lines) options.onStdoutLine?.(stripAnsi(line))
    })

    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      stderr = appendCapped(stderr, chunk, Math.min(maxBuffer, 256 * 1024))
      stderrRest += chunk
      if (stderrRest.length > 1024 * 1024) stderrRest = stderrRest.slice(-512 * 1024)
      const split = splitLines(stderrRest)
      stderrRest = split.rest
      for (const line of split.lines) options.onStderrLine?.(stripAnsi(line))
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
