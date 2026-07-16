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
  statut: z.enum(['OUVERTE', 'EN_COURS', 'RESOLUE']),
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

  const reclamation = await prisma.reclamation.update({
    where: { id },
    data: {
      statut: parsed.data.statut,
      dateResolution: parsed.data.statut === 'RESOLUE' ? new Date() : null,
    },
  })

  return NextResponse.json(reclamation)
}
