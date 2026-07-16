import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getActor } from '@/lib/request-actor'

const createUserSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6),
  password: z.string().min(8),
  type: z.enum(['PARTICULIER', 'PROFESSIONNEL']),
  consent: z.boolean(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parseResult = createUserSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ message: 'Payload invalide', errors: parseResult.error.flatten() }, { status: 422 })
  }

  const { firstName, lastName, email, phone, password, type, consent } = parseResult.data

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return NextResponse.json({ message: 'Cet email est déjà utilisé.' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      consentAt: consent ? new Date() : null,
      role: 'CLIENT',
      clientProfile: {
        create: {
          type: type === 'PROFESSIONNEL' ? 'PROFESSIONNEL' : 'PARTICULIER',
        },
      },
    },
    include: { clientProfile: true },
  })

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
}

export async function GET(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'COMMERCIAL', 'SUPER_ADMIN'] } },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(users)
}
