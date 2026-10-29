import type { ApiRequest, ApiResponse } from '../_lib/types'
import { aiChatRequestSchema } from '../../src/ai/schema'
import { requestAgent } from '../_lib/nvidia'
import { consumeRateLimit } from '../_lib/rateLimit'
import { verifyTurnstile } from '../_lib/turnstile'
import { ApiError } from '../_lib/errors'

export const config = {
  maxDuration: 60,
}

const MAX_BODY_BYTES = 450_000

const header = (req: ApiRequest, name: string): string | undefined => {
  const value = req.headers[name]
  if (Array.isArray(value)) return value[0]
  return value
}

const clientIp = (req: ApiRequest): string => {
  const realIp = header(req, 'x-real-ip')?.trim()
  if (realIp) return realIp
  const forwarded = header(req, 'x-forwarded-for')
  const candidate = forwarded?.split(',')[0]?.trim()
  return candidate || req.socket.remoteAddress || 'unknown'
}

const assertAllowedOrigin = (req: ApiRequest): void => {
  const origin = header(req, 'origin')
  if (!origin) return
  const configured = (process.env.AI_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (configured.includes(origin)) return

  const host = header(req, 'x-forwarded-host') || header(req, 'host')
  try {
    if (host && new URL(origin).host === host) return
  } catch {
    throw new ApiError(403, 'forbidden', 'The request origin is not allowed.')
  }

  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return
  throw new ApiError(403, 'forbidden', 'The request origin is not allowed.')
}

const parseBody = (req: ApiRequest): unknown => {
  const raw = req.body
  if (raw === undefined || raw === null) {
    throw new ApiError(400, 'invalid_request', 'The request body is missing.')
  }
  if (typeof raw === 'string') {
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      throw new ApiError(413, 'payload_too_large', 'The request body is too large.')
    }
    try {
      return JSON.parse(raw)
    } catch {
      throw new ApiError(400, 'invalid_request', 'The request body is not valid JSON.')
    }
  }
  const encoded = JSON.stringify(raw)
  if (Buffer.byteLength(encoded) > MAX_BODY_BYTES) {
    throw new ApiError(413, 'payload_too_large', 'The request body is too large.')
  }
  return raw
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    res.status(405).json({ error: 'Method not allowed.', code: 'invalid_request' })
    return
  }

  try {
    assertAllowedOrigin(req)
    const parsed = aiChatRequestSchema.safeParse(parseBody(req))
    if (!parsed.success) {
      throw new ApiError(400, 'invalid_request', 'The request did not match the expected format.')
    }

    const ip = clientIp(req)
    const limited = await consumeRateLimit(ip)
    res.setHeader('X-RateLimit-Remaining', String(limited.remaining))
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(limited.reset / 1000)))
    if (!limited.success) {
      const retryAfter = Math.max(1, Math.ceil((limited.reset - Date.now()) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      throw new ApiError(429, 'rate_limited', 'Too many AI requests. Try again later.')
    }

    await verifyTurnstile(parsed.data.turnstileToken, ip)
    const result = await requestAgent(parsed.data.mode, parsed.data.messages, parsed.data.snapshot)
    res.status(200).json(result)
  } catch (reason) {
    if (reason instanceof ApiError) {
      res.status(reason.status).json({ error: reason.message, code: reason.code })
      return
    }
    console.error('AI chat failed', reason)
    res.status(500).json({ error: 'The AI request failed.', code: 'unknown' })
  }
}
