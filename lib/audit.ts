import { prisma } from './prisma'

export function requestIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip')
}

export async function logActivity(opts: { userId: string; action: string; details?: string; req?: Request }): Promise<void> {
  try {
    const ip = opts.req ? requestIp(opts.req) : null
    await prisma.activityLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        details: [opts.details, ip ? `IP: ${ip}` : null].filter(Boolean).join(' — ') || null,
      },
    })
  } catch (err) {
    console.error('[audit] failed to log activity', err)
  }
}
