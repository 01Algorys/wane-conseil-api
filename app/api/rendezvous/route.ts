import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

export async function GET(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const rdv = await prisma.rendezVous.findMany({
    where: {
      clientId: clientId ?? undefined,
      dateDebut: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    },
    include: { client: true, contrat: true, devis: true },
    orderBy: { dateDebut: 'asc' },
    take: 300,
  })

  return NextResponse.json(rdv)
}

const createSchema = z.object({
  titre: z.string().min(1),
  clientId: z.string().optional(),
  contratId: z.string().optional(),
  devisId: z.string().optional(),
  dateDebut: z.string(),
  dateFin: z.string(),
  typeRdv: z.enum(['TELEPHONE', 'VISIO', 'PRESENTIEL']).default('TELEPHONE'),
  lieu: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Données invalides', errors: parsed.error.flatten() }, { status: 422 })
  }

  const { dateDebut, dateFin, ...rest } = parsed.data
  const rdv = await prisma.rendezVous.create({
    data: { ...rest, dateDebut: new Date(dateDebut), dateFin: new Date(dateFin) },
  })

  return NextResponse.json(rdv, { status: 201 })
}
