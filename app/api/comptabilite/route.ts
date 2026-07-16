import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { startOfMonth } from 'date-fns'

export async function GET(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const now = new Date()
  const debutMois = startOfMonth(now)

  const [factures, facturesAchat, caMois, honorairesMois, facturesNonEnvoyees, contratsImpayes, depensesMois, fournisseurs] =
    await Promise.all([
      prisma.facture.findMany({
        where: { isActive: true },
        include: { contrat: { include: { client: true, distributeur: true } } },
        orderBy: { dateGeneration: 'desc' },
        take: 100,
      }),
      prisma.factureAchat.findMany({ include: { categorie: true }, orderBy: { dateFacture: 'desc' }, take: 100 }),
      prisma.contrat.aggregate({ _sum: { prime: true }, where: { createdAt: { gte: debutMois } } }),
      prisma.facture.aggregate({ _sum: { montantTtc: true }, where: { dateGeneration: { gte: debutMois } } }),
      prisma.facture.count({ where: { statutEnvoi: 'NON_ENVOYEE', isActive: true } }),
      prisma.contrat.count({ where: { statut: 'EN_ATTENTE' } }),
      prisma.factureAchat.aggregate({ _sum: { montantTtc: true }, where: { dateFacture: { gte: debutMois } } }),
      prisma.factureAchat.findMany({ distinct: ['fournisseur'], select: { fournisseur: true }, take: 50 }),
    ])

  return NextResponse.json({
    factures,
    facturesAchat,
    caMoisTotal: caMois._sum.prime ?? 0,
    honorairesMoisTotal: honorairesMois._sum.montantTtc ?? 0,
    facturesNonEnvoyees,
    contratsImpayes,
    depensesMoisTotal: depensesMois._sum.montantTtc ?? 0,
    fournisseurs: fournisseurs.map((f) => f.fournisseur),
  })
}
