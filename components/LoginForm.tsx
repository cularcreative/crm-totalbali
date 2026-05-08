'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Sign-in failed')
        return
      }
      router.replace('/crm')
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        width: '100%',
        maxWidth: 380,
        margin: '12vh auto 0',
        padding: '36px 32px',
        background: '#fefcf8',
        borderRadius: 12,
        border: '1px solid #e8dfc8',
        boxShadow: '0 20px 50px rgba(26,58,74,0.12)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div
          style={{
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: 1,
            color: '#1a1208',
          }}
        >
          Total <span style={{ color: '#c49a2a' }}>Bali</span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#7a6a50',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginTop: 6,
          }}
        >
          Reservations CRM
        </div>
      </div>

      <label
        htmlFor="pw"
        style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#7a6a50', marginBottom: 6 }}
      >
        Password
      </label>
      <input
        id="pw"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Team password"
        required
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 6,
          border: '1px solid #e8dfc8',
          fontSize: 14,
          marginBottom: 16,
        }}
      />

      {error ? (
        <div
          style={{
            color: '#c0392b',
            fontSize: 13,
            marginBottom: 12,
            padding: '8px 10px',
            background: '#fdecea',
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        style={{
          width: '100%',
          padding: '11px 16px',
          border: 'none',
          borderRadius: 6,
          background: '#1a3a4a',
          color: 'white',
          fontSize: 14,
          fontWeight: 500,
          cursor: pending ? 'wait' : 'pointer',
          opacity: pending ? 0.72 : 1,
        }}
      >
        {pending ? 'Signing in…' : 'Enter CRM'}
      </button>

      <p style={{ marginTop: 18, fontSize: 12, color: '#7a6a50', textAlign: 'center', lineHeight: 1.5 }}>
        This area is restricted to authorised Total Bali staff.
      </p>
    </form>
  )
}
