import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, getTokenFromCookies } from '@/lib/auth'
import { getUserEntitlement } from '@/lib/referral-service'
import { prisma } from '@hulu/db'

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req.headers.get('cookie'))
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await verifyAccessToken(token)
    const user = await prisma.user.findUnique({ where: { id: session.sub } })
    if (!user || user.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entitlement = await getUserEntitlement(user.id)

    if (!entitlement) {
      return NextResponse.json({ hasEntitlement: false, entitlement: null })
    }

    return NextResponse.json({
      hasEntitlement: true,
      entitlement: {
        id: entitlement.id,
        status: entitlement.status,
        source: entitlement.source,
        grantedAt: entitlement.grantedAt,
        expiresAt: entitlement.expiresAt,
        product: {
          id: entitlement.product.id,
          name: entitlement.product.name,
          description: entitlement.product.description,
        },
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
