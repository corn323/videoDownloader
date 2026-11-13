import path from 'node:path'
import { AppError } from './errors'

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

export function validateDirectoryInput(dir: string): string {
  if (typeof dir !== 'string' || !dir.trim() || dir.length > 1024) {
    throw new AppError('OUTPUT_PATH_INVALID', 'directory input is empty or too long')
  }
  if (CONTROL_CHARS.test(dir)) {
    throw new AppError('OUTPUT_PATH_INVALID', 'directory contains control characters')
  }
  if (!path.isAbsolute(dir)) {
    throw new AppError('OUTPUT_PATH_INVALID', 'directory must be absolute')
  }
  const resolved = path.resolve(dir)
  if (resolved === path.parse(resolved).root) {
    throw new AppError('OUTPUT_PATH_INVALID', 'refusing to use a drive root as output directory')
  }
  if (resolved.split(path.sep).includes('..')) {
    throw new AppError('OUTPUT_PATH_INVALID', 'directory must not contain parent traversal')
  }
  return resolved
}

export function isPathInside(baseDir: string, candidate: string): boolean {
  const base = path.resolve(baseDir)
  const target = path.resolve(candidate)
  const relative = path.relative(base, target)
  if (!relative) return false
  if (path.isAbsolute(relative)) return false
  return relative !== '..' && !relative.startsWith(`..${path.sep}`)
}

export function assertPathInside(baseDir: string, candidate: string): string {
  const target = path.resolve(candidate)
  if (!isPathInside(baseDir, target)) {
    throw new AppError('OUTPUT_PATH_INVALID', 'resolved output path escaped the download directory')
  }
  return target
}

export function buildOutputTemplate(outputDir: string, baseName: string): string {
  if (!baseName || CONTROL_CHARS.test(baseName)) {
    throw new AppError('OUTPUT_PATH_INVALID', 'invalid filename base')
  }
  if (baseName.includes('/') || baseName.includes('\\') || baseName.includes(':')) {
    throw new AppError('OUTPUT_PATH_INVALID', 'filename base contains a path separator')
  }
  const template = path.join(outputDir, `${baseName}.%(ext)s`)
  assertPathInside(outputDir, template)
  return template
}

export function assertSafeFilePath(candidate: string): string {
  if (typeof candidate !== 'string' || !candidate || candidate.length > 4096) {
    throw new AppError('OUTPUT_PATH_INVALID', 'invalid file path')
  }
  if (CONTROL_CHARS.test(candidate)) {
    throw new AppError('OUTPUT_PATH_INVALID', 'file path contains control characters')
  }
  if (!path.isAbsolute(candidate)) {
    throw new AppError('OUTPUT_PATH_INVALID', 'file path must be absolute')
  }
  return path.resolve(candidate)
}
