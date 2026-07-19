import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getActor(req)
  if (!token || token.kind !== 'user' || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const { id } = await params
  const email = await prisma.emailLog.findUnique({ where: { id } })
  if (!email) return NextResponse.json({ message: 'Email introuvable.' }, { status: 404 })
  return NextResponse.json(email)
}
