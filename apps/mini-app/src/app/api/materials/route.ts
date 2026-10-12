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

    // ALWAYS check entitlement server-side — never trust frontend state
    const entitlement = await getUserEntitlement(user.id)
    if (!entitlement) {
      return NextResponse.json(
        {
          error: 'Access denied',
          code: 'NO_ENTITLEMENT',
          message: 'You need 20 verified referrals to access materials',
        },
        { status: 403 },
      )
    }

    // Return materials for the entitled product
    const materials = await prisma.material.findMany({
      where: { productId: entitlement.productId, status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        description: true,
        fileType: true,
        sortOrder: true,
        productId: true,
        // Do NOT expose storageKey or telegramFileId here — only in /api/materials/:id
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({
      product: {
        id: entitlement.product.id,
        name: entitlement.product.name,
        description: entitlement.product.description,
      },
      materials,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
