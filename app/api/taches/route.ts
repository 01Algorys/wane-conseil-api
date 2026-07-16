import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

export async function GET(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  const clientId = searchParams.get('clientId')
  const contratId = searchParams.get('contratId')
  const devisId = searchParams.get('devisId')

  if (!searchParams.has('full')) {
    const taches = await prisma.task.findMany({
      where: {
        statut: statut ? (statut as never) : undefined,
        clientId: clientId ?? undefined,
        contratId: contratId ?? undefined,
        devisId: devisId ?? undefined,
      },
      include: { client: true, contrat: true, devis: true, assignedTo: true },
      orderBy: [{ echeance: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    })
    return NextResponse.json(taches)
  }

  const search = searchParams.get('q')?.trim()
  const priorite = searchParams.get('priorite')
  const type = searchParams.get('type')

  const where: Prisma.TaskWhereInput = {
    AND: [
      search ? { titre: { contains: search, mode: 'insensitive' } } : {},
      statut ? { statut: statut as never } : {},
      priorite ? { priorite: priorite as never } : {},
      type ? { type: type as never } : {},
    ],
  }

  const [tasks, total, pending, traitees, enRetard] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { client: true, contrat: true, devis: true, lead: true },
      orderBy: [{ echeance: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    }),
    prisma.task.count({ where }),
    prisma.task.count({ where: { statut: { not: 'TRAITE' } } }),
    prisma.task.count({ where: { statut: 'TRAITE' } }),
    prisma.task.count({ where: { statut: { in: ['A_TRAITER', 'EN_COURS'] }, echeance: { lt: new Date() } } }),
  ])

  return NextResponse.json({ tasks, total, pending, traitees, enRetard })
}

const createSchema = z.object({
  titre: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional(),
  priorite: z.enum(['BASSE', 'NORMALE', 'HAUTE', 'URGENTE']).default('NORMALE'),
  echeance: z.string().nullable().optional(),
  clientId: z.string().optional(),
  contratId: z.string().optional(),
  devisId: z.string().optional(),
})

export async function POST(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Données invalides', errors: parsed.error.flatten() }, { status: 422 })
  }

  const { echeance, ...rest } = parsed.data
  const task = await prisma.task.create({
    data: {
      ...rest,
      type: rest.type as never,
      echeance: echeance ? new Date(echeance) : null,
      assignedToId: token.id as string,
    },
  })

  return NextResponse.json(task, { status: 201 })
}
