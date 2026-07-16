import { verifyToken } from './auth-token'

/**
 * Drop-in replacement for the old `getToken({ req, secret })` calls.
 * Reads a bearer token from the Authorization header instead of a cookie,
 * so the same role checks (`token.role as string`) keep working unchanged.
 * A request authenticated with PARTNER_API_KEY comes back as `{ kind: 'partner' }`
 * (no id/role/email fields), so it fails every existing role check by default
 * unless a route explicitly special-cases `kind === 'partner'`.
 */
export async function getActor(req: Request): Promise<Record<string, unknown> | null> {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const value = header.slice('Bearer '.length).trim()
  if (!value) return null

  if (process.env.PARTNER_API_KEY && value === process.env.PARTNER_API_KEY) {
    return { kind: 'partner' }
  }

  const payload = await verifyToken(value)
  if (!payload) return null
  return { kind: 'user', ...payload }
}
