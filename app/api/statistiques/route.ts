import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const [leadStats, contratStats, taskStats, clientsCount, totalPrime] = await Promise.all([
    prisma.lead.groupBy({ by: ['statut'], _count: { _all: true } }),
    prisma.contrat.groupBy({ by: ['statut'], _count: { _all: true } }),
    prisma.task.groupBy({ by: ['statut'], _count: { _all: true } }),
    prisma.client.count(),
    prisma.contrat.aggregate({ _sum: { prime: true }, where: { statut: 'ACTIF' } }),
  ])

  return NextResponse.json({
    leadStats,
    contratStats,
    taskStats,
    clientsCount,
    totalPrimeActive: totalPrime._sum.prime ?? 0,
  })
}
