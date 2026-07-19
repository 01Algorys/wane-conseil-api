import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { saveUploadedFile } from '@/lib/storage'
import { Prisma } from '@prisma/client'

const PAGE_SIZE = 30

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

// Partner sites (e.g. tempassur) upload documents server-to-server right after
// creating a devis, before any CRM user account is involved; they never need to
// list/browse documents, so partner access is POST-only (mirrors devis/contrats).
async function requireWriteAuth(req: Request) {
  const token = await getActor(req)
  if (!token) return null
  if (token.kind === 'partner') return token
  if (['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return token
  return null
}

export async function GET(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  const contratId = searchParams.get('contratId')
  const statutDocument = searchParams.get('statutDocument')
  const typeDocumentId = searchParams.get('typeDocumentId')

  if (!searchParams.has('full')) {
    const documents = await prisma.document.findMany({
      where: {
        clientId: clientId ?? undefined,
        contratId: contratId ?? undefined,
        statutDocument: statutDocument ?? undefined,
        typeDocumentId: typeDocumentId ?? undefined,
      },
      include: {
        client: true,
        contrat: true,
        typeDocumentRef: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })
    return NextResponse.json(documents)
  }

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const search = searchParams.get('q')?.trim()

  const where: Prisma.DocumentWhereInput = {
    AND: [
      search
        ? {
            OR: [
              { nom: { contains: search, mode: 'insensitive' } },
              { client: { nom: { contains: search, mode: 'insensitive' } } },
              { client: { prenom: { contains: search, mode: 'insensitive' } } },
              { contrat: { numero: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {},
      statutDocument ? { statutDocument } : {},
      typeDocumentId ? { typeDocumentId } : {},
    ],
  }

  const [documents, total, types, missingCount] = await Promise.all([
    prisma.document.findMany({
      where,
      include: { client: true, contrat: true, typeDocumentRef: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.document.count({ where }),
    prisma.listeReference.findMany({ where: { type: 'TYPE_DOCUMENT', actif: true }, orderBy: { ordre: 'asc' } }),
    prisma.document.count({ where: { statutDocument: 'MANQUANT' } }),
  ])

  return NextResponse.json({ documents, total, types, missingCount })
}

// Upload multi-fichiers (§7.2) : formData avec un ou plusieurs "file" +
// clientId/contratId optionnels + typeDocumentId (ou typeDocumentLabel, résolu
// ci-dessous — le site partenaire ne connaît pas les ids de référentiel internes)
// + libelleAutre optionnel.
export async function POST(req: Request) {
  const token = await requireWriteAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const formData = await req.formData()
  const files = formData.getAll('file') as File[]
  const clientId = (formData.get('clientId') as string) || null
  const contratId = (formData.get('contratId') as string) || null
  let typeDocumentId = (formData.get('typeDocumentId') as string) || null
  const typeDocumentLabel = (formData.get('typeDocumentLabel') as string) || null
  const libelleAutre = (formData.get('libelleAutre') as string) || null

  if (files.length === 0) {
    return NextResponse.json({ message: 'Aucun fichier fourni.' }, { status: 422 })
  }
  if (!clientId && !contratId) {
    return NextResponse.json({ message: 'Un document doit être lié à un client ou un contrat.' }, { status: 422 })
  }

  if (!typeDocumentId && typeDocumentLabel) {
    const ref = await prisma.listeReference.findFirst({
      where: { type: 'TYPE_DOCUMENT', nom: { equals: typeDocumentLabel, mode: 'insensitive' } },
    })
    typeDocumentId = ref?.id ?? null
  }

  const folder = `${clientId ?? 'divers'}/${contratId ?? 'client'}`
  const created = []

  for (const file of files) {
    try {
      const saved = await saveUploadedFile(file, folder)
      const doc = await prisma.document.create({
        data: {
          nom: saved.nomFichier,
          type: file.type || 'application/octet-stream',
          url: saved.url,
          taille: saved.taille,
          clientId,
          contratId,
          typeDocumentId,
          libelleAutre,
          statutDocument: 'EN_ATTENTE',
        },
      })
      created.push(doc)
    } catch (err) {
      return NextResponse.json({ message: err instanceof Error ? err.message : 'Échec upload' }, { status: 422 })
    }
  }

  return NextResponse.json(created, { status: 201 })
}
