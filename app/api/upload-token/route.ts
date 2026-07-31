import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { issueUploadToken } from '@/lib/upload-token'
import { clientIpFromRequest, isRateLimited } from '@/lib/rate-limit'

// Mints a short-lived, client-scoped upload token so the browser can upload
// documents directly to POST /api/documents without ever holding
// PARTNER_API_KEY. Only callable server-to-server, immediately after the
// partner site creates the client.
export async function POST(req: Request) {
  const token = await getActor(req)
  if (!token || token.kind !== 'partner') {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  // This endpoint is already gated by PARTNER_API_KEY, so it's not directly
  // browser-reachable — the limit here is a backstop in case that key ever
  // leaks, not the primary defense.
  if (isRateLimited(`upload-token:${clientIpFromRequest(req)}`, 60, 5 * 60 * 1000)) {
    return NextResponse.json({ message: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const clientId = body?.clientId
  if (!clientId || typeof clientId !== 'string') {
    return NextResponse.json({ message: 'clientId requis.' }, { status: 422 })
  }

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } })
  if (!client) {
    return NextResponse.json({ message: 'Client introuvable.' }, { status: 404 })
  }

  const { token: uploadToken, expiresAt } = await issueUploadToken(clientId)
  return NextResponse.json({ token: uploadToken, expiresAt })
}
