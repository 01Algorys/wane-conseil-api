import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { issueToken } from '@/lib/auth-token'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Identifiants invalides.' }, { status: 422 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ message: 'Identifiants invalides.' }, { status: 401 })
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, user.password)
  if (!passwordMatches) {
    return NextResponse.json({ message: 'Identifiants invalides.' }, { status: 401 })
  }

  const payload = {
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  }
  const token = await issueToken(payload)

  return NextResponse.json({ token, user: payload })
}
