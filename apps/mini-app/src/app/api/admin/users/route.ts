import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@hulu/db'
import { requireAdmin } from '@/lib/admin-guard'
import { AdminUsersQuerySchema } from '@hulu/validation'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)

    const query = AdminUsersQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!query.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })

    const { page, limit, search, status, role } = query.data
    const skip = (page - 1) * limit
    const maxPostgresBigInt = 9_223_372_036_854_775_807n
    const numericSearch = search && /^\d{1,20}$/.test(search) ? BigInt(search) : undefined
    const telegramIdSearch = numericSearch !== undefined && numericSearch <= maxPostgresBigInt
      ? numericSearch
      : undefined

    const where = {
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { username: { contains: search, mode: 'insensitive' as const } },
          ...(telegramIdSearch !== undefined ? [{ telegramUserId: telegramIdSearch }] : []),
        ],
      } : {}),
      ...(status ? { status } : {}),
      ...(role ? { role } : {}),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
          _count: {
            select: {
              referralsAsReferrer: { where: { status: 'VERIFIED' } },
              entitlements: {
                where: {
                  status: 'ACTIVE',
                  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      data: users.map((u) => ({
        ...u,
        telegramUserId: String(u.telegramUserId),
        verifiedReferrals: u._count.referralsAsReferrer,
        hasEntitlement: u._count.entitlements > 0,
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
