import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@hulu/db'
import { requireAdmin } from '@/lib/admin-guard'
import { AdminGrantEntitlementSchema, AdminRevokeEntitlementSchema } from '@hulu/validation'

// POST /api/admin/entitlements/grant
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    const url = req.nextUrl.pathname

    if (url.endsWith('/grant')) {
      const body = await req.json()
      const parsed = AdminGrantEntitlementSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

      const { userId, productId, reason, expiresAt } = parsed.data

      const entitlement = await prisma.entitlement.create({
        data: {
          userId,
          productId,
          status: 'ACTIVE',
          source: 'ADMIN_GRANT',
          grantedAt: new Date(),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      }).catch((e: { code?: string }) => {
        if (e.code === 'P2002') return null
        throw e
      })

      await prisma.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: 'GRANT_ENTITLEMENT',
          targetType: 'Entitlement',
          targetId: entitlement?.id ?? 'ALREADY_EXISTS',
          reason,
          metadataJson: { userId, productId, alreadyExisted: !entitlement },
        },
      })

      return NextResponse.json({ ok: true, created: !!entitlement })
    }

    if (url.endsWith('/revoke')) {
      const body = await req.json()
      const parsed = AdminRevokeEntitlementSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

      const { entitlementId, reason } = parsed.data

      await prisma.$transaction([
        prisma.entitlement.update({
          where: { id: entitlementId },
          data: { status: 'REVOKED', revokeReason: reason },
        }),
        prisma.adminAuditLog.create({
          data: {
            adminUserId: admin.id,
            action: 'REVOKE_ENTITLEMENT',
            targetType: 'Entitlement',
            targetId: entitlementId,
            reason,
          },
        }),
      ])

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
