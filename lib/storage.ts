import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

// Stockage local pour la V1 (§7.3 recommande S3/Cloudinary en cible).
// Les fichiers sont hors de /public et servis via /api/files/[...path]
// (route protégée par auth), ce qui évite les liens publics permanents.
const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'uploads')

export const MAX_FILE_SIZE = 40 * 1024 * 1024 // 40 Mo
export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/heic']

export function sanitizeSegment(segment: string) {
  return segment.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80)
}

export async function saveUploadedFile(file: File, folder: string) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Fichier trop volumineux (max ${MAX_FILE_SIZE / (1024 * 1024)} Mo)`)
  }

  const safeFolder = folder
    .split('/')
    .map(sanitizeSegment)
    .join('/')

  const dir = path.join(STORAGE_ROOT, safeFolder)
  await mkdir(dir, { recursive: true })

  const ext = path.extname(file.name) || ''
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
