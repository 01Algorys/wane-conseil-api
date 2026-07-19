import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { resendEmailLog } from '@/lib/email'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || token.kind !== 'user' || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) return null
  return token
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const { id } = await params
  try {
    await resendEmailLog(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Échec du renvoi.' },
      { status: 500 }
    )
  }
}
