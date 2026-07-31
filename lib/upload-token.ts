import { encode, decode } from 'next-auth/jwt'

export interface UploadTokenPayload {
  clientId: string
}

const secret = process.env.AUTH_SECRET as string
// Distinct salt from the staff-session token (lib/auth-token.ts) so an upload
// token can never decode as a staff session or vice versa — the two token
// kinds are cryptographically namespaced, not just distinguished by a field.
const salt = 'wn-conseil-api-upload-token'
// Long enough to survive a user pausing mid-form (re-picking a photo, going to
// find a physical document) without the retry silently 401ing; still bounded.
const UPLOAD_TOKEN_TTL_SECONDS = 45 * 60

// Short-lived, single-client-scoped token so the browser can upload documents
// directly to this API without ever holding PARTNER_API_KEY. Minted
// server-to-server (partner-authenticated) right after client creation.
export async function issueUploadToken(clientId: string): Promise<{ token: string; expiresAt: string }> {
  const token = await encode({
    token: { clientId, kind: 'upload' },
    secret,
    salt,
    maxAge: UPLOAD_TOKEN_TTL_SECONDS,
  })
  return { token, expiresAt: new Date(Date.now() + UPLOAD_TOKEN_TTL_SECONDS * 1000).toISOString() }
}

export async function verifyUploadToken(token: string): Promise<UploadTokenPayload | null> {
  try {
    const decoded = await decode({ token, secret, salt })
    if (!decoded || decoded.kind !== 'upload' || typeof decoded.clientId !== 'string') return null
    return { clientId: decoded.clientId }
  } catch {
    return null
  }
}
