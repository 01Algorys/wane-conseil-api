import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// Numérotation strictement séquentielle et non réutilisable (§6.3, obligation légale)
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `FA-${year}-`
  const count = await prisma.facture.count({ where: { numeroFacture: { startsWith: prefix } } })
  let sequence = count + 1

  // Filet de sécurité en cas de doublon improbable (mono-utilisateur en V1)
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `${prefix}${String(sequence).padStart(5, '0')}`
    const exists = await prisma.facture.findUnique({ where: { numeroFacture: candidate } })
    if (!exists) return candidate
    sequence += 1
  }
  throw new Error('Impossible de générer un numéro de facture unique.')
}

interface InvoiceData {
  numeroFacture: string
  dateGeneration: Date
  client: { civilite: string | null; nom: string | null; prenom: string | null; adresse: string | null; ville: string | null; codePostal: string | null; raisonSociale: string | null }
  contrat: { numero: string; prime: number; honoraires: number; produit: string; distributeur: string }
  montantHt: number
  montantTtc: number
}

const CABINET = {
  nom: 'WN Conseil',
  adresse: 'Courtier en assurances',
  mention: 'Courtage en assurances — Immatriculation ORIAS',
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89]) // A4
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const gold = rgb(0.83, 0.69, 0.22)
  const dark = rgb(0.1, 0.1, 0.1)
  const gray = rgb(0.4, 0.4, 0.4)

  let y = 780

  page.drawText(CABINET.nom, { x: 50, y, size: 22, font: bold, color: gold })
  y -= 18
  page.drawText(CABINET.adresse, { x: 50, y, size: 9, font, color: gray })
  y -= 12
  page.drawText(CABINET.mention, { x: 50, y, size: 9, font, color: gray })

  page.drawText('FACTURE', { x: 420, y: 780, size: 20, font: bold, color: dark })
  page.drawText(data.numeroFacture, { x: 420, y: 758, size: 11, font, color: gray })
  page.drawText(format(data.dateGeneration, 'dd MMMM yyyy', { locale: fr }), { x: 420, y: 742, size: 10, font, color: gray })

  y -= 60
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
  y -= 30

  page.drawText('Facturé à', { x: 50, y, size: 9, font: bold, color: gray })
  y -= 16
  const clientName = data.client.raisonSociale || `${data.client.civilite ?? ''} ${data.client.prenom ?? ''} ${data.client.nom ?? ''}`.trim()
  page.drawText(clientName || 'Client', { x: 50, y, size: 12, font: bold, color: dark })
  y -= 16
  if (data.client.adresse) {
    page.drawText(data.client.adresse, { x: 50, y, size: 10, font, color: gray })
    y -= 14
  }
  if (data.client.ville || data.client.codePostal) {
    page.drawText(`${data.client.codePostal ?? ''} ${data.client.ville ?? ''}`.trim(), { x: 50, y, size: 10, font, color: gray })
    y -= 14
  }

  y -= 20
  page.drawText('Distributeur', { x: 350, y: y + (data.client.adresse ? 30 : 16), size: 9, font: bold, color: gray })
  page.drawText(data.contrat.distributeur, { x: 350, y: y + (data.client.adresse ? 14 : 0), size: 11, font, color: dark })

  y -= 30
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
  y -= 25

  // Table header
  page.drawText('Description', { x: 50, y, size: 9, font: bold, color: gray })
  page.drawText('Contrat', { x: 280, y, size: 9, font: bold, color: gray })
  page.drawText('Montant', { x: 480, y, size: 9, font: bold, color: gray })
  y -= 18
  page.drawLine({ start: { x: 50, y: y + 8 }, end: { x: 545, y: y + 8 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })

  page.drawText(`Prime d'assurance — ${data.contrat.produit}`, { x: 50, y, size: 10, font, color: dark })
  page.drawText(data.contrat.numero, { x: 280, y, size: 10, font, color: dark })
  page.drawText(`${data.contrat.prime.toFixed(2)} €`, { x: 480, y, size: 10, font, color: dark })
  y -= 20

  page.drawText('Honoraires de courtage', { x: 50, y, size: 10, font, color: dark })
  page.drawText(`${data.contrat.honoraires.toFixed(2)} €`, { x: 480, y, size: 10, font, color: dark })

  y -= 40
  page.drawLine({ start: { x: 300, y: y + 15 }, end: { x: 545, y: y + 15 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
  page.drawText('Total HT', { x: 350, y, size: 10, font, color: gray })
  page.drawText(`${data.montantHt.toFixed(2)} €`, { x: 480, y, size: 10, font, color: dark })
  y -= 18
  page.drawText('Total TTC', { x: 350, y, size: 12, font: bold, color: dark })
  page.drawText(`${data.montantTtc.toFixed(2)} €`, { x: 480, y, size: 12, font: bold, color: gold })

  page.drawText('Document généré automatiquement — WN Conseil', { x: 50, y: 40, size: 8, font, color: gray })

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
