import { SignJWT, jwtVerify } from 'jose'

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? 'dev-secret-change-in-production-min-64-chars',
)

const ACCESS_TTL = parseInt(process.env.JWT_ACCESS_TTL ?? '3600', 10)

export interface SessionPayload {
  sub: string        // user UUID
  telegramId: string // Telegram user ID as string (BigInt-safe)
  role: string
  iat?: number
  exp?: number
}

export async function signAccessToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(ACCESS_SECRET)
}

export async function verifyAccessToken(token: string): Promise<SessionPayload> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET)
    return payload as unknown as SessionPayload
  } catch {
    throw new Error('INVALID_TOKEN')
  }
}

export function setAuthCookie(token: string): string {
  const maxAge = ACCESS_TTL
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `hulu_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`
}

export function clearAuthCookie(): string {
  return 'hulu_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
}

export function getTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/hulu_session=([^;]+)/)
  return match?.[1] ?? null
}
