const INVALID_FILENAME_CHARS = /[<>:"/\\|?*%]/g
const CONTROL_AND_BIDI = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g
const WHITESPACE = /\s+/g
const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export interface FilenameVars {
  title?: string | null
  id?: string | null
  uploader?: string | null
  date?: string | null
  resolution?: string | null
}

export function sanitizeFilename(input: string, maxLength = 110): string {
  if (typeof input !== 'string') return 'video'

  let value = input.normalize('NFKC')
  value = value.replace(CONTROL_AND_BIDI, '')
  value = value.replace(INVALID_FILENAME_CHARS, '_')
  value = value.replace(WHITESPACE, ' ')
  value = value.replace(/^[\s._-]+/, '').replace(/[\s._-]+$/, '')
  value = value.replace(/_+/g, '_')

  const codePoints = Array.from(value)
  if (codePoints.length > maxLength) {
    value = codePoints.slice(0, maxLength).join('')
    value = value.replace(/[\s._-]+$/, '')
  }

  if (RESERVED_NAME.test(value)) value = `_${value}`
  if (!value) return 'video'
  return value
}

export function renderFilename(template: string, vars: FilenameVars, maxLength = 110): string {
  const safeTemplate = typeof template === 'string' && template.trim() ? template : '{title}'
  const replacements: Record<string, string> = {
    title: vars.title ?? '',
    id: vars.id ?? '',
    uploader: vars.uploader ?? '',
    date: vars.date ?? '',
    resolution: vars.resolution ?? ''
  }

  const rendered = safeTemplate.replace(/\{([a-zA-Z]+)\}/g, (_match, key: string) => {
    return Object.prototype.hasOwnProperty.call(replacements, key) ? replacements[key] ?? '' : ''
  })

  const fallback = sanitizeFilename(String(vars.title ?? ''), maxLength)
  const sanitized = sanitizeFilename(rendered, maxLength)
  if (sanitized === 'video' && fallback !== 'video') return fallback
  return sanitized
}

export function isValidFilenameTemplate(template: string): boolean {
  if (typeof template !== 'string') return false
  if (template.length < 1 || template.length > 100) return false
  if (/[<>:"/\\|?*%\u0000-\u001f]/.test(template)) return false
  return true
}

export function isValidSubtitleLangs(langs: string): boolean {
  if (typeof langs !== 'string' || langs.length < 1 || langs.length > 100) return false
  return /^[A-Za-z0-9_-]{1,20}(?:,[A-Za-z0-9_-]{1,20})*$/.test(langs)
}
