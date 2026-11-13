export function parseChecksumFile(text: string, fileName: string): string | null {
  if (typeof text !== 'string' || typeof fileName !== 'string') return null
  const wanted = fileName.toLowerCase()
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const gnu = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/i.exec(line)
    if (gnu) {
      const [, hash, name] = gnu
      if (hash && name && baseName(name) === wanted) return hash.toLowerCase()
      continue
    }

    const bsd = /^SHA256\s*\((.+?)\)\s*=\s*([0-9a-f]{64})\s*$/i.exec(line)
    if (bsd) {
      const [, name, hash] = bsd
      if (hash && name && baseName(name) === wanted) return hash.toLowerCase()
    }
  }
  return null
}

function baseName(value: string): string {
  const parts = value.replace(/\\/g, '/').split('/')
  return (parts.at(-1) ?? '').trim().toLowerCase()
}

export function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value)
}
