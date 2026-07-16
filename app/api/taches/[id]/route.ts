import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

const updateSchema = z.object({
  titre: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  statut: z.enum(['A_TRAITER', 'EN_COURS', 'TRAITE', 'ANNULE']).optional(),
  priorite: z.enum(['BASSE', 'NORMALE', 'HAUTE', 'URGENTE']).optional(),
  echeance: z.string().nullable().optional(),
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

  const { echeance, ...rest } = parsed.data
  const task = await prisma.task.update({
    where: { id },
    data: { ...rest, echeance: echeance === undefined ? undefined : echeance ? new Date(echeance) : null },
  })

  return NextResponse.json(task)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  const { id } = await params
  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
