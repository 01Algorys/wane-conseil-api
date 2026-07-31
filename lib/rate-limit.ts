// In-memory sliding-window limiter. Deliberately simple: this Railway app
// runs as a single container today, so per-process state is sufficient. If it
// ever scales to multiple instances, this needs to move to Redis/Upstash —
// each instance would otherwise enforce its own independent limit.
const buckets = new Map<string, number[]>()

export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  timestamps.push(now)
  buckets.set(key, timestamps)
  return timestamps.length > maxRequests
}

export function clientIpFromRequest(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}
