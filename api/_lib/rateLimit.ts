import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { ApiError } from './errors'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

interface LimitResult {
  success: boolean
  reset: number
  remaining: number
}

const memoryBuckets = new Map<string, { count: number; reset: number }>()

const memoryLimit = (key: string, limit: number, windowMs: number): LimitResult => {
  const now = Date.now()
  if (memoryBuckets.size > 5000) {
    for (const [bucketKey, bucket] of memoryBuckets) {
      if (bucket.reset <= now) memoryBuckets.delete(bucketKey)
    }
    if (memoryBuckets.size > 5000) {
      for (const bucketKey of memoryBuckets.keys()) {
        memoryBuckets.delete(bucketKey)
        if (memoryBuckets.size <= 4000) break
      }
    }
  }
  const current = memoryBuckets.get(key)
  if (!current || current.reset <= now) {
    const next = { count: 1, reset: now + windowMs }
    memoryBuckets.set(key, next)
    return { success: true, reset: next.reset, remaining: limit - 1 }
  }
  current.count += 1
  return {
    success: current.count <= limit,
    reset: current.reset,
    remaining: Math.max(0, limit - current.count),
  }
}

let redisLimiters:
  | {
      hour: Ratelimit
      day: Ratelimit
      global: Ratelimit
    }
  | undefined

const upstashLimiters = () => {
  if (redisLimiters) return redisLimiters
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return undefined
  const redis = new Redis({ url, token })
  redisLimiters = {
    hour: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      prefix: 'kepkat:ai:hour',
      analytics: false,
    }),
    day: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '1 d'),
      prefix: 'kepkat:ai:day',
      analytics: false,
    }),
    global: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(400, '1 d'),
      prefix: 'kepkat:ai:global',
      analytics: false,
    }),
  }
  return redisLimiters
}

const combine = (results: LimitResult[]): LimitResult => ({
  success: results.every((item) => item.success),
  reset: Math.max(...results.map((item) => item.reset)),
  remaining: Math.min(...results.map((item) => item.remaining)),
})

export const consumeRateLimit = async (ip: string): Promise<LimitResult> => {
  const identifier = ip.slice(0, 120) || 'unknown'
  const limiters = upstashLimiters()
  if (!limiters) {
    return combine([
      memoryLimit(`hour:${identifier}`, 10, HOUR_MS),
      memoryLimit(`day:${identifier}`, 50, DAY_MS),
      memoryLimit('global', 400, DAY_MS),
    ])
  }

  try {
    const [hour, day, global] = await Promise.all([
      limiters.hour.limit(identifier),
      limiters.day.limit(identifier),
      limiters.global.limit('global'),
    ])
    return combine([
      { success: hour.success, reset: hour.reset, remaining: hour.remaining },
      { success: day.success, reset: day.reset, remaining: day.remaining },
      { success: global.success, reset: global.reset, remaining: global.remaining },
    ])
  } catch (reason) {
    console.error('Upstash rate limit failed', reason)
    throw new ApiError(503, 'service_unavailable', 'The rate limiter is unavailable.')
  }
}
