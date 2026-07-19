import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { Prisma, EmailStatus } from '@prisma/client'

const PAGE_SIZE = 25

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || token.kind !== 'user' || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

export async function GET(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const search = searchParams.get('q')?.trim()
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const where: Prisma.EmailLogWhereInput = {
    AND: [
      search
        ? {
            OR: [
              { recipient: { contains: search, mode: 'insensitive' } },
              { subject: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
      status ? { status: status as EmailStatus } : {},
      type ? { type } : {},
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

  const [emails, total, statusCounts] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        recipient: true,
        subject: true,
        type: true,
        status: true,
        error: true,
        sentAt: true,
        createdAt: true,
      },
    }),
    prisma.emailLog.count({ where }),
    prisma.emailLog.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  return NextResponse.json({ emails, total, page, pageSize: PAGE_SIZE, statusCounts })
}
