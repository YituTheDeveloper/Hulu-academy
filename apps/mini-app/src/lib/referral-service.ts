import { prisma } from '@hulu/db'
import { createChannelInviteLink, sendTelegramMessage } from '@hulu/telegram'
import type { TelegramInitDataUser } from '@hulu/telegram'
import {
  calculateReferralProgress,
  isReferralJoinTransition,
  REFERRAL_THRESHOLD,
  type TelegramMemberState,
} from '@/lib/referral-rules'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TARGET_CHAT_ID = process.env.TELEGRAM_TARGET_CHAT_ID!

// ─────────────────────────────────────────────
// User management
// ─────────────────────────────────────────────

/**
 * Finds or creates a user from validated Telegram identity.
 * Updates last_seen_at on each login.
 */
export async function upsertUser(telegramUser: TelegramInitDataUser) {
  const telegramUserId = BigInt(telegramUser.id)

  const user = await prisma.user.upsert({
    where: { telegramUserId },
    update: {
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name ?? null,
      languageCode: telegramUser.language_code ?? null,
      lastSeenAt: new Date(),
      // The allowlist must also promote users who already existed before they
      // were configured as admins. Do not demote admins when they are removed
      // from the bootstrap allowlist later.
      ...(isAdminTelegramId(telegramUser.id) ? { role: 'ADMIN' as const } : {}),
    },
    create: {
      telegramUserId,
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name ?? null,
      languageCode: telegramUser.language_code ?? null,
      role: isAdminTelegramId(telegramUser.id) ? 'ADMIN' : 'STUDENT',
      status: 'ACTIVE',
      lastSeenAt: new Date(),
    },
  })

  return user
}

function isAdminTelegramId(telegramId: number): boolean {
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return adminIds.includes(String(telegramId))
}

// ─────────────────────────────────────────────
// Referral link management
// ─────────────────────────────────────────────

/**
 * Gets an existing active referral link for a user or creates one.
 * Creates the link via Telegram Bot API and stores it in the database.
 */
export async function getOrCreateReferralLink(userId: string, displayName: string) {
  // Check for existing active link
  const existing = await prisma.referralLink.findFirst({
    where: { ownerUserId: userId, status: 'ACTIVE' },
  })

  if (existing) return existing

  // Create new Telegram invite link
  const { invite_link, telegram_invite_id } = await createChannelInviteLink(
    BOT_TOKEN,
    TARGET_CHAT_ID,
    displayName,
  )

  // Store in database
  const link = await prisma.referralLink.create({
    data: {
      ownerUserId: userId,
      telegramInviteId: telegram_invite_id,
      inviteUrl: invite_link,
      status: 'ACTIVE',
    },
  })

  return link
}

// ─────────────────────────────────────────────
// Referral stats
// ─────────────────────────────────────────────

/**
 * Derives the authoritative verified referral count.
 * NEVER uses a stored counter — always derives from referral records.
 */
export async function getVerifiedReferralCount(userId: string): Promise<number> {
  return prisma.referral.count({
    where: { referrerUserId: userId, status: 'VERIFIED' },
  })
}

export async function getReferralStats(userId: string) {
  const [verifiedCount, pendingCount, totalCount] = await Promise.all([
    prisma.referral.count({ where: { referrerUserId: userId, status: 'VERIFIED' } }),
    prisma.referral.count({ where: { referrerUserId: userId, status: 'PENDING' } }),
    prisma.referral.count({ where: { referrerUserId: userId } }),
  ])

  return {
    verifiedCount,
    pendingCount,
    totalCount,
    ...calculateReferralProgress(verifiedCount),
  }
}

// ─────────────────────────────────────────────
// Referral activity
// ─────────────────────────────────────────────

