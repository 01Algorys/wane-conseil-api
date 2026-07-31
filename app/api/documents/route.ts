import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { saveUploadedFile } from '@/lib/storage'
import { verifyUploadToken } from '@/lib/upload-token'
import { clientIpFromRequest, isRateLimited } from '@/lib/rate-limit'
import { Prisma } from '@prisma/client'

const PAGE_SIZE = 30

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

interface WriteAuth {
  // Set when authenticated via a short-lived upload token (browser uploading
  // directly) — the request may only touch this exact client's documents.
  // null for partner/staff auth, which isn't client-scoped.
  scopeClientId: string | null
}

// Partner sites (e.g. tempassur) create documents server-to-server, and the
// browser now uploads directly using a short-lived, client-scoped upload
// token minted via POST /api/upload-token (see lib/upload-token.ts) — neither
// needs to list/browse documents, so write access is POST-only (mirrors
// devis/contrats).
async function requireWriteAuth(req: Request): Promise<WriteAuth | null> {
  const header = req.headers.get('authorization')
  if (header?.startsWith('Bearer ')) {
    const uploadPayload = await verifyUploadToken(header.slice('Bearer '.length).trim())
    if (uploadPayload) return { scopeClientId: uploadPayload.clientId }
  }

  const token = await getActor(req)
  if (!token) return null
  if (token.kind === 'partner') return { scopeClientId: null }
  if (['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return { scopeClientId: null }
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
const UPLOAD_RATE_LIMIT = { max: 30, windowMs: 5 * 60 * 1000 } // 30 uploads / 5 min / IP

export async function POST(req: Request) {
  const auth = await requireWriteAuth(req)
  if (!auth) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  if (isRateLimited(`documents:${clientIpFromRequest(req)}`, UPLOAD_RATE_LIMIT.max, UPLOAD_RATE_LIMIT.windowMs)) {
    return NextResponse.json({ message: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 })
  }

  const formData = await req.formData()
  const files = formData.getAll('file') as File[]
  const clientId = (formData.get('clientId') as string) || null
  // An upload-token-scoped request may only ever create documents against its
  // own clientId, staged before any devis/contrat exists — contratId is never
  // legitimate here, so it's discarded outright rather than trusted from the
  // request. Without this, a token valid for the attacker's own client could
  // attach a document to an arbitrary contratId belonging to someone else.
  const contratId = auth.scopeClientId ? null : (formData.get('contratId') as string) || null
  let typeDocumentId = (formData.get('typeDocumentId') as string) || null
  const typeDocumentLabel = (formData.get('typeDocumentLabel') as string) || null
  const libelleAutre = (formData.get('libelleAutre') as string) || null

  if (files.length === 0) {
    return NextResponse.json({ message: 'Aucun fichier fourni.' }, { status: 422 })
  }
  if (!clientId && !contratId) {
    return NextResponse.json({ message: 'Un document doit être lié à un client ou un contrat.' }, { status: 422 })
  }
  // An upload token is minted for one specific clientId — reject any attempt
  // to attach documents to a different client.
  if (auth.scopeClientId && auth.scopeClientId !== clientId) {
    return NextResponse.json({ message: "Token non autorisé pour ce client." }, { status: 403 })
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
    const startedAt = Date.now()
    console.info('[documents] upload_start', { clientId, contratId, typeDocumentLabel, libelleAutre, fileSize: file.size })
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
      console.info('[documents] upload_success', {
        clientId,
        documentId: doc.id,
        fileSize: file.size,
        durationMs: Date.now() - startedAt,
      })
    } catch (err) {
      console.error('[documents] upload_failure', {
        clientId,
        fileSize: file.size,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      })
      return NextResponse.json({ message: err instanceof Error ? err.message : 'Échec upload' }, { status: 422 })
    }
  }

  return NextResponse.json(created, { status: 201 })
}
