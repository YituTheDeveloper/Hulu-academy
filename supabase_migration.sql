-- ==============================================================================
-- Hulu Academy — Complete Supabase PostgreSQL Schema & Initial Seed
-- Run this script directly in Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New query -> Paste & Run
-- ==============================================================================

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReferralLinkStatus" AS ENUM ('ACTIVE', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReferralEventType" AS ENUM ('JOIN', 'LEAVE', 'REJOIN', 'INVALIDATE', 'MANUAL_ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "EntitlementSource" AS ENUM ('REFERRAL_20', 'ADMIN_GRANT', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProductType" AS ENUM ('TUTORIAL_PACKAGE', 'COURSE_BUNDLE', 'SINGLE_COURSE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MaterialStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABLES

-- Users
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "telegram_user_id" BIGINT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "language_code" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Sessions
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- Referral Links
CREATE TABLE IF NOT EXISTS "referral_links" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" TEXT NOT NULL,
    "telegram_invite_id" TEXT,
    "invite_url" TEXT NOT NULL,
    "status" "ReferralLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_links_pkey" PRIMARY KEY ("id")
);

-- Referrals (CRITICAL: UNIQUE on referred_user_id ensures 1 referral credit per Telegram user)
CREATE TABLE IF NOT EXISTS "referrals" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "referrer_user_id" TEXT NOT NULL,
    "referred_user_id" TEXT NOT NULL,
    "referral_link_id" TEXT NOT NULL,
    "telegram_join_event_id" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "is_suspicious" BOOLEAN NOT NULL DEFAULT false,
    "suspicion_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- Referral Events (Webhook idempotent event tracking)
CREATE TABLE IF NOT EXISTS "referral_events" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "telegram_update_id" BIGINT NOT NULL,
    "event_type" "ReferralEventType" NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "telegram_chat_id" BIGINT NOT NULL,
    "referral_link_id" TEXT,
    "referrer_user_id" TEXT,
    "raw_event_hash" TEXT,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_events_pkey" PRIMARY KEY ("id")
);

-- Products
CREATE TABLE IF NOT EXISTS "products" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL DEFAULT 'TUTORIAL_PACKAGE',
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- Materials
CREATE TABLE IF NOT EXISTS "materials" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "product_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storage_key" TEXT,
    "telegram_file_id" TEXT,
    "file_type" TEXT,
    "file_size_bytes" BIGINT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "MaterialStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- Entitlements (CRITICAL: UNIQUE on user_id, product_id prevents duplicate reward grants)
CREATE TABLE IF NOT EXISTS "entitlements" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "EntitlementSource" NOT NULL DEFAULT 'REFERRAL_20',
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "revoke_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- Admin Audit Logs
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "admin_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "reason" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- 3. INDEXES
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_user_id_key" ON "users"("telegram_user_id");
CREATE INDEX IF NOT EXISTS "users_telegram_user_id_idx" ON "users"("telegram_user_id");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users"("created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_key" ON "sessions"("token");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions"("token");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions"("expires_at");

