import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@hulu/db'
import { requireAdmin } from '@/lib/admin-guard'
import { REFERRAL_THRESHOLD } from '@/lib/referral-rules'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)

    const now = new Date()
    // The dashboard's daily metric follows East Africa Time (UTC+3).
    const eatOffsetMs = 3 * 60 * 60 * 1000
    const eatNow = new Date(now.getTime() + eatOffsetMs)
    const todayStart = new Date(Date.UTC(
      eatNow.getUTCFullYear(),
      eatNow.getUTCMonth(),
      eatNow.getUTCDate(),
    ) - eatOffsetMs)
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    // Count student accounts with at least the threshold of verified referral
    // records. This is deliberately derived from referrals, not entitlements.
    const studentsAt20PlusQuery = prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS "count"
      FROM (
        SELECT r."referrer_user_id"
        FROM "referrals" AS r
        INNER JOIN "users" AS u ON u."id" = r."referrer_user_id"
        WHERE r."status" = 'VERIFIED'
          AND u."role" = 'STUDENT'
        GROUP BY r."referrer_user_id"
        HAVING COUNT(*) >= ${REFERRAL_THRESHOLD}
      ) AS qualified_students
    `

    const [
      totalStudents,
      totalVerifiedReferrals,
      activeEntitlements,
      referralsToday,
      suspiciousReferrals,
      studentsAt20PlusRows,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.referral.count({ where: { status: 'VERIFIED' } }),
      prisma.entitlement.count({
        where: {
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      prisma.referral.count({
        where: {
          status: 'VERIFIED',
          verifiedAt: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      prisma.referral.count({ where: { isSuspicious: true } }),
      studentsAt20PlusQuery,
    ])

    return NextResponse.json({
      totalStudents,
      totalVerifiedReferrals,
      studentsAt20Plus: Number(studentsAt20PlusRows[0]?.count ?? 0n),
      activeEntitlements,
      referralsToday,
      suspiciousReferrals,
    })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
