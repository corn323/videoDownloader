import { MAX_BATCH_SIZE } from './constants'
import { validateUrl } from './url'

export interface BatchParseResult {
  links: string[]
  validCount: number
  duplicateCount: number
  firstInvalidLine: number | null
  tooMany: boolean
}

export function parseBatchUrls(input: string): BatchParseResult {
  const lines = String(input ?? '').split(/\r?\n/)
  const links: string[] = []
  const seen = new Set<string>()
  let duplicateCount = 0
  let firstInvalidLine: number | null = null

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]?.trim() ?? ''
    if (!raw) continue
    const result = validateUrl(raw)
    if (!result.ok) {
      if (firstInvalidLine === null) firstInvalidLine = i + 1
      continue
    }
    const normalized = result.url.toString()
    if (seen.has(normalized)) {
      duplicateCount += 1
      continue
    }
    seen.add(normalized)
    links.push(normalized)
  }

  return {
    links,
    validCount: links.length,
    duplicateCount,
    firstInvalidLine,
    tooMany: links.length > MAX_BATCH_SIZE
  }
}
