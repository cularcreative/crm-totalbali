import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { LoginForm } from '@/components/LoginForm'
import { SESSION_COOKIE } from '@/lib/constants'
import { requireSessionSecret } from '@/lib/session'
import { jwtVerify } from 'jose'

export default async function LoginPage() {
  const secret = requireSessionSecret()
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value

  if (secret && token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret))
      redirect('/crm')
    } catch {
      /* stale cookie */
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse at top, rgba(74,143,168,0.18) 0%, transparent 55%), #f5f0e8',
        padding: 24,
        fontFamily:
          'var(--font-dm-sans), DM Sans, system-ui, Segoe UI, sans-serif',
      }}
    >
      <LoginForm />
    </div>
  )
}