export async function getReferralActivity(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit

  const [referrals, total] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerUserId: userId },
      include: {
        referred: {
          select: {
            telegramUserId: true,
            firstName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.referral.count({ where: { referrerUserId: userId } }),
  ])

  // Mask referred user identity (spec: Student #••••82)
  const maskedReferrals = referrals.map((r) => ({
    id: r.id,
    status: r.status,
    verifiedAt: r.verifiedAt,
    createdAt: r.createdAt,
    // Mask: show only last 2 digits of Telegram ID
    referredMasked: `Student #••••${String(r.referred.telegramUserId).slice(-2)}`,
  }))

  return {
    data: maskedReferrals,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

// ─────────────────────────────────────────────
// Webhook referral processing (THE critical business logic)
// ─────────────────────────────────────────────

export interface WebhookProcessResult {
  action: 'DUPLICATE_UPDATE' | 'NOT_TARGET_CHAT' | 'NOT_A_JOIN' | 'NO_REFERRAL_LINK' |
          'SELF_REFERRAL' | 'ALREADY_CREDITED' | 'REFERRAL_VERIFIED' | 'ENTITLEMENT_GRANTED' | 'ERROR'
  message: string
}

export async function processWebhookUpdate(
  updateId: number,
  chatId: number,
  oldMember: TelegramMemberState,
  newMember: TelegramMemberState,
  telegramUser: { id: number; first_name: string; last_name?: string | undefined; username?: string | undefined; language_code?: string | undefined; is_bot?: boolean | undefined },
  inviteLinkUrl: string | undefined,
): Promise<WebhookProcessResult> {
  // Use Prisma transaction for all critical operations
  try {
    const targetChatId = BigInt(TARGET_CHAT_ID)
    const incomingChatId = BigInt(chatId)

    // Step 1: Only process actual transitions into the target chat.
    if (incomingChatId !== targetChatId) {
      return { action: 'NOT_TARGET_CHAT', message: 'Update for different chat — ignored' }
    }

    if (!isReferralJoinTransition(oldMember, newMember)) {
      return {
        action: 'NOT_A_JOIN',
        message: `Membership did not change from outside to inside (${oldMember.status} → ${newMember.status})`,
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Step 3: Idempotency — deduplicate by telegram_update_id
      const eventInsert = await tx.referralEvent.create({
        data: {
          telegramUpdateId: BigInt(updateId),
          eventType: 'JOIN',
          telegramUserId: BigInt(telegramUser.id),
          telegramChatId: incomingChatId,
          referralLinkId: null,
          referrerUserId: null,
          metadataJson: {
            old_status: oldMember.status,
            new_status: newMember.status,
            invite_link: inviteLinkUrl,
          },
        },
      }).catch((e: { code?: string }) => {
        if (e.code === 'P2002') return null // Unique constraint = duplicate update
        throw e
      })

      if (!eventInsert) {
        return { action: 'DUPLICATE_UPDATE', message: 'Telegram update already processed' }
      }

      // Step 4: If no referral link in the update, it's a non-referral join
      if (!inviteLinkUrl) {
        return { action: 'NO_REFERRAL_LINK', message: 'No invite link — non-referral join' }
      }

      // Step 5: Resolve invite link → referrer
      const referralLink = await tx.referralLink.findUnique({
        where: { inviteUrl: inviteLinkUrl },
        include: { owner: true },
      })

      if (!referralLink || referralLink.status !== 'ACTIVE') {
        return { action: 'NO_REFERRAL_LINK', message: 'Invite link not tracked in our system' }
      }

      // Step 6: Upsert the referred user
      const referredTelegramId = BigInt(telegramUser.id)
      const referredUser = await tx.user.upsert({
        where: { telegramUserId: referredTelegramId },
        update: {
          username: telegramUser.username ?? null,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name ?? null,
          lastSeenAt: new Date(),
        },
        create: {
          telegramUserId: referredTelegramId,
          username: telegramUser.username ?? null,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name ?? null,
          languageCode: telegramUser.language_code ?? null,
          role: 'STUDENT',
          status: 'ACTIVE',
          lastSeenAt: new Date(),
        },
      })

      // Step 7: Self-referral check
      if (referredUser.id === referralLink.ownerUserId) {
        return { action: 'SELF_REFERRAL', message: 'Self-referral rejected' }
      }

      // Step 8: Check if referred user is suspended
      if (referredUser.status === 'SUSPENDED') {
        return { action: 'SELF_REFERRAL', message: 'Referred user is suspended' }
      }

      // Step 9: Insert referral — UNIQUE constraint on referred_user_id prevents double-crediting
      const referral = await tx.referral.create({
        data: {
          referrerUserId: referralLink.ownerUserId,
          referredUserId: referredUser.id,
          referralLinkId: referralLink.id,
          telegramJoinEventId: eventInsert.id,
          status: 'VERIFIED',
          verifiedAt: new Date(),
        },
      }).catch((e: { code?: string }) => {
        if (e.code === 'P2002') return null // Already credited
        throw e
      })

      if (!referral) {
        return { action: 'ALREADY_CREDITED', message: 'This Telegram account was already credited' }
      }

      // Step 10: Derive verified count — NEVER use a stored counter
      const verifiedCount = await tx.referral.count({
        where: {
          referrerUserId: referralLink.ownerUserId,
          status: 'VERIFIED',
        },
      })

      // Step 11: Check entitlement threshold
      if (verifiedCount >= REFERRAL_THRESHOLD) {
        // Get the standard product
        const product = await tx.product.findFirst({
          where: { status: 'ACTIVE', type: 'TUTORIAL_PACKAGE' },
          orderBy: { createdAt: 'asc' },
        })

        if (product) {
          // UNIQUE(user_id, product_id) prevents duplicate entitlements
          const entitlementCreated = await tx.entitlement.create({
            data: {
              userId: referralLink.ownerUserId,
              productId: product.id,
              status: 'ACTIVE',
              source: 'REFERRAL_20',
              grantedAt: new Date(),
              expiresAt: null, // Permanent access
            },
          }).catch((e: { code?: string }) => {
            if (e.code === 'P2002') return null // Already has entitlement
            throw e
          })

          // Update referral event with context
          await tx.referralEvent.update({
            where: { id: eventInsert.id },
            data: {
              referralLinkId: referralLink.id,
              referrerUserId: referralLink.ownerUserId,
            },
          })

          if (entitlementCreated) {
            // Notify student (fire-and-forget outside transaction)
            const referrer = referralLink.owner
            setImmediate(() => {
              sendTelegramMessage(
                BOT_TOKEN,
                Number(referrer.telegramUserId),
                `🏆 <b>Congratulations, ${referrer.firstName}!</b>\n\n` +
                `You have reached <b>${verifiedCount} verified referrals</b> and unlocked the <b>Year 1 • Semester 2 Full Tutorial Package!</b>\n\n` +
                `Tap below to access your materials. 🎓`,
              ).catch((e: unknown) => console.error('Notification failed:', e))
            })

            return { action: 'ENTITLEMENT_GRANTED', message: `Entitlement granted after ${verifiedCount} referrals` }
          }
        }
      } else {
        // Notify referrer of progress
        const referrer = referralLink.owner
        setImmediate(() => {
          sendTelegramMessage(
            BOT_TOKEN,
            Number(referrer.telegramUserId),
            `🎉 A new student joined through your link!\n\n` +
            `Your progress: <b>${verifiedCount} / ${REFERRAL_THRESHOLD}</b> verified referrals.\n` +
            `Keep sharing to unlock the full tutorial package!`,
          ).catch((e: unknown) => console.error('Progress notification failed:', e))
        })
      }

      // Update referral event with resolved context
      await tx.referralEvent.update({
        where: { id: eventInsert.id },
        data: {
          referralLinkId: referralLink.id,
          referrerUserId: referralLink.ownerUserId,
        },
      })

      return { action: 'REFERRAL_VERIFIED', message: `Referral VERIFIED. Count: ${verifiedCount}/${REFERRAL_THRESHOLD}` }
    })

    return result as WebhookProcessResult
  } catch (error) {
    console.error('Webhook processing error:', error)
    return { action: 'ERROR', message: `Processing error: ${String(error)}` }
  }
}

// ─────────────────────────────────────────────
// Entitlement check
// ─────────────────────────────────────────────

export async function getUserEntitlement(userId: string) {
  return prisma.entitlement.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { product: true },
  })
}
