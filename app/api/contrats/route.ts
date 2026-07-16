import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { addDays } from '@/lib/excel-import'
import { Prisma } from '@prisma/client'

const PAGE_SIZE = 25

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

export async function GET(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const { searchParams } = new URL(req.url)

  if (!searchParams.has('full')) {
    const contrats = await prisma.contrat.findMany({
      include: {
        client: true,
        distributeur: true,
        produitRef: true,
        statutRef: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })
    return NextResponse.json(contrats)
  }

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const search = searchParams.get('q')?.trim()
  const statut = searchParams.get('statut')
  const distributeurId = searchParams.get('distributeurId')
  const produitId = searchParams.get('produitId')
  const agentAssigneId = searchParams.get('agentAssigneId')
  const resilie = searchParams.get('resilie')
  const echeance = searchParams.get('echeance')
  const dateDebutFrom = searchParams.get('dateDebutFrom')
  const dateDebutTo = searchParams.get('dateDebutTo')
  const primeMin = searchParams.get('primeMin')
  const primeMax = searchParams.get('primeMax')

  const echeanceFilter = (() => {
    if (echeance === '30') return { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) }
    if (echeance === '60') return { gte: new Date(), lte: new Date(Date.now() + 60 * 86400000) }
    if (echeance === 'depassees') return { lt: new Date() }
    return undefined
  })()

  const where: Prisma.ContratWhereInput = {
    AND: [
      search
        ? {
            OR: [
              { numero: { contains: search, mode: 'insensitive' } },
              { numeroDemande: { contains: search, mode: 'insensitive' } },
              { immatriculation: { contains: search, mode: 'insensitive' } },
              { marque: { contains: search, mode: 'insensitive' } },
              { modele: { contains: search, mode: 'insensitive' } },
              { client: { nom: { contains: search, mode: 'insensitive' } } },
              { client: { prenom: { contains: search, mode: 'insensitive' } } },
              { client: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {},
      statut ? { statutRefId: statut } : {},
      distributeurId ? { distributeurId } : {},
      produitId ? { produitId } : {},
      agentAssigneId ? { agentAssigneId } : {},
      resilie ? { dateResiliation: resilie === 'true' ? { not: null } : null } : {},
      echeanceFilter ? { dateFin: echeanceFilter } : {},
      dateDebutFrom || dateDebutTo
        ? {
            dateDebut: {
              ...(dateDebutFrom ? { gte: new Date(dateDebutFrom) } : {}),
              ...(dateDebutTo ? { lte: new Date(new Date(dateDebutTo).getTime() + 86400000) } : {}),
            },
          }
        : {},
      primeMin || primeMax
        ? {
            prime: {
              ...(primeMin ? { gte: parseFloat(primeMin) } : {}),
              ...(primeMax ? { lte: parseFloat(primeMax) } : {}),
            },
          }
        : {},
    ],
  }

  const [contrats, total, statuts, distributeurs, produits, agents, activeCount, totalPrimeResult] = await Promise.all([
    prisma.contrat.findMany({
      where,
      include: { client: true, distributeur: true, produitRef: true, statutRef: true },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.contrat.count({ where }),
    prisma.listeReference.findMany({ where: { type: 'STATUT_CONTRAT', actif: true }, orderBy: { ordre: 'asc' } }),
    prisma.listeReference.findMany({ where: { type: 'DISTRIBUTEUR', actif: true }, orderBy: { ordre: 'asc' } }),
    prisma.listeReference.findMany({ where: { type: 'PRODUIT', actif: true }, orderBy: { ordre: 'asc' } }),
    prisma.user.findMany({ where: { role: { in: ['ADMIN', 'COMMERCIAL', 'SUPER_ADMIN'] } }, select: { id: true, firstName: true, lastName: true } }),
    prisma.contrat.count({ where: { statutRef: { nom: 'Actif' } } }),
    prisma.contrat.aggregate({ _sum: { prime: true }, where: { statutRef: { nom: 'Actif' } } }),
  ])

  return NextResponse.json({
    contrats,
    total,
    statuts,
    distributeurs,
    produits,
    agents,
    activeCount,
    totalPrimeActive: totalPrimeResult._sum.prime ?? 0,
  })
}

const createSchema = z.object({
  clientId: z.string().min(1),
  numero: z.string().min(1),
  numeroDemande: z.string().optional(),
  distributeurId: z.string().nullable().optional(),
  produitId: z.string().nullable().optional(),
  statutRefId: z.string().nullable().optional(),
  marque: z.string().optional(),
  modele: z.string().optional(),
  immatriculation: z.string().optional(),
  dateEffet: z.string().optional(),
  dureeJours: z.number().int().nullable().optional(),
  dateFin: z.string().optional(),
  prime: z.number(),
  honoraires: z.number().default(0),
  besoinsExprimes: z.string().optional(),
  notesInternes: z.string().optional(),
})

export async function POST(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Données invalides', errors: parsed.error.flatten() }, { status: 422 })
  }

  const data = parsed.data
  const dateEffet = data.dateEffet ? new Date(data.dateEffet) : new Date()
  const dateFin = data.dateFin ? new Date(data.dateFin) : data.dureeJours ? addDays(dateEffet, data.dureeJours) : addDays(dateEffet, 365)

  const existing = await prisma.contrat.findUnique({ where: { numero: data.numero } })
  if (existing) {
    return NextResponse.json({ message: 'Ce numéro de contrat existe déjà.' }, { status: 409 })
  }

  const contrat = await prisma.contrat.create({
    data: {
      clientId: data.clientId,
      numero: data.numero,
      numeroDemande: data.numeroDemande,
      distributeurId: data.distributeurId,
      produitId: data.produitId,
      statutRefId: data.statutRefId,
      marque: data.marque,
      modele: data.modele,
      immatriculation: data.immatriculation,
      dateSouscription: new Date(),
      dateEffet,
      dureeJours: data.dureeJours,
      dateDebut: dateEffet,
      dateFin,
      prime: data.prime,
      honoraires: data.honoraires,
      besoinsExprimes: data.besoinsExprimes,
      notesInternes: data.notesInternes,
    },
  })

  return NextResponse.json(contrat, { status: 201 })
}
