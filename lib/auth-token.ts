import { encode, decode } from 'next-auth/jwt'

export type TokenPayload = {
  id: string
  role: string
  firstName: string
  lastName: string
  email: string
}

const secret = process.env.AUTH_SECRET as string
// Fixed salt for this single-purpose token (must match on encode/decode; not a secret itself).
const salt = 'wn-conseil-api-token'

export async function issueToken(payload: TokenPayload) {
  return encode({
    token: { ...payload, name: `${payload.firstName} ${payload.lastName}` },
    secret,
    salt,
    maxAge: 30 * 24 * 60 * 60,
  })
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const decoded = await decode({ token, secret, salt })
    if (!decoded) return null
    return {
      id: decoded.id as string,
      role: decoded.role as string,
      firstName: decoded.firstName as string,
      lastName: decoded.lastName as string,
      email: decoded.email as string,
    }
  } catch {
    return null
  }
}
