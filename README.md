# Hulu Academy — Telegram Referral & Materials Access Mini App

> Production-grade Telegram Mini App and Bot for Hulu Academy's Ethiopian Freshman Tutorial Platform (Year 1 • Semester 2).

---

## 🌟 Key Features

- 🎓 **Semester 2 Tutorial Platform:** Designed specifically for Ethiopian University Freshmen (Pre-Engineering, Pre-Health, Natural Science, Social Science).
- 🏆 **20-Referral Verification Engine:** Authoritative server-side channel join verification. Click counters are prohibited; real channel membership is mandatory.
- 🔐 **Cryptographic Security:** Server-side HMAC-SHA-256 verification of Telegram `initData` with timing-safe string comparison.
- ⚡ **Idempotent Webhook Processing:** Deduplication by Telegram `update_id` and unique database constraint `UNIQUE(referred_user_id)` prevents multi-referral crediting.
- 💎 **Luxury Gold Academic UI:** Dark mode visual design featuring progress rings, custom logo branding, skeleton loading, smooth animations, and bottom navigation.
- 🛡️ **Protected Material Access:** Short-lived Supabase Storage signed URLs generated only after server-side entitlement check.
- 📊 **Admin Control Center:** User lookup, metrics, manual entitlement grants/revocations, user suspension, and mandatory audit log tracking.

---

## 📁 Repository Structure

```text
.
├── apps/
│   ├── mini-app/          # Next.js 16 Mini App UI & API Routes
│   └── bot/               # grammY Telegram Bot Service
├── packages/
│   ├── db/                # Prisma ORM Schema & Supabase Client
│   ├── validation/        # Zod validation schemas
│   ├── telegram/          # HMAC-SHA-256 validator & Bot API helpers
│   └── shared/            # Shared types and constants
├── docs/                  # Architectural documentation & specifications
├── .env.example           # Environment template
└── pnpm-workspace.yaml    # Monorepo configuration
```

---

## 🚀 Quick Start (Development)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local` and add your Supabase & Telegram Bot credentials:
```bash
cp .env.example .env.local
```

### 3. Setup Database
Push Prisma schema to your Supabase Postgres database and seed initial course data:
```bash
pnpm db:push
pnpm db:seed
```

### 4. Run Development Servers
```bash
pnpm dev
```
- Mini App: `http://localhost:3000`
- Admin Dashboard: `http://localhost:3000/admin`

### 5. Open the Mini App in Telegram during development

Install the Windows `cloudflared` executable from [Cloudflare's official downloads page](https://developers.cloudflare.com/tunnel/downloads/) and ensure `cloudflared --version` works in PowerShell.

For a temporary URL that changes when restarted, run:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Set the printed `https://...trycloudflare.com` URL as `MINI_APP_URL` in `.env.local`, then restart the bot. For a named tunnel with a stable hostname, add `CLOUDFLARE_TUNNEL_TOKEN` to `.env.local`, configure its public hostname to route to `http://localhost:3000` in Cloudflare, and run `npm run tunnel:cloudflare` from the repository root. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#cloudflare-tunnel-for-local-telegram-testing).

### 6. Run Unit Tests
```bash
pnpm test:unit
```

---

## 📄 License & Ownership
Copyright © 2026 Hulu Academy. All Rights Reserved.
