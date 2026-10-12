import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@hulu/db'
import { verifyAccessToken, getTokenFromCookies } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req.headers.get('cookie'))
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await verifyAccessToken(token)

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        telegramUserId: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        lastSeenAt: true,
      },
    })

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (user.status === 'SUSPENDED') return NextResponse.json({ error: 'Account suspended' }, { status: 403 })

    return NextResponse.json({
      ...user,
      telegramUserId: String(user.telegramUserId), // BigInt to string for JSON safety
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
