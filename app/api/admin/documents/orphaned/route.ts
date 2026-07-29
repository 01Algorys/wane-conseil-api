import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { resolveStoragePath } from '@/lib/storage'
import { stat } from 'fs/promises'

// Temporary diagnostic: lists Document rows whose file is missing on disk
// (expected for anything uploaded before a persistent volume was attached
// on Railway — see storage.ts). Remove once the backlog has been triaged.
export async function GET(req: Request) {
  const token = await getActor(req)
  if (token?.kind !== 'user' || !['SUPER_ADMIN', 'ADMIN'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const documents = await prisma.document.findMany({
    include: { client: true, contrat: true },
    orderBy: { createdAt: 'asc' },
  })

  const orphaned = []
  for (const doc of documents) {
    const relativePath = doc.url.replace(/^\/api\/files\//, '')
    const filePath = resolveStoragePath(relativePath)
    try {
      const stats = await stat(filePath)
      if (!stats.isFile()) throw new Error('not a file')
    } catch {
      orphaned.push({
        id: doc.id,
        nom: doc.nom,
        createdAt: doc.createdAt,
        client: doc.client ? `${doc.client.prenom} ${doc.client.nom}` : null,
        contrat: doc.contrat?.numero ?? null,
      })
    }
  }

  return NextResponse.json({ total: documents.length, orphanedCount: orphaned.length, orphaned })
}
