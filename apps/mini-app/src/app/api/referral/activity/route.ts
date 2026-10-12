import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, getTokenFromCookies } from '@/lib/auth'
import { prisma } from '@hulu/db'
import { getReferralActivity } from '@/lib/referral-service'
import { ReferralActivityQuerySchema } from '@hulu/validation'

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req.headers.get('cookie'))
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await verifyAccessToken(token)
    const user = await prisma.user.findUnique({ where: { id: session.sub } })
    if (!user || user.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = ReferralActivityQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    )
    if (!query.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
    }

    const activity = await getReferralActivity(user.id, query.data.page, query.data.limit)
    return NextResponse.json(activity)
  } catch (error) {
    console.error('Referral activity GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
