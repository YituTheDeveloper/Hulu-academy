import { NextRequest } from 'next/server'
import { verifyAccessToken, getTokenFromCookies } from '@/lib/auth'
import { prisma } from '@hulu/db'
import type { User } from '@hulu/db'

/**
 * Middleware-style admin guard. Returns the admin user or throws.
 */
export async function requireAdmin(req: NextRequest): Promise<User> {
  const token = getTokenFromCookies(req.headers.get('cookie'))
  if (!token) throw new Error('UNAUTHORIZED')

  const session = await verifyAccessToken(token)

  // The signed token establishes identity. The database role is authoritative
  // so admins promoted during an existing session can use admin routes at once.
  const user = await prisma.user.findUnique({ where: { id: session.sub } })
  if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
    throw new Error('FORBIDDEN')
  }

  return user
}

export function adminError(code: string, status: number) {
  const Response = require('next/server').NextResponse
  const message = code === 'UNAUTHORIZED' ? 'Unauthorized' : 'Forbidden'
  return Response.json({ error: message }, { status })
}