CREATE UNIQUE INDEX IF NOT EXISTS "referral_links_invite_url_key" ON "referral_links"("invite_url");
CREATE INDEX IF NOT EXISTS "referral_links_owner_user_id_idx" ON "referral_links"("owner_user_id");
CREATE INDEX IF NOT EXISTS "referral_links_invite_url_idx" ON "referral_links"("invite_url");
CREATE INDEX IF NOT EXISTS "referral_links_status_idx" ON "referral_links"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referred_user_id_key" ON "referrals"("referred_user_id");
CREATE INDEX IF NOT EXISTS "referrals_referrer_user_id_idx" ON "referrals"("referrer_user_id");
CREATE INDEX IF NOT EXISTS "referrals_referred_user_id_idx" ON "referrals"("referred_user_id");
CREATE INDEX IF NOT EXISTS "referrals_status_idx" ON "referrals"("status");
CREATE INDEX IF NOT EXISTS "referrals_referrer_user_id_status_idx" ON "referrals"("referrer_user_id", "status");
CREATE INDEX IF NOT EXISTS "referrals_created_at_idx" ON "referrals"("created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "referral_events_telegram_update_id_key" ON "referral_events"("telegram_update_id");
CREATE INDEX IF NOT EXISTS "referral_events_telegram_update_id_idx" ON "referral_events"("telegram_update_id");
CREATE INDEX IF NOT EXISTS "referral_events_telegram_user_id_idx" ON "referral_events"("telegram_user_id");
CREATE INDEX IF NOT EXISTS "referral_events_telegram_chat_id_idx" ON "referral_events"("telegram_chat_id");
CREATE INDEX IF NOT EXISTS "referral_events_referral_link_id_idx" ON "referral_events"("referral_link_id");
CREATE INDEX IF NOT EXISTS "referral_events_event_type_idx" ON "referral_events"("event_type");
CREATE INDEX IF NOT EXISTS "referral_events_created_at_idx" ON "referral_events"("created_at");

CREATE INDEX IF NOT EXISTS "products_status_idx" ON "products"("status");

CREATE INDEX IF NOT EXISTS "materials_product_id_idx" ON "materials"("product_id");
CREATE INDEX IF NOT EXISTS "materials_sort_order_idx" ON "materials"("sort_order");
CREATE INDEX IF NOT EXISTS "materials_status_idx" ON "materials"("status");

CREATE INDEX IF NOT EXISTS "entitlements_user_id_idx" ON "entitlements"("user_id");
CREATE INDEX IF NOT EXISTS "entitlements_product_id_idx" ON "entitlements"("product_id");
CREATE INDEX IF NOT EXISTS "entitlements_status_idx" ON "entitlements"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "entitlements_user_id_product_id_key" ON "entitlements"("user_id", "product_id");

CREATE INDEX IF NOT EXISTS "admin_audit_logs_admin_user_id_idx" ON "admin_audit_logs"("admin_user_id");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_target_type_target_id_idx" ON "admin_audit_logs"("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- 4. FOREIGN KEYS
DO $$ BEGIN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referral_link_id_fkey" FOREIGN KEY ("referral_link_id") REFERENCES "referral_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "materials" ADD CONSTRAINT "materials_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. INITIAL SEED (Freshman Second Semester Courses & Product)
INSERT INTO "products" ("id", "name", "description", "type", "status", "created_at", "updated_at")
VALUES (
    'prod-y1s2-full',
    'Year 1 • Semester 2 Full Tutorial Package',
    'Complete premium tutorial package for Ethiopian university freshman students (Second Semester). Includes 4K video lectures, PDFs, notes in Amharic & English, chapter-wise quizzes, past exam papers with answers, special exam-focused practice, and senior advice sessions. Covers Pre-Engineering, Pre-Health, Other Natural Science, Social Science.',
    'TUTORIAL_PACKAGE',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description";

-- Seed Courses
INSERT INTO "materials" ("id", "product_id", "title", "description", "file_type", "sort_order", "status")
VALUES
    ('mat-communicative-english', 'prod-y1s2-full', 'Communicative English Language Skills 2', 'Academic English communication skills for university freshmen — writing, reading, speaking, and listening.', 'mixed', 1, 'ACTIVE'),
    ('mat-civics-moral-education', 'prod-y1s2-full', 'Civics and Moral Education', 'Ethiopian civic values, democratic culture, human rights, and moral reasoning.', 'mixed', 2, 'ACTIVE'),
    ('mat-entrepreneurship', 'prod-y1s2-full', 'Entrepreneurship', 'Business creation, innovation, startup thinking, and Ethiopian entrepreneurship ecosystem.', 'mixed', 3, 'ACTIVE'),
    ('mat-emerging-technology', 'prod-y1s2-full', 'Emerging Technology', 'Introduction to AI, IoT, blockchain, and other transformative technologies for all departments.', 'mixed', 4, 'ACTIVE'),
    ('mat-applied-mathematics-1', 'prod-y1s2-full', 'Applied Mathematics 1', 'Calculus, linear algebra, and mathematical foundations for Pre-Engineering and Natural Science students.', 'mixed', 5, 'ACTIVE'),
    ('mat-computer-programming', 'prod-y1s2-full', 'Computer Programming', 'Introduction to programming fundamentals — algorithms, logic, and basic coding for all departments.', 'mixed', 6, 'ACTIVE'),
    ('mat-biology', 'prod-y1s2-full', 'Biology', 'Cell biology, genetics, and life science fundamentals for Pre-Health and Natural Science students.', 'mixed', 7, 'ACTIVE'),
    ('mat-chemistry', 'prod-y1s2-full', 'Chemistry', 'General chemistry, bonding, reactions, and stoichiometry for Pre-Health and Natural Science.', 'mixed', 8, 'ACTIVE'),
    ('mat-history', 'prod-y1s2-full', 'History', 'Ethiopian and African history for Social Science and other departments.', 'mixed', 9, 'ACTIVE'),
    ('mat-economics', 'prod-y1s2-full', 'Economics', 'Micro and macroeconomics fundamentals for Social Science students.', 'mixed', 10, 'ACTIVE'),
    ('mat-anthropology', 'prod-y1s2-full', 'Anthropology', 'Human culture, society, and diversity studies.', 'mixed', 11, 'ACTIVE'),
    ('mat-global-trends', 'prod-y1s2-full', 'Global Trends', 'Contemporary global developments, geopolitics, and world affairs.', 'mixed', 12, 'ACTIVE'),
    ('mat-inclusiveness', 'prod-y1s2-full', 'Inclusiveness', 'Diversity, equity, disability studies, and inclusive development in Ethiopia.', 'mixed', 13, 'ACTIVE'),
    ('mat-psychology', 'prod-y1s2-full', 'Psychology (Selected Universities)', 'Introduction to psychological principles, human behavior, and mental health.', 'mixed', 14, 'ACTIVE'),
    ('mat-geography', 'prod-y1s2-full', 'Geography (Selected Universities)', 'Physical and human geography with Ethiopian and African regional focus.', 'mixed', 15, 'ACTIVE'),
    ('mat-logic-critical-thinking', 'prod-y1s2-full', 'Logic and Critical Thinking (Selected Universities)', 'Formal logic, argumentation, fallacies, and critical reasoning skills.', 'mixed', 16, 'ACTIVE'),
    ('mat-physics', 'prod-y1s2-full', 'Physics (Selected Universities)', 'Classical mechanics, electricity, and waves for engineering-track freshmen.', 'mixed', 17, 'ACTIVE')
ON CONFLICT ("id") DO NOTHING;
