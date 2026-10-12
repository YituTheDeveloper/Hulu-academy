# Hulu Academy — System Architecture

This document describes the high-level system architecture, security design, referral verification workflow, and database design for Hulu Academy.

---

## High-Level Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                          Telegram Client                         │
│                                                                 │
│   ┌───────────────────────────┐     ┌───────────────────────┐   │
│   │    Telegram Mini App      │     │  Telegram Bot Chat    │   │
│   └─────────────┬─────────────┘     └───────────▲───────────┘   │
└─────────────────┼───────────────────────────────┼───────────────┘
                  │ HTTPS initData                │ Telegram Messages
                  v                               │ (Notifications)
┌─────────────────────────────────────────────────┴───────────────┐
│                    Next.js 16 Web Service                       │
│                                                                 │
│  ┌───────────────────────┐       ┌───────────────────────────┐  │
│  │ Telegram Auth Route   │       │ Telegram Webhook Route    │  │
│  │ (HMAC-SHA-256)        │       │ (/api/webhooks/telegram)  │  │
│  └──────────┬────────────┘       └─────────────▲─────────────┘  │
│             │                                  │                │
│  ┌──────────▼────────────┐       ┌─────────────┴─────────────┐  │
│  │ Referral Engine       │       │ Bot Notification Handler  │  │
│  │ & Entitlement Service │       │ (sendTelegramMessage)     │  │
│  └──────────┬────────────┘       └───────────────────────────┘  │
└─────────────┼───────────────────────────────────────────────────┘
              │ Prisma ORM
              v
┌─────────────────────────────────────────────────────────────────┐
│                   Supabase PostgreSQL                           │
│                                                                 │
│  - users (telegram_user_id BIGINT UNIQUE)                       │
│  - referral_links (invite_url UNIQUE)                           │
│  - referrals (referred_user_id UNIQUE)                          │
│  - referral_events (telegram_update_id UNIQUE)                  │
│  - entitlements (UNIQUE(user_id, product_id))                   │
│  - products & materials                                         │
│  - admin_audit_logs                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Referral Flow (Authoritative Security Chain)

1. **Mini App Initialization:**
   Student opens Mini App from bot chat. `Telegram.WebApp.initData` is sent over HTTPS to `POST /api/telegram/auth`.

2. **Server-Side Cryptographic Validation:**
   Backend validates `initData` using HMAC-SHA-256 with `TELEGRAM_BOT_TOKEN`. Validates `auth_date` freshness.

3. **Unique Invite Link Creation:**
   Server calls Telegram Bot API `createChatInviteLink` to generate a dedicated invite URL linked to the student's record.

4. **Real Telegram Channel Join:**
   Referred student clicks the invite link and joins the official Hulu Academy Telegram channel.

5. **Webhook Membership Verification:**
   Telegram sends a `chat_member` update to `POST /api/webhooks/telegram`.

6. **Idempotent Transactional Processing:**
   - Database checks `telegram_update_id` uniqueness in `referral_events`.
   - Resolves `invite_link` URL to referrer.
   - Rejects self-referrals and suspended users.
   - Creates referral record with `UNIQUE(referred_user_id)` constraint (one credit per Telegram account globally).
   - Derives verified count (`COUNT(referrals WHERE status = VERIFIED)`).

7. **Entitlement Grant (at exactly 20 verified referrals):**
   - Automatically inserts entitlement with `UNIQUE(user_id, product_id)`.
   - Sends Telegram bot notification with unlocked status.
