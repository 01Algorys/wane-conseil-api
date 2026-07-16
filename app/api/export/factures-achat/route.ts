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

  const factures = await prisma.factureAchat.findMany({
    where: {
      dateFacture: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    },
    include: { categorie: true },
    orderBy: { dateFacture: 'desc' },
  })

  const totalParCategorie = new Map<string, number>()
  for (const f of factures) {
    const key = f.categorie?.nom ?? 'Sans catégorie'
    totalParCategorie.set(key, (totalParCategorie.get(key) ?? 0) + f.montantTtc)
  }

  const rows = factures.map((f) => ({
    fournisseur: f.fournisseur,
    categorie: f.categorie?.nom ?? '',
    montantTtc: f.montantTtc.toFixed(2),
    dateFacture: format(f.dateFacture, 'dd/MM/yyyy'),
    note: f.note ?? '',
  }))

  for (const [categorie, total] of totalParCategorie) {
    rows.push({ fournisseur: '', categorie: `TOTAL ${categorie}`, montantTtc: total.toFixed(2), dateFacture: '', note: '' })
  }

  const csv = toCsv(rows, [
    { key: 'fournisseur', label: 'Fournisseur' },
    { key: 'categorie', label: 'Catégorie' },
    { key: 'montantTtc', label: 'Montant TTC' },
    { key: 'dateFacture', label: 'Date' },
    { key: 'note', label: 'Note' },
  ])

  return csvResponse(`factures-achat-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv)
}
