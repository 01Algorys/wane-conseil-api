import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token) return null
  if (token.kind === 'partner') return token
  if (['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return token
  return null
}

const REQUIRED_DOCS = [
  { key: 'permisRecto', nom: 'Permis de conduire', libelleAutre: 'Recto' },
  { key: 'permisVerso', nom: 'Permis de conduire', libelleAutre: 'Verso' },
  { key: 'carteGrise', nom: 'Carte grise', libelleAutre: null as string | null },
]

// Server-to-server check the partner site calls right before creating a devis
// — the CRM (not the browser, not the partner's own upload bookkeeping) is
// the source of truth for whether the required documents actually landed.
export async function GET(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ message: 'clientId requis.' }, { status: 422 })

  const documents = await prisma.document.findMany({
    where: { clientId },
    include: { typeDocumentRef: true },
  })

  const result: Record<string, boolean> = {}
  for (const required of REQUIRED_DOCS) {
    result[required.key] = documents.some(
      (doc) =>
        doc.typeDocumentRef?.nom === required.nom &&
        (required.libelleAutre ? doc.libelleAutre === required.libelleAutre : true)
    )
  }

  return NextResponse.json(result)
}
