import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

// Stockage local pour la V1 (§7.3 recommande S3/Cloudinary en cible).
// Les fichiers sont hors de /public et servis via /api/files/[...path]
// (route protégée par auth), ce qui évite les liens publics permanents.
const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'uploads')

export const MAX_FILE_SIZE = 40 * 1024 * 1024 // 40 Mo
export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/heic']

// MIME-to-extension allowlist, checked together: `file.type` is browser-supplied
// and spoofable on its own, and a bare extension check is spoofable on its own —
// requiring both to agree on a known-safe pair is what actually blocks a
// disguised .html/.svg/.php upload from landing on disk and being served back
// via /api/files/[...path].
const EXTENSIONS_BY_TYPE: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/heic': ['.heic'],
}

export function sanitizeSegment(segment: string) {
  return segment.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80)
}

export async function saveUploadedFile(file: File, folder: string) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Fichier trop volumineux (max ${MAX_FILE_SIZE / (1024 * 1024)} Mo)`)
  }

  const allowedExtensions = EXTENSIONS_BY_TYPE[file.type]
  if (!allowedExtensions) {
    throw new Error(`Type de fichier non autorisé (${file.type || 'inconnu'})`)
  }
  const ext = path.extname(file.name).toLowerCase()
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`Extension de fichier non autorisée (${ext || 'aucune'})`)
  }

  const safeFolder = folder
    .split('/')
    .map(sanitizeSegment)
    .join('/')

  const dir = path.join(STORAGE_ROOT, safeFolder)
  await mkdir(dir, { recursive: true })

  const uniqueName = `${randomUUID()}${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(dir, uniqueName), buffer)

  const relativePath = `${safeFolder}/${uniqueName}`
  return {
    relativePath,
    url: `/api/files/${relativePath}`,
    nomFichier: file.name,
    taille: file.size,
  }
}

export function resolveStoragePath(relativePath: string) {
  const normalized = path.normalize(relativePath).replace(/^([.]{2}[/\\])+/, '')
  return path.join(STORAGE_ROOT, normalized)
}

export async function savePdfBuffer(buffer: Buffer, folder: string, filename: string) {
  const safeFolder = folder.split('/').map(sanitizeSegment).join('/')
  const dir = path.join(STORAGE_ROOT, safeFolder)
  await mkdir(dir, { recursive: true })
  const safeName = sanitizeSegment(filename) + '.pdf'
  await writeFile(path.join(dir, safeName), buffer)
  const relativePath = `${safeFolder}/${safeName}`
  return { relativePath, url: `/api/files/${relativePath}` }
}
