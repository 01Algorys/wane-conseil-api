import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

// Cross-contract facture listing for the admin dashboard — factures are otherwise
// only reachable nested under a contrat (GET /api/contrats/[id]).
export async function GET(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q')?.trim()
  const statutEnvoi = searchParams.get('statutEnvoi')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10) || 25))

  const where: Prisma.FactureWhereInput = {
    isActive: true,
    AND: [
      search
        ? {
            OR: [
              { numeroFacture: { contains: search, mode: 'insensitive' } },
              { contrat: { numero: { contains: search, mode: 'insensitive' } } },
              { contrat: { client: { nom: { contains: search, mode: 'insensitive' } } } },
              { contrat: { client: { prenom: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {},
      statutEnvoi ? { statutEnvoi } : {},
    ],
  }

  const [factures, total] = await Promise.all([
    prisma.facture.findMany({
      where,
      include: { contrat: { include: { client: true } } },
      orderBy: { dateGeneration: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.facture.count({ where }),
  ])

  return NextResponse.json({ factures, total })
}
