import type { PublicError } from '@shared/errors'
import type { ApiResult } from '@shared/types'

export class ApiClientError extends Error {
  readonly code: PublicError['code']
  readonly detail?: string

  constructor(error: PublicError) {
    super(error.detail ? `${error.code}: ${error.detail}` : error.code)
    this.name = 'ApiClientError'
    this.code = error.code
    this.detail = error.detail
  }
}

export async function unwrap<T>(promise: Promise<ApiResult<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) throw new ApiClientError(result.error)
  return result.data
}

export function asPublicError(error: unknown): PublicError {
  if (error instanceof ApiClientError) {
    return error.detail ? { code: error.code, detail: error.detail } : { code: error.code }
  }
  if (error instanceof Error) {
    return { code: 'UNKNOWN', detail: error.message.slice(0, 400) }
  }
  return { code: 'UNKNOWN' }
}
