import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const gridStart = new Date(searchParams.get('gridStart') as string)
  const gridEnd = new Date(searchParams.get('gridEnd') as string)
  const now = new Date()

  const [rdvMonth, prochains] = await Promise.all([
    prisma.rendezVous.findMany({
      where: { dateDebut: { gte: gridStart, lte: gridEnd } },
      include: { client: true, contrat: true },
      orderBy: { dateDebut: 'asc' },
    }),
    prisma.rendezVous.findMany({
      where: { dateDebut: { gte: now }, statut: { notIn: ['ANNULE'] } },
      include: { client: true },
      orderBy: { dateDebut: 'asc' },
      take: 5,
    }),
  ])

  return NextResponse.json({ rdvMonth, prochains })
}
