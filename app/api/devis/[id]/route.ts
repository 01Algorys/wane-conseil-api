import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { DEVIS_PIPELINE_LABELS } from '@/lib/labels'
import { DevisStatutPipeline } from '@prisma/client'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  const { id } = await params

  const devis = await prisma.devis.findUnique({
    where: { id },
    include: { client: true, distributeur: true, produit: true, taches: true, rendezVous: true, statutHistorique: true },
  })
  if (!devis) return NextResponse.json({ message: 'Devis introuvable.' }, { status: 404 })
  return NextResponse.json(devis)
}

const updateSchema = z.object({
  distributeurId: z.string().nullable().optional(),
  produitId: z.string().nullable().optional(),
  statutPipeline: z.nativeEnum(DevisStatutPipeline).optional(),
  montantEstime: z.number().nullable().optional(),
  dateRelance: z.string().nullable().optional(),
  probabilite: z.number().int().nullable().optional(),
  motifPerte: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  besoinsExprimes: z.string().nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Données invalides', errors: parsed.error.flatten() }, { status: 422 })
  }

  const current = await prisma.devis.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ message: 'Devis introuvable.' }, { status: 404 })

  const { dateRelance, ...rest } = parsed.data
  const operations = []

  if (rest.statutPipeline && rest.statutPipeline !== current.statutPipeline) {
    operations.push(
      prisma.statutHistorique.create({
        data: {
          devisId: id,
          entityType: 'DEVIS',
          ancienStatut: DEVIS_PIPELINE_LABELS[current.statutPipeline],
          nouveauStatut: DEVIS_PIPELINE_LABELS[rest.statutPipeline],
        },
      }),
    )
  }

  operations.push(
    prisma.devis.update({
      where: { id },
      data: { ...rest, dateRelance: dateRelance === undefined ? undefined : dateRelance ? new Date(dateRelance) : null },
    }),
  )

  const results = await prisma.$transaction(operations)
  return NextResponse.json(results[results.length - 1])
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  const { id } = await params
  await prisma.devis.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
