import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'

// Prisma has no clean "group by day" aggregation, so this fetches the raw rows
// for the window (createdAt + status only, cheap) and buckets them in memory —
// same approach as the Stripe payments analytics endpoint.
export async function GET(req: Request) {
  const token = await getActor(req)
  if (!token || token.kind !== 'user' || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const daysParam = Number(searchParams.get('days') ?? '14')
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 90) : 14

  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)

  const [rows, todayCount, monthCount] = await Promise.all([
    prisma.emailLog.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, status: true } }),
    prisma.emailLog.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.emailLog.count({ where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
  ])

  const byDay = new Map<string, { sent: number; failed: number }>()
  for (let i = 0; i < days; i += 1) {
    const d = new Date(since)
    d.setDate(d.getDate() + i)
    byDay.set(d.toISOString().slice(0, 10), { sent: 0, failed: 0 })
  }
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10)
    const bucket = byDay.get(key)
    if (!bucket) continue
    if (row.status === 'FAILED') bucket.failed += 1
    else bucket.sent += 1
  }

  return NextResponse.json({
    todayCount,
    monthCount,
    trend: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })),
  })
}
