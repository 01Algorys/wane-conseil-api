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
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
  typeRdv: z.enum(['TELEPHONE', 'VISIO', 'PRESENTIEL']).optional(),
  lieu: z.string().nullable().optional(),
  statut: z.enum(['PREVU', 'CONFIRME', 'REALISE', 'ANNULE', 'REPORTE']).optional(),
  notes: z.string().nullable().optional(),
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

  const { dateDebut, dateFin, ...rest } = parsed.data
  const rdv = await prisma.rendezVous.update({
    where: { id },
    data: {
      ...rest,
      dateDebut: dateDebut ? new Date(dateDebut) : undefined,
      dateFin: dateFin ? new Date(dateFin) : undefined,
    },
  })

  return NextResponse.json(rdv)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  const { id } = await params
  await prisma.rendezVous.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
