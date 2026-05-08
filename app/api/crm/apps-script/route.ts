import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

import { SESSION_COOKIE } from '@/lib/constants'
import { requireSessionSecret, verifySessionToken } from '@/lib/session'

function backendConfigured(): {
  configured: boolean
  url?: string
  key?: string
} {
  const url = process.env.CRM_APPS_SCRIPT_URL?.trim()
  const key = process.env.CRM_APPS_SCRIPT_API_KEY?.trim()
  if (!url || !key || url.includes('YOUR_') || url.includes('PASTE_YOUR')) {
    return { configured: false }
  }
  return { configured: true, url, key }
}

async function requireCrmAuth() {
  const secret = requireSessionSecret()
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 }) as Response
  }

  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as Response
  }

  try {
    const ok = await verifySessionToken(secret, token)
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as Response
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as Response
  }

  return null
}

export async function GET(request: NextRequest) {
  const authResp = await requireCrmAuth()
  if (authResp) return authResp as NextResponse

  const api = backendConfigured()
  const action = request.nextUrl.searchParams.get('action') || ''

  if (!api.configured) {
    if (action === 'getAll') {
      return NextResponse.json({
        success: false,
        backendConfigured: false,
        enquiries: [],
        archived: [],
        stays: {},
        activities: [],
      })
    }
    return NextResponse.json(
      { error: 'CRM backend not configured', backendConfigured: false },
      { status: 503 },
    )
  }

  try {
    const url = new URL(api.url!)
    url.searchParams.set('action', action)
    url.searchParams.set('key', api.key!)
    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const text = await res.text()
    try {
      return NextResponse.json(JSON.parse(text), { status: res.status })
    } catch {
      return NextResponse.json(
        { error: 'Upstream returned non-JSON', raw: text.slice(0, 200) },
        { status: 502 },
      )
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const authResp = await requireCrmAuth()
  if (authResp) return authResp as NextResponse

  const api = backendConfigured()
  const action = request.nextUrl.searchParams.get('action') || ''

  if (!api.configured) {
    return NextResponse.json(
      { error: 'CRM backend not configured', backendConfigured: false },
      { status: 503 },
    )
  }

  const rawBody = await request.text()

  try {
    const url = new URL(api.url!)
    url.searchParams.set('action', action)
    url.searchParams.set('key', api.key!)

    const res = await fetch(url.toString(), {
      method: 'POST',
      redirect: 'follow',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: rawBody,
      cache: 'no-store',
    })

    const text = await res.text()
    try {
      return NextResponse.json(JSON.parse(text), { status: res.status })
    } catch {
      return NextResponse.json(
        { error: 'Upstream returned non-JSON', raw: text.slice(0, 200) },
        { status: 502 },
      )
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
