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

  const contrat = await prisma.contrat.findUnique({
    where: { id },
    include: {
      client: true,
      distributeur: true,
      produitRef: true,
      statutRef: true,
      factures: { orderBy: { createdAt: 'desc' } },
      documents: { include: { typeDocumentRef: true }, orderBy: { createdAt: 'desc' } },
      taches: { orderBy: { createdAt: 'desc' } },
      rendezVous: { orderBy: { dateDebut: 'desc' } },
      reclamations: { orderBy: { date: 'desc' } },
      statutHistorique: { orderBy: { date: 'desc' } },
      devis: true,
    },
  })

  if (!contrat) return NextResponse.json({ message: 'Contrat introuvable.' }, { status: 404 })
  return NextResponse.json(contrat)
}

const updateSchema = z.object({
  distributeurId: z.string().nullable().optional(),
  produitId: z.string().nullable().optional(),
  statutRefId: z.string().nullable().optional(),
  marque: z.string().nullable().optional(),
  modele: z.string().nullable().optional(),
  immatriculation: z.string().nullable().optional(),
  dateEffet: z.string().nullable().optional(),
  dureeJours: z.number().int().nullable().optional(),
  dateFin: z.string().optional(),
  prime: z.number().optional(),
  honoraires: z.number().optional(),
  dateResiliation: z.string().nullable().optional(),
  motifResiliation: z.string().nullable().optional(),
  notesInternes: z.string().nullable().optional(),
  besoinsExprimes: z.string().nullable().optional(),
  dateRappel: z.string().nullable().optional(),
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

  const { dateEffet, dateFin, dateResiliation, dateRappel, ...rest } = parsed.data

  const current = await prisma.contrat.findUnique({ where: { id }, include: { statutRef: true } })
  if (!current) return NextResponse.json({ message: 'Contrat introuvable.' }, { status: 404 })

  const operations = []

  // Historique de statut en lecture seule (§16.1 g)
  if (rest.statutRefId !== undefined && rest.statutRefId !== current.statutRefId) {
    const [ancien, nouveau] = await Promise.all([
      current.statutRefId ? prisma.listeReference.findUnique({ where: { id: current.statutRefId } }) : null,
      rest.statutRefId ? prisma.listeReference.findUnique({ where: { id: rest.statutRefId } }) : null,
    ])
    operations.push(
      prisma.statutHistorique.create({
        data: {
          contratId: id,
          entityType: 'CONTRAT',
          ancienStatut: ancien?.nom ?? current.statut,
          nouveauStatut: nouveau?.nom ?? 'Inconnu',
        },
      }),
    )
  }

  operations.push(
    prisma.contrat.update({
      where: { id },
      data: {
        ...rest,
        dateEffet: dateEffet === undefined ? undefined : dateEffet ? new Date(dateEffet) : null,
        dateFin: dateFin ? new Date(dateFin) : undefined,
        dateResiliation: dateResiliation === undefined ? undefined : dateResiliation ? new Date(dateResiliation) : null,
        dateRappel: dateRappel === undefined ? undefined : dateRappel ? new Date(dateRappel) : null,
      },
    }),
  )

  const results = await prisma.$transaction(operations)
  const updated = results[results.length - 1]
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }
  const { id } = await params
  await prisma.contrat.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
