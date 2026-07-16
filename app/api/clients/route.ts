import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
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
  const search = searchParams.get('q')?.trim()

  // Legacy shape: a bare search query (no page param) returns a flat list, used by
  // pickers/autocompletes that don't need pagination or facets.
  if (!searchParams.has('page') && !searchParams.has('full')) {
    const clients = await prisma.client.findMany({
      where: search
        ? {
            OR: [
              { nom: { contains: search, mode: 'insensitive' } },
              { prenom: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { telephone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: 'desc' },
      take: 30,
    })
    return NextResponse.json(clients)
  }

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const type = searchParams.get('type')
  const isVip = searchParams.get('isVip')
  const civilite = searchParams.get('civilite')
  const ville = searchParams.get('ville')
  const pays = searchParams.get('pays')
  const nationalite = searchParams.get('nationalite')
  const secteurActivite = searchParams.get('secteurActivite')
  const dateNaissanceFrom = searchParams.get('dateNaissanceFrom')
  const dateNaissanceTo = searchParams.get('dateNaissanceTo')
  const createdAtFrom = searchParams.get('createdAtFrom')
  const createdAtTo = searchParams.get('createdAtTo')

  const where: Prisma.ClientWhereInput = {
    AND: [
      search
        ? {
            OR: [
              { nom: { contains: search, mode: 'insensitive' } },
              { prenom: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { telephone: { contains: search, mode: 'insensitive' } },
              { raisonSociale: { contains: search, mode: 'insensitive' } },
              { siret: { contains: search, mode: 'insensitive' } },
              { numeroPermis: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
      type ? { type: type as 'PARTICULIER' | 'PROFESSIONNEL' } : {},
      isVip ? { isVip: isVip === 'true' } : {},
      civilite ? { civilite } : {},
      ville ? { ville } : {},
      pays ? { pays } : {},
      nationalite ? { nationalite } : {},
      secteurActivite ? { secteurActivite } : {},
      dateNaissanceFrom || dateNaissanceTo
        ? {
            dateNaissance: {
              ...(dateNaissanceFrom ? { gte: new Date(dateNaissanceFrom) } : {}),
              ...(dateNaissanceTo ? { lte: new Date(new Date(dateNaissanceTo).getTime() + 86400000) } : {}),
            },
          }
        : {},
      createdAtFrom || createdAtTo
        ? {
            createdAt: {
              ...(createdAtFrom ? { gte: new Date(createdAtFrom) } : {}),
              ...(createdAtTo ? { lte: new Date(new Date(createdAtTo).getTime() + 86400000) } : {}),
            },
          }
        : {},
    ],
  }

  const [clients, total, totalContrats, totalDocuments, villes, civilites, paysList, nationalites, secteurs] = await Promise.all([
    prisma.client.findMany({
      where,
      include: { _count: { select: { contrats: true, documents: true, devis: true } } },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.client.count({ where }),
    prisma.contrat.count(),
    prisma.document.count(),
    prisma.client.findMany({ where: { ville: { not: null } }, select: { ville: true }, distinct: ['ville'], orderBy: { ville: 'asc' } }),
    prisma.client.findMany({ where: { civilite: { not: null } }, select: { civilite: true }, distinct: ['civilite'], orderBy: { civilite: 'asc' } }),
    prisma.client.findMany({ where: { pays: { not: null } }, select: { pays: true }, distinct: ['pays'], orderBy: { pays: 'asc' } }),
    prisma.client.findMany({ where: { nationalite: { not: null } }, select: { nationalite: true }, distinct: ['nationalite'], orderBy: { nationalite: 'asc' } }),
    prisma.client.findMany({ where: { secteurActivite: { not: null } }, select: { secteurActivite: true }, distinct: ['secteurActivite'], orderBy: { secteurActivite: 'asc' } }),
  ])

  return NextResponse.json({
    clients,
    total,
    totalContrats,
    totalDocuments,
    villes: villes.map((v) => v.ville),
    civilites: civilites.map((c) => c.civilite),
    paysList: paysList.map((p) => p.pays),
    nationalites: nationalites.map((n) => n.nationalite),
    secteurs: secteurs.map((s) => s.secteurActivite),
  })
}

const createSchema = z.object({
  civilite: z.string().optional(),
  nom: z.string().min(1),
  prenom: z.string().min(1),
  telephone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  type: z.enum(['PARTICULIER', 'PROFESSIONNEL']).default('PARTICULIER'),
  raisonSociale: z.string().optional(),
  siret: z.string().optional(),
  ville: z.string().optional(),
  codePostal: z.string().optional(),
  adresse: z.string().optional(),
  notes: z.string().optional(),
  isVip: z.boolean().optional(),
})

export async function POST(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Données invalides', errors: parsed.error.flatten() }, { status: 422 })
  }

  const client = await prisma.client.create({
    data: { ...parsed.data, email: parsed.data.email || undefined },
  })

  return NextResponse.json(client, { status: 201 })
}
