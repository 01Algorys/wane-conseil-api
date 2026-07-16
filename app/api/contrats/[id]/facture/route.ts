import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { generateInvoiceNumber, generateInvoicePdf } from '@/lib/invoice'
import { savePdfBuffer } from '@/lib/storage'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

// §6.1 / §6.3 : Générer la facture (ou la régénérer si le contrat a changé
// après une première génération — l'ancienne version reste archivée).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  const { id } = await params

  const contrat = await prisma.contrat.findUnique({
    where: { id },
    include: { client: true, distributeur: true, produitRef: true },
  })
  if (!contrat) return NextResponse.json({ message: 'Contrat introuvable.' }, { status: 404 })

  const montantTtc = contrat.prime + contrat.honoraires
  const montantHt = montantTtc

  const numeroFacture = await generateInvoiceNumber()
  const pdfBuffer = await generateInvoicePdf({
    numeroFacture,
    dateGeneration: new Date(),
    client: {
      civilite: contrat.client.civilite,
      nom: contrat.client.nom,
      prenom: contrat.client.prenom,
      adresse: contrat.client.adresse,
      ville: contrat.client.ville,
      codePostal: contrat.client.codePostal,
      raisonSociale: contrat.client.raisonSociale,
    },
    contrat: {
      numero: contrat.numero,
      prime: contrat.prime,
      honoraires: contrat.honoraires,
      produit: contrat.produitRef?.nom ?? contrat.typeAssurance,
      distributeur: contrat.distributeur?.nom ?? contrat.compagnie ?? '—',
    },
    montantHt,
    montantTtc,
  })

  const saved = await savePdfBuffer(pdfBuffer, `factures/${contrat.id}`, numeroFacture)

  const [, facture] = await prisma.$transaction([
    prisma.facture.updateMany({ where: { contratId: id, isActive: true }, data: { isActive: false } }),
    prisma.facture.create({
      data: {
        contratId: id,
        numeroFacture,
        montantHt,
        montantTtc,
        fichierPdfUrl: saved.url,
        isActive: true,
      },
    }),
  ])

  return NextResponse.json(facture, { status: 201 })
}
