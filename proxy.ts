import { NextResponse, type NextRequest } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export default function middleware(req: NextRequest) {
  const origin = process.env.FRONTEND_ORIGIN ?? ''

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: { ...CORS_HEADERS, 'Access-Control-Allow-Origin': origin },
    })
  }

  const response = NextResponse.next()
  response.headers.set('Access-Control-Allow-Origin', origin)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
