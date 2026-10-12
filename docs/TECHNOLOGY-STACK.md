# Hulu Academy — Technology Stack Policy & Version Audit

This document records the exact technology stack versions selected for production engineering of the Hulu Academy Telegram Freshman Referral & Materials Access System.

---

## Selected Technologies & Version Audit

| Technology | Selected Version | Why Selected | Official Documentation URL | Support / LTS Status |
|---|---|---|---|---|
| **Node.js** | `24.x` | Current Active LTS line (supported through April 2028). Provides maximum performance, security patches, and modern runtime APIs. | [nodejs.org](https://nodejs.org/) | Active LTS |
| **Next.js** | `16.x` | Current stable Active LTS version. Provides App Router, Server Actions, API routes, and optimized client bundle delivery. | [nextjs.org](https://nextjs.org/docs) | Active LTS |
| **React** | `19.x` | Latest stable React major release compatible with Next.js 16. Includes modern hooks and concurrent rendering features. | [react.dev](https://react.dev/) | Stable |
| **TypeScript** | `7.0.x` | Latest stable TypeScript version. Enables strict type checking across the entire mono-repo codebase. | [typescriptlang.org](https://www.typescriptlang.org/) | Stable |
| **Tailwind CSS** | `4.x` | Latest stable major version. Uses CSS-first engine with zero runtime overhead and modern design system capabilities. | [tailwindcss.com](https://tailwindcss.com/) | Stable |
| **grammY** | `@latest` (v1.x) | Actively maintained TypeScript Telegram bot framework with full Telegram Bot API 10.2 support. | [grammy.dev](https://grammy.dev/) | Active Maintenance |
| **PostgreSQL** | Supabase Postgres (16.x) | Production-grade relational database with strict ACID compliance, Supabase connection pooling (pgBouncer), and direct migrations. | [supabase.com/docs](https://supabase.com/docs) | Production Supported |
| **Prisma ORM** | `7.x` | Production-supported stable version. Prisma 8 is currently RC (Release Candidate), so Prisma 7 is selected per strict production stability policy. | [prisma.io](https://www.prisma.io/docs) | Maintained LTS |
| **Zod** | `3.23.x` | TypeScript-first schema validation library for strict API input and Telegram webhook payload sanitization. | [zod.dev](https://zod.dev/) | Active |
| **Vitest** | `5.x` | Fast unit-testing framework natively integrated with Vite/React ecosystem. Compatible with Node 24. | [vitest.dev](https://vitest.dev/) | Stable |
| **Playwright** | `1.63.x` | Industry-standard browser automation and end-to-end testing tool. | [playwright.dev](https://playwright.dev/) | Stable |
| **pnpm** | `9.x` | Strict, fast package manager with native pnpm workspaces support for multi-package monorepos. | [pnpm.io](https://pnpm.io/) | Stable |

---

## Policy Compliance Verification

- **STABLE Releases:** All selected versions are stable releases. No alpha, beta, experimental, or canary versions are used in production configurations.
- **Node.js LTS:** Node.js 24 LTS is recorded in `.nvmrc` and enforced via `package.json` `engines`.
- **Single Package Manager:** `pnpm` is used exclusively across all packages and services.
- **Supabase Integration:** Configured with dual `DATABASE_URL` (pgBouncer pooled) and `DIRECT_URL` (direct migrations).
