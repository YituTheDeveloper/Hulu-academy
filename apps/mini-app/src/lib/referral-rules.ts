export const REFERRAL_THRESHOLD = 20

export interface TelegramMemberState {
  status: string
  is_member?: boolean | undefined
}

function isChannelMember(member: TelegramMemberState): boolean {
  return (
    member.status === 'creator' ||
    member.status === 'administrator' ||
    member.status === 'member' ||
    (member.status === 'restricted' && member.is_member === true)
  )
}

/** True only when a Telegram account transitions from outside to inside the chat. */
export function isReferralJoinTransition(
  oldMember: TelegramMemberState,
  newMember: TelegramMemberState,
): boolean {
  return !isChannelMember(oldMember) && isChannelMember(newMember)
}

export function calculateReferralProgress(verifiedCount: number) {
  const remaining = Math.max(0, REFERRAL_THRESHOLD - verifiedCount)
  const percentage = Math.min(100, Math.round((verifiedCount / REFERRAL_THRESHOLD) * 100))
  const isUnlocked = verifiedCount >= REFERRAL_THRESHOLD

  return {
    remaining,
    percentage,
    isUnlocked,
    threshold: REFERRAL_THRESHOLD,
    status: isUnlocked ? 'UNLOCKED' : verifiedCount >= 15 ? 'ALMOST_THERE' : 'IN_PROGRESS',
  } as const
}
