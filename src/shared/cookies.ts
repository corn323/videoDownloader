const MAX_LINES = 20000

export function isNetscapeCookiesFile(text: string): boolean {
  if (typeof text !== 'string') return false
  if (!text.trim() || text.includes('\u0000')) return false
  const lines = text.split(/\r?\n/)
  if (lines.length > MAX_LINES) return false

  let cookieLines = 0
  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line.trim()) continue
    if (line.startsWith('#HttpOnly_')) {
      if (line.split('\t').length !== 7) return false
      cookieLines += 1
      continue
    }
    if (line.startsWith('#')) continue
    if (line.split('\t').length !== 7) return false
    cookieLines += 1
  }
  return cookieLines > 0
}
