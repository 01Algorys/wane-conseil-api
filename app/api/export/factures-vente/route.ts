import { getActor } from '@/lib/request-actor'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { toCsv, csvResponse } from '@/lib/csv'
import { format } from 'date-fns'

export async function GET(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const factures = await prisma.facture.findMany({
    where: {
      isActive: true,
      dateGeneration: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    },
    include: { contrat: { include: { client: true, distributeur: true } } },
    orderBy: { dateGeneration: 'desc' },
  })

  const csv = toCsv(
    factures.map((f) => ({
      numero: f.numeroFacture,
      client: `${f.contrat.client.prenom ?? ''} ${f.contrat.client.nom ?? ''}`.trim(),
      contrat: f.contrat.numero,
      distributeur: f.contrat.distributeur?.nom ?? '',
      montantTtc: f.montantTtc.toFixed(2),
      dateGeneration: format(f.dateGeneration, 'dd/MM/yyyy'),
      statutEnvoi: f.statutEnvoi,
    })),
    [
      { key: 'numero', label: 'N° Facture' },
      { key: 'client', label: 'Client' },
      { key: 'contrat', label: 'Contrat' },
      { key: 'distributeur', label: 'Distributeur' },
      { key: 'montantTtc', label: 'Montant TTC' },
      { key: 'dateGeneration', label: 'Date' },
      { key: 'statutEnvoi', label: "Statut d'envoi" },
    ],
  )

  return csvResponse(`factures-vente-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv)
}
