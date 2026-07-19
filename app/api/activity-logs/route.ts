import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

const PAGE_SIZE = 30

export async function GET(req: Request) {
  const token = await getActor(req)
  if (!token || token.kind !== 'user' || token.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const userId = searchParams.get('userId')
  const action = searchParams.get('action')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const where: Prisma.ActivityLogWhereInput = {
    AND: [
      userId ? { userId } : {},
      action ? { action } : {},
      dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(new Date(dateTo).getTime() + 86400000) } : {}),
            },
          }
        : {},
    ],
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, pageSize: PAGE_SIZE })
}
