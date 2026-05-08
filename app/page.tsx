import { redirect } from 'next/navigation'

import { cookies } from 'next/headers'

import { SESSION_COOKIE } from '@/lib/constants'
import { requireSessionSecret } from '@/lib/session'
import { jwtVerify } from 'jose'

export default async function HomePage() {
  const secret = requireSessionSecret()
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (secret && token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret))
      redirect('/crm')
    } catch {
      /* ignore */
    }
  }

  redirect('/login')
}
