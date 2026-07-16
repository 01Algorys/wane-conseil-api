import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { readFile, stat } from 'fs/promises'
import path from 'path'
import { resolveStoragePath } from '@/lib/storage'

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const token = await getActor(req)
  if (token?.kind !== 'user') {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const { path: segments } = await params
  const relativePath = segments.join('/')
  const filePath = resolveStoragePath(relativePath)

  try {
    const stats = await stat(filePath)
    if (!stats.isFile()) throw new Error('not a file')
    const buffer = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch {
    return NextResponse.json({ message: 'Fichier introuvable.' }, { status: 404 })
  }
}
