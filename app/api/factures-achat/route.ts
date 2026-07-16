import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { saveUploadedFile } from '@/lib/storage'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

export async function GET(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const categorieId = searchParams.get('categorieId')
  const fournisseur = searchParams.get('fournisseur')

  const factures = await prisma.factureAchat.findMany({
    where: {
      categorieId: categorieId ?? undefined,
      fournisseur: fournisseur ? { contains: fournisseur, mode: 'insensitive' } : undefined,
    },
    include: { categorie: true },
    orderBy: { dateFacture: 'desc' },
    take: 300,
  })

  return NextResponse.json(factures)
}

// §11.2 : Ajouter une facture d'achat (multi-fichiers possible en un dépôt)
export async function POST(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const formData = await req.formData()
  const files = formData.getAll('file') as File[]
  const fournisseur = formData.get('fournisseur') as string
  const categorieId = (formData.get('categorieId') as string) || null
  const dateFacture = formData.get('dateFacture') as string
  const montantTtc = Number(formData.get('montantTtc'))
  const note = (formData.get('note') as string) || null

  if (files.length === 0 || !fournisseur || !dateFacture || !montantTtc) {
    return NextResponse.json({ message: 'Champs obligatoires manquants.' }, { status: 422 })
  }

  // Un seul justificatif comptable par dépôt : si plusieurs fichiers sont
  // sélectionnés (ex. scan multi-pages), seul le premier est retenu comme
  // pièce jointe principale pour éviter de dupliquer le montant.
  const saved = await saveUploadedFile(files[0], 'factures-achat')
  const facture = await prisma.factureAchat.create({
    data: {
      fournisseur,
      categorieId,
      dateFacture: new Date(dateFacture),
      montantTtc,
      fichierUrl: saved.url,
      nomFichier: saved.nomFichier,
      note,
    },
  })

  return NextResponse.json([facture], { status: 201 })
}
