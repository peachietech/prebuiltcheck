// Simple in-memory rate limiter — resets on cold starts, good enough for MVP
// Replace with Upstash Redis rate limiter when scaling

const ipHits = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60 * 1000  // 1 minute window
const MAX_REQUESTS = 5       // max scrape requests per IP per minute

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  const record = ipHits.get(ip)

  if (!record || now > record.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfter: 0 }
  }

  if (record.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  record.count++
  return { allowed: true, retryAfter: 0 }
}
