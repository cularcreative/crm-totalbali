import { SignJWT, jwtVerify } from 'jose'

import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from './constants'

export function requireSessionSecret(): string | null {
  const s = process.env.CRM_SESSION_SECRET?.trim()
  return s?.length ? s : null
}

export async function createSessionToken(secret: string) {
  return new SignJWT({ sub: 'crm' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(new TextEncoder().encode(secret))
}

export async function verifySessionToken(secret: string, token: string) {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
  return payload.sub === 'crm'
}

/** Read session cookie value from Headers (middleware / Route Handlers). */
export function getSessionTokenFromCookies(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    const [name, ...rest] = trimmed.split('=')
    if (name.trim() === SESSION_COOKIE) {
      return rest.join('=')?.trim()
    }
  }
  return undefined
}
