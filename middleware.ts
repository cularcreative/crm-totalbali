import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

import { SESSION_COOKIE } from './lib/constants'

export async function middleware(request: NextRequest) {
  const secret = process.env.CRM_SESSION_SECRET?.trim()
  const token = request.cookies.get(SESSION_COOKIE)?.value

  if (!secret || !token) {
    if (request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret))
    return NextResponse.next()
  } catch {
    if (request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/crm/:path*', '/api/crm/:path*'],
}
