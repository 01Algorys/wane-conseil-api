import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) {
    return null
  }
  return token
}

const updateSchema = z.object({
  nom: z.string().min(1).optional(),
  couleur: z.string().nullable().optional(),
  ordre: z.number().int().optional(),
  actif: z.boolean().optional(),
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

  const updated = await prisma.listeReference.update({ where: { id }, data: parsed.data })
  return NextResponse.json(updated)
}

// Suppression = désactivation logique (les entités liées gardent leur référence)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const { id } = await params
  const updated = await prisma.listeReference.update({ where: { id }, data: { actif: false } })
  return NextResponse.json(updated)
}
