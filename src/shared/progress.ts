export interface ParsedProgress {
  percent: number | null
  downloadedBytes: number | null
  totalBytes: number | null
  speed: number | null
  eta: number | null
}

const PROGRESS_PREFIX = '@@PROGRESS@@'

function toNumber(value: string | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim().replace(/%$/, '')
  if (!trimmed || trimmed === 'NA' || trimmed === 'None' || trimmed === 'N/A') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseProgressLine(line: string): ParsedProgress | null {
  const index = line.indexOf(PROGRESS_PREFIX)
  if (index === -1) return null
  const payload = line.slice(index + PROGRESS_PREFIX.length)
  const fields = payload.split('|')
  const downloadedBytes = toNumber(fields[0])
  const totalBytes = toNumber(fields[1]) ?? toNumber(fields[2])
  const speed = toNumber(fields[3])
  const eta = toNumber(fields[4])
  const rawPercent = toNumber(fields[5])

  let percent = rawPercent
  if (percent === null && downloadedBytes !== null && totalBytes !== null && totalBytes > 0) {
    percent = (downloadedBytes / totalBytes) * 100
  }
  if (percent !== null) percent = Math.max(0, Math.min(100, percent))

  return { percent, downloadedBytes, totalBytes, speed, eta }
}

export function parseMarkedValue(line: string, marker: string): string | null {
  const index = line.indexOf(marker)
  if (index === -1) return null
  const value = line.slice(index + marker.length).trim()
  return value || null
}

export function stripAnsi(input: string): string {
  return input.replace(/\u001b\[[0-9;]*m/g, '')
}
