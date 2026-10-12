// Re-export Prisma Client for use throughout the monorepo
export { PrismaClient } from '@prisma/client'
export type {
  User,
  Session,
  ReferralLink,
  Referral,
  ReferralEvent,
  Product,
  Material,
  Entitlement,
  AdminAuditLog,
  UserRole,
  UserStatus,
  ReferralLinkStatus,
  ReferralStatus,
  ReferralEventType,
  EntitlementStatus,
  EntitlementSource,
  ProductType,
  ProductStatus,
  MaterialStatus,
} from '@prisma/client'

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Singleton pattern — prevents multiple Prisma Client instances
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  adapter: PrismaPg | undefined
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL must be configured to connect Prisma to PostgreSQL')
}

const adapter = globalForPrisma.adapter ?? new PrismaPg({ connectionString })

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.adapter = adapter
}
