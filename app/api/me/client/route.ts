import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (actor?.kind !== 'user') {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const client = await prisma.client.findUnique({
    where: { userId: actor.id as string },
    include: {
      contrats: { orderBy: { dateDebut: 'desc' } },
      documents: { orderBy: { createdAt: 'desc' } },
      leads: { orderBy: { createdAt: 'desc' } },
      user: true,
    },
  })

  if (!client) return NextResponse.json({ message: 'Profil client introuvable.' }, { status: 404 })
  return NextResponse.json(client)
}
