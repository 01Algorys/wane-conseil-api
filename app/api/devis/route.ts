import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma, DevisStatutPipeline } from '@prisma/client'

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
    const devis = await prisma.devis.findMany({
      include: { client: true, distributeur: true, produit: true },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })
    return NextResponse.json(devis)
  }

  const search = searchParams.get('q')?.trim()
  const statut = searchParams.get('statut')
  const distributeurId = searchParams.get('distributeurId')
  const produitId = searchParams.get('produitId')
  const converti = searchParams.get('converti')
  const montantEstimeMin = searchParams.get('montantEstimeMin')
  const montantEstimeMax = searchParams.get('montantEstimeMax')
  const dateCreationFrom = searchParams.get('dateCreationFrom')
  const dateCreationTo = searchParams.get('dateCreationTo')
  const dateRelanceFrom = searchParams.get('dateRelanceFrom')
  const dateRelanceTo = searchParams.get('dateRelanceTo')

  const where: Prisma.DevisWhereInput = {
    AND: [
      search
        ? {
            OR: [
              { client: { nom: { contains: search, mode: 'insensitive' } } },
              { client: { prenom: { contains: search, mode: 'insensitive' } } },
              { client: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {},
      statut ? { statutPipeline: statut as DevisStatutPipeline } : {},
      distributeurId ? { distributeurId } : {},
      produitId ? { produitId } : {},
      converti ? { contratId: converti === 'true' ? { not: null } : null } : {},
      montantEstimeMin || montantEstimeMax
        ? {
            montantEstime: {
              ...(montantEstimeMin ? { gte: parseFloat(montantEstimeMin) } : {}),
              ...(montantEstimeMax ? { lte: parseFloat(montantEstimeMax) } : {}),
            },
          }
        : {},
      dateCreationFrom || dateCreationTo
        ? {
            dateCreation: {
              ...(dateCreationFrom ? { gte: new Date(dateCreationFrom) } : {}),
              ...(dateCreationTo ? { lte: new Date(new Date(dateCreationTo).getTime() + 86400000) } : {}),
            },
          }
        : {},
      dateRelanceFrom || dateRelanceTo
        ? {
            dateRelance: {
              ...(dateRelanceFrom ? { gte: new Date(dateRelanceFrom) } : {}),
              ...(dateRelanceTo ? { lte: new Date(new Date(dateRelanceTo).getTime() + 86400000) } : {}),
            },
          }
        : {},
    ],
  }

  const [devis, distributeurs, produits] = await Promise.all([
    prisma.devis.findMany({
      where,
      include: { client: true, distributeur: true, produit: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.listeReference.findMany({ where: { type: 'DISTRIBUTEUR', actif: true }, orderBy: { ordre: 'asc' } }),
    prisma.listeReference.findMany({ where: { type: 'PRODUIT', actif: true }, orderBy: { ordre: 'asc' } }),
  ])

  return NextResponse.json({ devis, distributeurs, produits })
}

const createSchema = z.object({
  clientId: z.string().min(1),
  distributeurId: z.string().nullable().optional(),
  produitId: z.string().nullable().optional(),
  montantEstime: z.number().nullable().optional(),
  dateRelance: z.string().nullable().optional(),
  probabilite: z.number().int().nullable().optional(),
  notes: z.string().optional(),
  besoinsExprimes: z.string().optional(),
})

export async function POST(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Données invalides', errors: parsed.error.flatten() }, { status: 422 })
  }

  const { dateRelance, ...rest } = parsed.data
  const devis = await prisma.devis.create({
    data: { ...rest, dateRelance: dateRelance ? new Date(dateRelance) : null },
  })

  return NextResponse.json(devis, { status: 201 })
}
