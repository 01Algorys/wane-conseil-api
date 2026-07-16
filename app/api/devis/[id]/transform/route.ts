import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { addDays } from '@/lib/excel-import'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

const schema = z.object({
  numero: z.string().min(1),
  prime: z.number(),
  honoraires: z.number().default(0),
  dateEffet: z.string().optional(),
  dureeJours: z.number().int().nullable().optional(),
})

// §5.1 : Bouton "Créer le contrat" — préremplit la fiche Contrat avec les
// données du devis et du client (évite la ressaisie), garde le lien pour
// la traçabilité prospect → client.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Données invalides', errors: parsed.error.flatten() }, { status: 422 })
  }

  const devis = await prisma.devis.findUnique({ where: { id } })
  if (!devis) return NextResponse.json({ message: 'Devis introuvable.' }, { status: 404 })
  if (devis.contratId) return NextResponse.json({ message: 'Ce devis a déjà été transformé.' }, { status: 409 })

  const existingNumero = await prisma.contrat.findUnique({ where: { numero: parsed.data.numero } })
  if (existingNumero) return NextResponse.json({ message: 'Ce numéro de contrat existe déjà.' }, { status: 409 })

  const dateEffet = parsed.data.dateEffet ? new Date(parsed.data.dateEffet) : new Date()
  const dateFin = parsed.data.dureeJours ? addDays(dateEffet, parsed.data.dureeJours) : addDays(dateEffet, 365)

  const contrat = await prisma.contrat.create({
    data: {
      numero: parsed.data.numero,
      clientId: devis.clientId,
      distributeurId: devis.distributeurId,
      produitId: devis.produitId,
      dateSouscription: new Date(),
      dateEffet,
      dureeJours: parsed.data.dureeJours,
      dateDebut: dateEffet,
      dateFin,
      prime: parsed.data.prime,
      honoraires: parsed.data.honoraires,
      besoinsExprimes: devis.besoinsExprimes,
    },
  })

  await prisma.devis.update({
    where: { id },
    data: { contratId: contrat.id, statutPipeline: 'GAGNE' },
  })

  return NextResponse.json(contrat, { status: 201 })
}
