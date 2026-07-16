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
  statutDocument: z.enum(['MANQUANT', 'EN_ATTENTE', 'VALIDE', 'REFUSE']).optional(),
  motifRefus: z.string().nullable().optional(),
  dateExpiration: z.string().nullable().optional(),
  typeDocumentId: z.string().nullable().optional(),
  libelleAutre: z.string().nullable().optional(),
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

  const { dateExpiration, ...rest } = parsed.data
  const doc = await prisma.document.update({
    where: { id },
    data: { ...rest, dateExpiration: dateExpiration === undefined ? undefined : dateExpiration ? new Date(dateExpiration) : null },
  })

  return NextResponse.json(doc)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  const { id } = await params
  await prisma.document.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
