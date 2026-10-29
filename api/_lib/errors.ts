import type { AiErrorCode } from '../../src/ai/types'

export class ApiError extends Error {
  status: number
  code: AiErrorCode

  constructor(status: number, code: AiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}
