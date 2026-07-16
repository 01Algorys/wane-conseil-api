import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'

// §2.1 Notifications (tâches en retard, documents manquants, contrats à échéance)
export async function GET(req: Request) {
  const token = await getActor(req)
  if (token?.kind !== 'user') return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)

  const [tachesEnRetard, documentsManquants, contratsEcheance, rdvAujourdhui] = await Promise.all([
    prisma.task.findMany({
      where: { statut: { in: ['A_TRAITER', 'EN_COURS'] }, echeance: { lt: now } },
      orderBy: { echeance: 'asc' },
      take: 5,
    }),
    prisma.document.findMany({
      where: { statutDocument: 'MANQUANT' },
      include: { client: true },
      take: 5,
    }),
    prisma.contrat.findMany({
      where: { dateFin: { gte: now, lte: in30Days }, statut: { not: 'RESILIE' } },
      include: { client: true },
      orderBy: { dateFin: 'asc' },
      take: 5,
    }),
    prisma.rendezVous.findMany({
      where: {
        dateDebut: { gte: startOfToday, lt: startOfTomorrow },
        statut: { notIn: ['ANNULE'] },
      },
      take: 5,
    }),
  ])

  return NextResponse.json({
    tachesEnRetard,
    documentsManquants,
    contratsEcheance,
    rdvAujourdhui,
    total: tachesEnRetard.length + documentsManquants.length + contratsEcheance.length,
  })
}
