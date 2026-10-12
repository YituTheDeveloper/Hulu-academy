import { z } from 'zod'

// ─────────────────────────────────────────────
// Telegram Auth
// ─────────────────────────────────────────────

export const TelegramAuthSchema = z.object({
  initData: z.string().min(1, 'initData is required'),
})

export type TelegramAuthInput = z.infer<typeof TelegramAuthSchema>

// ─────────────────────────────────────────────
// Referral
// ─────────────────────────────────────────────

export const ReferralActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// ─────────────────────────────────────────────
// Telegram Webhook
// ─────────────────────────────────────────────

export const TelegramUserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
})

export const TelegramChatMemberSchema = z.object({
  status: z.enum(['creator', 'administrator', 'member', 'restricted', 'left', 'kicked']),
  is_member: z.boolean().optional(),
  user: TelegramUserSchema,
})

export const TelegramInviteLinkSchema = z.object({
  invite_link: z.string(),
  creator: TelegramUserSchema,
  creates_join_request: z.boolean(),
  is_primary: z.boolean(),
  is_revoked: z.boolean(),
})

export const ChatMemberUpdatedSchema = z.object({
  chat: z.object({
    id: z.number(),
    type: z.string(),
  }),
  from: TelegramUserSchema,
  date: z.number(),
  old_chat_member: TelegramChatMemberSchema,
  new_chat_member: TelegramChatMemberSchema,
  invite_link: TelegramInviteLinkSchema.optional(),
})

export const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  chat_member: ChatMemberUpdatedSchema.optional(),
  message: z.unknown().optional(),
  callback_query: z.unknown().optional(),
})

export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>
export type ChatMemberUpdated = z.infer<typeof ChatMemberUpdatedSchema>
export type TelegramUser = z.infer<typeof TelegramUserSchema>

// ─────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────

export const AdminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  role: z.enum(['STUDENT', 'ADMIN']).optional(),
})

export const AdminReferralsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'REVOKED']).optional(),
  isSuspicious: z.coerce.boolean().optional(),
  referrerId: z.string().uuid().optional(),
})

export const AdminReviewReferralSchema = z.object({
  action: z.enum(['VERIFY', 'REJECT', 'REVOKE']),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
})

export const AdminGrantEntitlementSchema = z.object({
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  reason: z.string().min(5, 'Reason is required'),
  expiresAt: z.string().datetime().optional(),
})

export const AdminRevokeEntitlementSchema = z.object({
  entitlementId: z.string().uuid(),
  reason: z.string().min(5, 'Reason is required'),
})

export const AdminSuspendUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(5, 'Reason is required'),
})

export const AdminUnsuspendUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(5, 'Reason is required'),
})

export const AdminPromoteUserSchema = z.object({
  telegramUserId: z.string().regex(/^[1-9]\d{0,19}$/, 'Enter a valid Telegram user ID'),
  reason: z.string().min(5, 'Reason is required'),
})

export const AdminAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  adminUserId: z.string().uuid().optional(),
  action: z.string().optional(),
})
