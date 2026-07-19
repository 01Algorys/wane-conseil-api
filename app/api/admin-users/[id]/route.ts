import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/audit'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req)
  if (!actor || actor.kind !== 'user' || actor.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const { id } = await params
  if (id === actor.id) {
    return NextResponse.json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(target.role)) {
    return NextResponse.json({ message: 'Compte administrateur introuvable.' }, { status: 404 })
  }

  await prisma.admin.deleteMany({ where: { userId: id } })
  await prisma.user.delete({ where: { id } })
  void logActivity({ userId: actor.id as string, action: 'ADMIN_USER_DELETED', details: `${target.email} (${target.role})`, req })

  return NextResponse.json({ success: true })
}
