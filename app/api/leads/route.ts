import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'

const leadSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6),
  typeAssurance: z.string().min(1),
  compagnie: z.string().optional(),
  typeContrat: z.string().optional(),
  ville: z.string().optional(),
  pays: z.string().optional(),
  nationalite: z.string().optional(),
  dateNaissance: z.string().optional(),
  formData: z.record(z.any()).optional(),
  consent: z.boolean(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parseResult = leadSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ message: 'Données de lead invalides', errors: parseResult.error.flatten() }, { status: 422 })
  }

  const { firstName, lastName, email, phone, typeAssurance, compagnie, typeContrat, ville, pays, nationalite, dateNaissance, formData, consent } = parseResult.data

  const token = await getActor(req)
  const lead = await prisma.lead.create({
    data: {
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      typeAssurance,
      compagnie,
      typeContrat,
      ville,
      pays,
      nationalite,
      dateNaissance: dateNaissance ? new Date(dateNaissance) : undefined,
      formData: formData ? formData : undefined,
      statut: 'NOUVEAU',
      consentAt: consent ? new Date() : null,
      createdBy: token?.kind === 'user' ? { connect: { id: token.id as string } } : undefined,
    },
  })

  return NextResponse.json({ id: lead.id, status: lead.statut }, { status: 201 })
}

export async function GET(req: Request) {
  const token = await getActor(req)
  if (token?.kind !== 'user') {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const leads = await prisma.lead.findMany({
    include: { assignedTo: true, client: { include: { user: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(leads)
}
