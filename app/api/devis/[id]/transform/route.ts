import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { addDays } from '@/lib/excel-import'
import { notifyNewContrat } from '@/lib/notify'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

// Partner sites (e.g. tempassur) transform their own devis into a contrat
// server-to-server right after a successful payment — no login involved.
async function requireWriteAuth(req: Request) {
  const token = await getActor(req)
  if (!token) return null
  if (token.kind === 'partner') return token
  if (['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return token
  return null
}

const schema = z.object({
  numero: z.string().min(1),
  prime: z.number(),
  honoraires: z.number().default(0),
  dateEffet: z.string().optional(),
  dureeJours: z.number().int().nullable().optional(),
  // Not stored on Devis (no dedicated vehicle columns there), so the caller
  // supplies them again at transform time — same pattern as prime/dateEffet.
  marque: z.string().optional(),
  modele: z.string().optional(),
  immatriculation: z.string().optional(),
})

// §5.1 : Bouton "Créer le contrat" — préremplit la fiche Contrat avec les
// données du devis et du client (évite la ressaisie), garde le lien pour
// la traçabilité prospect → client.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireWriteAuth(req)
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
  if (Number.isNaN(dateEffet.getTime())) {
    return NextResponse.json({ message: 'Date d’effet invalide.' }, { status: 422 })
  }
  const dateFin = parsed.data.dureeJours ? addDays(dateEffet, parsed.data.dureeJours) : addDays(dateEffet, 365)

  const contrat = await prisma.contrat.create({
    data: {
      numero: parsed.data.numero,
      clientId: devis.clientId,
      distributeurId: devis.distributeurId,
      produitId: devis.produitId,
      marque: parsed.data.marque,
      modele: parsed.data.modele,
      immatriculation: parsed.data.immatriculation,
      dateSouscription: new Date(),
      dateEffet,
      dureeJours: parsed.data.dureeJours,
      dateDebut: dateEffet,
      dateFin,
      prime: parsed.data.prime,
      honoraires: parsed.data.honoraires,
      besoinsExprimes: devis.besoinsExprimes,
    },
    include: { client: true, distributeur: true, produitRef: true },
  })

  await prisma.devis.update({
    where: { id },
    data: { contratId: contrat.id, statutPipeline: 'GAGNE' },
  })

  void notifyNewContrat(contrat, token.kind as 'user' | 'partner', { fromDevisId: devis.id })

  return NextResponse.json(contrat, { status: 201 })
}
