import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/audit'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor || actor.kind !== 'user' || !['SUPER_ADMIN', 'ADMIN'].includes(actor.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'COMMERCIAL', 'SUPER_ADMIN'] } },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(users)
}

const createSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL']),
})

export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor || actor.kind !== 'user' || actor.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Données invalides', errors: parsed.error.flatten() }, { status: 422 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ message: 'Cet email est déjà utilisé.' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12)
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role,
      adminProfile: { create: {} },
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
  })

  void logActivity({ userId: actor.id as string, action: 'ADMIN_USER_CREATED', details: `${user.email} (${user.role})`, req })

  return NextResponse.json(user, { status: 201 })
}
