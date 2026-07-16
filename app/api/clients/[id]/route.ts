import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  const { id } = await params

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contrats: { include: { distributeur: true, produitRef: true, statutRef: true }, orderBy: { createdAt: 'desc' } },
      devis: { include: { distributeur: true, produit: true }, orderBy: { createdAt: 'desc' } },
      documents: { include: { typeDocumentRef: true }, orderBy: { createdAt: 'desc' } },
      taches: { orderBy: { createdAt: 'desc' } },
      rendezVous: { orderBy: { dateDebut: 'desc' } },
    },
  })

  if (!client) return NextResponse.json({ message: 'Client introuvable.' }, { status: 404 })
  return NextResponse.json(client)
}

const updateSchema = z.object({
  civilite: z.string().optional(),
  nom: z.string().min(1).optional(),
  prenom: z.string().min(1).optional(),
  telephone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  numeroPermis: z.string().nullable().optional(),
  paysPermis: z.string().nullable().optional(),
  type: z.enum(['PARTICULIER', 'PROFESSIONNEL']).optional(),
  raisonSociale: z.string().nullable().optional(),
  siret: z.string().nullable().optional(),
  ville: z.string().nullable().optional(),
  codePostal: z.string().nullable().optional(),
  adresse: z.string().nullable().optional(),
  pays: z.string().nullable().optional(),
  dateNaissance: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isVip: z.boolean().optional(),
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

  const { dateNaissance, ...rest } = parsed.data
  const client = await prisma.client.update({
    where: { id },
    data: { ...rest, dateNaissance: dateNaissance ? new Date(dateNaissance) : dateNaissance === null ? null : undefined },
  })

  return NextResponse.json(client)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }
  const { id } = await params
  await prisma.client.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
