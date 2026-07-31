// Finds documents uploaded during an abandoned/failed subscription: attached
// to a Client, never attached to a Contrat, and that Client never produced a
// Devis (i.e. the person picked photos and left, or the upload succeeded but
// devis creation failed and they never retried). These accumulate real PII
// (driver's licenses, registration cards) with no natural expiry otherwise.
//
// Deliberately scoped to NEVER touch a document that's attached to a Contrat,
// or whose Client has ANY Devis (even a lost/abandoned one) — only documents
// with no downstream record at all are candidates. Existing, properly-linked
// documents are untouched by this script under any flag combination.
//
// Dry-run by default — prints what WOULD be deleted. Pass --delete to
// actually remove files + DB rows. Pass --days=N to change the age threshold
// (default 30).
//
// Usage:
//   tsx scripts/cleanup-orphan-documents.ts                  # report only
//   tsx scripts/cleanup-orphan-documents.ts --days=14         # different threshold, still dry-run
//   tsx scripts/cleanup-orphan-documents.ts --delete          # actually delete
import { unlink } from 'fs/promises'
import { PrismaClient } from '@prisma/client'
import { resolveStoragePath } from '../lib/storage'

const prisma = new PrismaClient()

function parseArgs() {
  const args = process.argv.slice(2)
  const shouldDelete = args.includes('--delete')
  const daysArg = args.find((a) => a.startsWith('--days='))
  const days = daysArg ? Number(daysArg.split('=')[1]) : 30
  if (!Number.isFinite(days) || days <= 0) {
    console.error('--days must be a positive number')
    process.exit(1)
  }
  return { shouldDelete, days }
}

async function main() {
  const { shouldDelete, days } = parseArgs()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const orphans = await prisma.document.findMany({
    where: {
      clientId: { not: null },
      contratId: null,
      createdAt: { lt: cutoff },
      client: { devis: { none: {} } },
    },
    select: { id: true, url: true, nom: true, clientId: true, createdAt: true },
  })

  if (orphans.length === 0) {
    console.log(`No orphan documents older than ${days} day(s).`)
    return
  }

  console.log(`${orphans.length} orphan document(s) older than ${days} day(s)${shouldDelete ? ' — deleting' : ' — DRY RUN, pass --delete to actually remove'}:`)
  for (const doc of orphans) {
    console.log(`  ${doc.id}  client=${doc.clientId}  ${doc.nom}  uploaded=${doc.createdAt.toISOString()}`)
  }

  if (!shouldDelete) return

  for (const doc of orphans) {
    try {
      const relativePath = doc.url.replace(/^\/api\/files\//, '')
      await unlink(resolveStoragePath(relativePath)).catch((err) => {
        // File already gone from disk shouldn't block cleaning up the DB row.
        if (err?.code !== 'ENOENT') throw err
      })
      await prisma.document.delete({ where: { id: doc.id } })
      console.log(`  deleted ${doc.id}`)
    } catch (error) {
      console.error(`  failed to delete ${doc.id}:`, error)
    }
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
