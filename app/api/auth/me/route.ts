import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (actor?.kind !== 'user') {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const { id, role, firstName, lastName, email } = actor
  return NextResponse.json({ user: { id, role, firstName, lastName, email } })
}
