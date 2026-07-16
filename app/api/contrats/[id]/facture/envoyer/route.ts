import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { resolveStoragePath } from '@/lib/storage'
import { readFile } from 'fs/promises'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

const sendSchema = z.object({
  email: z.string().email(),
  objet: z.string().min(1),
  message: z.string().min(1),
})

// §6.2 : Envoyer la facture — fenêtre de confirmation, envoi email, passe
// statut_envoi à ENVOYEE avec horodatage. Rejouable en cas de renvoi.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Données invalides', errors: parsed.error.flatten() }, { status: 422 })
  }

  const facture = await prisma.facture.findFirst({ where: { contratId: id, isActive: true } })
  if (!facture) return NextResponse.json({ message: 'Aucune facture active pour ce contrat.' }, { status: 404 })

  const relativePath = facture.fichierPdfUrl.replace(/^\/api\/files\//, '')
  const buffer = await readFile(resolveStoragePath(relativePath))

  try {
    await sendEmail({
      to: parsed.data.email,
      subject: parsed.data.objet,
      html: parsed.data.message.replace(/\n/g, '<br/>'),
      text: parsed.data.message,
      attachments: [{ filename: `${facture.numeroFacture}.pdf`, content: buffer }],
    })
  } catch (err) {
    await prisma.facture.update({ where: { id: facture.id }, data: { statutEnvoi: 'ERREUR' } })
    return NextResponse.json({ message: err instanceof Error ? err.message : "Échec de l'envoi." }, { status: 502 })
  }

  const updated = await prisma.facture.update({
    where: { id: facture.id },
    data: {
      statutEnvoi: 'ENVOYEE',
      dateEnvoi: new Date(),
      modeEnvoi: 'EMAIL',
      emailDestinataire: parsed.data.email,
    },
  })

  return NextResponse.json(updated)
}
