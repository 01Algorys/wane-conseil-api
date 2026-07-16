import { NextResponse } from 'next/server'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parseResult = forgotPasswordSchema.safeParse(body)

  if (!parseResult.success) {
    return NextResponse.json({ message: 'Email invalide.' }, { status: 422 })
  }

  console.log('[forgot-password]', parseResult.data.email, 'request received. Send reset link or OTP here.')

  return NextResponse.json({ message: 'Si l’email est enregistré, un lien de réinitialisation a été envoyé.' })
}
