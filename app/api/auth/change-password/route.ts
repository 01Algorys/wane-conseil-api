import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/audit'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères.'),
})

export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor || actor.kind !== 'user') {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 422 })
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id as string } })
  const matches = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!matches) {
    void logActivity({ userId: user.id, action: 'PASSWORD_CHANGE_FAILED', details: 'Mot de passe actuel incorrect', req })
    return NextResponse.json({ message: 'Mot de passe actuel incorrect.' }, { status: 401 })
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
  void logActivity({ userId: user.id, action: 'PASSWORD_CHANGED', req })

  return NextResponse.json({ success: true })
}
