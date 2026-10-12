import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@hulu/db'
import { requireAdmin } from '@/lib/admin-guard'
import { AdminPromoteUserSchema, AdminSuspendUserSchema, AdminUnsuspendUserSchema } from '@hulu/validation'

// POST /api/admin/users/{suspend|unsuspend|promote}
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  try {
    const admin = await requireAdmin(req)
    const body = await req.json()
    const { action } = await params

    if (action === 'suspend') {
      const parsed = AdminSuspendUserSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

      const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } })
      if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      await prisma.$transaction([
        prisma.user.update({
          where: { id: parsed.data.userId },
          data: { status: 'SUSPENDED' },
        }),
        prisma.adminAuditLog.create({
          data: {
            adminUserId: admin.id,
            action: 'SUSPEND_USER',
            targetType: 'User',
            targetId: parsed.data.userId,
            reason: parsed.data.reason,
            metadataJson: { targetTelegramId: String(target.telegramUserId) },
          },
        }),
      ])

      return NextResponse.json({ ok: true })
    }

    if (action === 'unsuspend') {
      const parsed = AdminUnsuspendUserSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

      await prisma.$transaction([
        prisma.user.update({
          where: { id: parsed.data.userId },
          data: { status: 'ACTIVE' },
        }),
        prisma.adminAuditLog.create({
          data: {
            adminUserId: admin.id,
            action: 'UNSUSPEND_USER',
            targetType: 'User',
            targetId: parsed.data.userId,
            reason: parsed.data.reason,
          },
        }),
      ])

      return NextResponse.json({ ok: true })
    }

    if (action === 'promote') {
      const parsed = AdminPromoteUserSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

      const telegramUserId = BigInt(parsed.data.telegramUserId)
      if (telegramUserId > 9_223_372_036_854_775_807n) {
        return NextResponse.json({ error: 'Telegram user ID is too large' }, { status: 400 })
      }

      const target = await prisma.user.findUnique({ where: { telegramUserId } })
      if (target?.status === 'SUSPENDED') {
        return NextResponse.json({ error: 'Unsuspend the user before promoting them' }, { status: 400 })
      }
      if (target?.role === 'ADMIN') return NextResponse.json({ ok: true, alreadyAdmin: true })

      await prisma.$transaction(async (tx) => {
        const promotedUser = await tx.user.upsert({
          where: { telegramUserId },
          update: { role: 'ADMIN' },
          create: {
            telegramUserId,
            role: 'ADMIN',
            status: 'ACTIVE',
          },
        })

        await tx.adminAuditLog.create({
          data: {
            adminUserId: admin.id,
            action: 'PROMOTE_ADMIN',
            targetType: 'User',
            targetId: promotedUser.id,
            reason: parsed.data.reason,
            metadataJson: { targetTelegramId: String(telegramUserId) },
          },
        })
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
