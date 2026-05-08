import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { SESSION_COOKIE } from '@/lib/constants'

export async function POST() {
  const jar = await cookies()
  jar.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0,
  })
  return NextResponse.json({ ok: true })
}
