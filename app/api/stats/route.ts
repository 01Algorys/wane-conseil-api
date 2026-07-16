import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { startOfMonth, subMonths, isPast, isToday } from 'date-fns'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (actor?.kind !== 'user' || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(actor.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const sixMonthsAgo = subMonths(monthStart, 5)

  const [
    activeContracts,
    revenueResult,
    devisParEtapeRaw,
    devisTotal,
    devisGagnes,
    contratsEcheance,
    documentsManquants,
    tachesEnRetard,
    tachesDuJour,
    clientsCount,
    contratsRecents,
    repartitionDistributeurRaw,
    repartitionProduitRaw,
    prochainsRdv,
    distributeurs,
    produits,
  ] = await Promise.all([
    prisma.contrat.count({ where: { statutRef: { nom: 'Actif' } } }),
    prisma.contrat.aggregate({ _sum: { prime: true }, where: { createdAt: { gte: monthStart } } }),
    prisma.devis.groupBy({ by: ['statutPipeline'], _count: true }),
    prisma.devis.count(),
    prisma.devis.count({ where: { statutPipeline: 'GAGNE' } }),
    prisma.contrat.count({ where: { dateFin: { gte: now, lte: in30Days } } }),
    prisma.document.count({ where: { statutDocument: 'MANQUANT' } }),
    prisma.task.count({ where: { statut: { in: ['A_TRAITER', 'EN_COURS'] }, echeance: { lt: now } } }),
    prisma.task.findMany({
      where: { statut: { in: ['A_TRAITER', 'EN_COURS'] }, echeance: { not: null } },
      include: { client: true, contrat: true },
      orderBy: { echeance: 'asc' },
      take: 50,
    }),
    prisma.client.count(),
    prisma.contrat.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    prisma.contrat.groupBy({ by: ['distributeurId'], _count: true }),
    prisma.contrat.groupBy({ by: ['produitId'], _count: true }),
    prisma.rendezVous.findMany({
      where: { dateDebut: { gte: now }, statut: { notIn: ['ANNULE'] } },
      include: { client: true },
      orderBy: { dateDebut: 'asc' },
      take: 5,
    }),
    prisma.listeReference.findMany({ where: { type: 'DISTRIBUTEUR' } }),
    prisma.listeReference.findMany({ where: { type: 'PRODUIT' } }),
  ])

  const monthlyRevenue = revenueResult._sum.prime ?? 0
  const tauxTransformation = devisTotal > 0 ? Math.round((devisGagnes / devisTotal) * 100) : 0
  const tachesDuJourFiltered = tachesDuJour.filter((t) => t.echeance && isToday(t.echeance))
  const tachesEnRetardListe = tachesDuJour.filter((t) => t.echeance && isPast(t.echeance) && !isToday(t.echeance))

  const distributeurMap = new Map(distributeurs.map((d) => [d.id, d.nom]))
  const repartitionDistributeur = repartitionDistributeurRaw
    .map((d) => ({ name: d.distributeurId ? (distributeurMap.get(d.distributeurId) ?? 'Inconnu') : 'Non renseigné', value: d._count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const produitMap = new Map(produits.map((p) => [p.id, p.nom]))
  const repartitionProduit = repartitionProduitRaw
    .map((p) => ({ name: p.produitId ? (produitMap.get(p.produitId) ?? 'Inconnu') : 'Non renseigné', value: p._count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const evolutionMap = new Map<string, number>()
  for (let i = 0; i < 6; i += 1) {
    const d = subMonths(monthStart, 5 - i)
    evolutionMap.set(format(d, 'MMM yy', { locale: fr }), 0)
  }
  for (const c of contratsRecents) {
    const key = format(c.createdAt, 'MMM yy', { locale: fr })
    if (evolutionMap.has(key)) evolutionMap.set(key, (evolutionMap.get(key) ?? 0) + 1)
  }
  const evolutionMensuelle = Array.from(evolutionMap.entries()).map(([mois, count]) => ({ mois, count }))

  const tachesAffichees = [...tachesEnRetardListe, ...tachesDuJourFiltered].slice(0, 6).map((t) => ({
    id: t.id,
    titre: t.titre,
    echeance: t.echeance,
    enRetard: t.echeance ? isPast(t.echeance) && !isToday(t.echeance) : false,
    client: t.client ? { prenom: t.client.prenom, nom: t.client.nom } : null,
    contrat: t.contrat ? { numero: t.contrat.numero } : null,
  }))

  return NextResponse.json({
    activeContracts,
    monthlyRevenue,
    devisParEtapeRaw,
    tauxTransformation,
    contratsEcheance,
    documentsManquants,
    tachesEnRetard,
    tachesDuJourCount: tachesDuJourFiltered.length,
    tachesAffichees,
    clientsCount,
    evolutionMensuelle,
    repartitionDistributeur,
    repartitionProduit,
    prochainsRdv: prochainsRdv.map((rdv) => ({
      id: rdv.id,
      titre: rdv.titre,
      dateDebut: rdv.dateDebut,
      client: rdv.client ? { prenom: rdv.client.prenom, nom: rdv.client.nom } : null,
    })),
  })
}
