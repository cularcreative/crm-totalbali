import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/constants'
import { createSessionToken, requireSessionSecret } from '@/lib/session'

export async function POST(request: Request) {
  const secret = requireSessionSecret()
  const configuredPassword = process.env.CRM_LOGIN_PASSWORD?.trim()
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'Server missing CRM_SESSION_SECRET' },
      { status: 500 },
    )
  }
  if (!configuredPassword) {
    return NextResponse.json(
      { ok: false, error: 'Server missing CRM_LOGIN_PASSWORD' },
      { status: 500 },
    )
  }

  let password = ''
  const contentType = request.headers.get('content-type') || ''
  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { password?: string }
      password = String(body.password ?? '')
    } else {
      const fd = await request.formData()
      password = String(fd.get('password') ?? '')
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 })
  }

  if (password !== configuredPassword) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createSessionToken(secret)
  const jar = await cookies()
  jar.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  })

  return NextResponse.json({ ok: true })
}
