import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertPathInside,
  buildOutputTemplate,
  isPathInside,
  validateDirectoryInput
} from '@shared/paths'

const base = path.resolve('C:/Users/Test/Downloads/Vela')

describe('path containment', () => {
  it('accepts children of the base directory', () => {
    expect(isPathInside(base, path.join(base, 'video.mp4'))).toBe(true)
    expect(isPathInside(base, path.join(base, 'sub', 'video.mp4'))).toBe(true)
  })

  it('rejects the base itself, siblings, traversal and absolute escapes', () => {
    expect(isPathInside(base, base)).toBe(false)
    expect(isPathInside(base, path.resolve(base, '..', 'secret.txt'))).toBe(false)
    expect(isPathInside(base, 'C:/Windows/System32/cmd.exe')).toBe(false)
    expect(() => assertPathInside(base, 'C:/Windows/System32/cmd.exe')).toThrow(/escaped/)
  })

  it('builds an output template that stays inside the directory', () => {
    const template = buildOutputTemplate(base, 'My Video')
    expect(template.startsWith(base)).toBe(true)
    expect(template.endsWith('.%(ext)s')).toBe(true)
  })

  it('refuses filename bases containing separators or control characters', () => {
    expect(() => buildOutputTemplate(base, '..\\evil')).toThrow()
    expect(() => buildOutputTemplate(base, 'a/b')).toThrow()
    expect(() => buildOutputTemplate(base, 'C:evil')).toThrow()
    expect(() => buildOutputTemplate(base, 'bad\u0000name')).toThrow()
  })
})

describe('validateDirectoryInput', () => {
  it('requires an absolute non-root directory', () => {
    expect(() => validateDirectoryInput('relative/folder')).toThrow()
    expect(() => validateDirectoryInput('C:\\')).toThrow()
    expect(() => validateDirectoryInput('')).toThrow()
    expect(validateDirectoryInput('C:\\Users\\Test\\Vela')).toBe(path.resolve('C:\\Users\\Test\\Vela'))
  })

  it('normalizes traversal in an otherwise absolute path', () => {
    const normalized = validateDirectoryInput('C:\\Users\\Test\\Downloads\\..\\Vela')
    expect(normalized.endsWith('Vela')).toBe(true)
    expect(normalized).not.toContain('..')
  })
})
