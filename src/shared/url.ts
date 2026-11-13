import { MAX_URL_LENGTH } from './constants'
import type { ErrorCode } from './errors'

export interface UrlValidationSuccess {
  ok: true
  url: URL
}

export interface UrlValidationFailure {
  ok: false
  code: Extract<ErrorCode, 'INVALID_URL' | 'UNSUPPORTED_PROTOCOL' | 'BLOCKED_HOST'>
}

export type UrlValidationResult = UrlValidationSuccess | UrlValidationFailure

const CONTROL_OR_SPACE_RE = /[\u0000-\u0020\u007f]/

export function validateUrl(raw: string): UrlValidationResult {
  if (typeof raw !== 'string') return { ok: false, code: 'INVALID_URL' }
  const value = raw.trim()
  if (!value || value.length > MAX_URL_LENGTH) return { ok: false, code: 'INVALID_URL' }
  if (CONTROL_OR_SPACE_RE.test(value)) return { ok: false, code: 'INVALID_URL' }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { ok: false, code: 'INVALID_URL' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, code: 'UNSUPPORTED_PROTOCOL' }
  }
  if (parsed.username || parsed.password) return { ok: false, code: 'INVALID_URL' }
  if (!parsed.hostname) return { ok: false, code: 'INVALID_URL' }
  if (isBlockedHostname(parsed.hostname)) return { ok: false, code: 'BLOCKED_HOST' }

  return { ok: true, url: parsed }
}

export function isBlockedHostname(hostname: string): boolean {
  let host = hostname.toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)
  host = host.replace(/\.$/, '')
  if (!host) return true

  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) return true
  if (host === 'metadata.google.internal') return true

  if (isIpv4(host)) return isPrivateIpv4(host)
  if (host.includes(':')) return isPrivateIpv6(host)

  if (!host.includes('.')) return true
  return false
}

function isIpv4(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }
  const [a = 0, b = 0] = parts
  if (a === 0) return true
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 192 && b === 0) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a === 198 && b === 51) return true
  if (a === 203 && b === 0) return true
  if (a >= 224) return true
  return false
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase()
  if (normalized === '::1' || normalized === '::') return true
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true
  }
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length)
    if (isIpv4(mapped)) return isPrivateIpv4(mapped)
  }
  return false
}

export function isSafeThumbnailUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const result = validateUrl(raw)
  return result.ok ? result.url.toString() : null
}
