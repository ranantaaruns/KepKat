import { ApiError } from './errors.js'

interface TurnstileResponse {
  success?: boolean
  'error-codes'?: string[]
}

export const verifyTurnstile = async (
  token: string | undefined,
  remoteIp: string,
): Promise<void> => {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) return
  if (!token) {
    throw new ApiError(400, 'turnstile', 'Complete the verification challenge first.')
  }

  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: remoteIp,
  })

  let response: Response
  try {
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new ApiError(503, 'service_unavailable', 'The verification service is unavailable.')
  }

  if (!response.ok) {
    throw new ApiError(503, 'service_unavailable', 'The verification service is unavailable.')
  }

  const result = (await response.json().catch(() => ({}))) as TurnstileResponse
  if (!result.success) {
    console.warn('Turnstile rejected a request', result['error-codes'])
    throw new ApiError(400, 'turnstile', 'The verification challenge was not accepted.')
  }
}
