import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, getTokenFromCookies } from '@/lib/auth'
import { prisma } from '@hulu/db'
import {
  getReferralStats,
  getOrCreateReferralLink,
} from '@/lib/referral-service'

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req.headers.get('cookie'))
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await verifyAccessToken(token)

    const user = await prisma.user.findUnique({ where: { id: session.sub } })
    if (!user || user.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const displayName = user.firstName ?? user.username ?? 'Student'

    // Get or create referral link + stats in parallel
    const [referralLink, stats] = await Promise.all([
      getOrCreateReferralLink(user.id, displayName),
      getReferralStats(user.id),
    ])

    return NextResponse.json({
      inviteUrl: referralLink.inviteUrl,
      shareMessage: `Join Hulu Academy's official freshman channel for academic updates and tutorial resources. Use my link to join: ${referralLink.inviteUrl}`,
      ...stats,
    })
  } catch (error) {
    console.error('Referral GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
