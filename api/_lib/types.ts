import type { IncomingMessage, ServerResponse } from 'node:http'

export type ApiRequest = IncomingMessage & {
  body?: unknown
}

export type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse
  json: (value: unknown) => void
}
