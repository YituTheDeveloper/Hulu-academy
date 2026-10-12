import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@hulu/db'
import { requireAdmin } from '@/lib/admin-guard'
import { AdminAuditLogsQuerySchema } from '@hulu/validation'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)

    const query = AdminAuditLogsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!query.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })

    const { page, limit, adminUserId, action } = query.data
    const skip = (page - 1) * limit

    const where = {
      ...(adminUserId ? { adminUserId } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        include: {
          admin: { select: { id: true, firstName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adminAuditLog.count({ where }),
    ])

    return NextResponse.json({
      data: logs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
