import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runProcess } from '../src/main/services/process'
import { parseMarkedValue } from '@shared/progress'

function nodeExe(): string {
  return process.execPath
}

describe('UTF-8 subprocess output and path parsing', () => {
  it('decodes UTF-8 Chinese title lines even when multi-byte chars are split across chunks', async () => {
    const title = '繁體中文測試影片 - 玉米、婕報機器人'
    const script = `
      const s = 'before\\n@@TITLE@@${title}\\n';
      const b = Buffer.from(s, 'utf8');
      process.stdout.write(b.subarray(0, 14));
      setTimeout(() => process.stdout.write(b.subarray(14)), 10);
    `
    const lines: string[] = []
    const result = await runProcess(nodeExe(), ['-e', script], {
      captureStdout: false,
      onStdoutLine: (line) => lines.push(line)
    })
    expect(result.code).toBe(0)
    const titleLine = lines.find((l) => l.includes('@@TITLE@@')) ?? ''
    expect(parseMarkedValue(titleLine, '@@TITLE@@')).toBe(title)
  })

  it('parses @@FILE@@ Unicode path and fs.existsSync finds the file', async () => {
    const dir = path.join(os.tmpdir(), `vela-utf8-${Date.now()}-測試下載`)
    const file = path.join(dir, '繁體中文測試影片.mp4')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, 'x')
    try {
      const script = `process.stdout.write('@@FILE@@' + ${JSON.stringify(file)} + '\\n')`
      let seen: string | null = null
      const result = await runProcess(nodeExe(), ['-e', script], {
        captureStdout: false,
        onStdoutLine: (line) => {
          const parsed = parseMarkedValue(line, '@@FILE@@')
          if (parsed) seen = parsed
        }
      })
      expect(result.code).toBe(0)
      expect(seen).toBe(file)
      if (seen === null) throw new Error('missing @@FILE@@')
      expect(fs.existsSync(seen)).toBe(true)
      expect(path.basename(seen)).toBe('繁體中文測試影片.mp4')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('keeps English, numbers and symbols unchanged', async () => {
    const line = '@@FILE@@C:/Videos/Test_video-01 (final).mp4'
    expect(parseMarkedValue(line, '@@FILE@@')).toBe('C:/Videos/Test_video-01 (final).mp4')
  })
})
