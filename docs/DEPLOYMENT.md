# Hulu Academy — Deployment & Setup Guide

This guide describes how to configure Telegram BotFather, set up Supabase PostgreSQL, and deploy the Mini App and bot to production.

---

## Cloudflare Tunnel for local Telegram testing

Telegram requires a public HTTPS Mini App URL. Install `cloudflared` from [Cloudflare's official downloads page](https://developers.cloudflare.com/tunnel/downloads/) and make sure `cloudflared --version` works in PowerShell. The launcher uses a working root `cloudflared.exe` or falls back to an installed executable on `PATH`. It loads the remotely-managed Tunnel token from the root `.env.local` without putting the token in the command line.

### Create a named tunnel

1. In the [Cloudflare dashboard](https://dash.cloudflare.com/), open **Networking > Tunnels** and create a tunnel. Publishing a named hostname requires a Cloudflare account and a domain on Cloudflare.
2. Add a public hostname, for example `academy.example.com`, and set its service URL to `http://localhost:3000`.
3. In the tunnel, choose **Add a replica** and copy the `cloudflared` install command into a text editor. Copy only the long tunnel token (the `eyJ...` value); do not paste a Cloudflare account API token.
4. Add the token and hostname to the root `.env.local`:

   ```env
   CLOUDFLARE_TUNNEL_TOKEN=PASTE_THE_TUNNEL_TOKEN_HERE
   MINI_APP_URL=https://academy.example.com
   ```

5. Start the Mini App and bot, then from the repository root run:

   ```powershell
   npm run tunnel:cloudflare
   ```

   Keep the tunnel terminal open while testing. Restart the bot after changing `MINI_APP_URL` so its Telegram button and referral webhook use the public hostname.

### Temporary Quick Tunnel

Quick Tunnels need no Cloudflare account, domain, or token. With the Mini App running on port 3000, run `cloudflared tunnel --url http://localhost:3000`, then copy the printed `https://...trycloudflare.com` URL into `MINI_APP_URL` in `.env.local` and restart the bot. The hostname is temporary and can change each time the process starts.

## 1. Telegram Bot Setup (BotFather)

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` and follow instructions to set bot name (e.g. `Hulu Academy Bot`) and username (e.g. `HuluAcademybot`).
3. Save the returned **HTTP API Bot Token**.
4. Set up the bot menu button:
   - Send `/setmenubutton`
   - Select your bot
   - Enter button text: `🎓 Open Referral Dashboard`
   - Enter Mini App URL: `https://your-domain.com`

5. Add Bot as Channel Administrator:
   - Open your official Telegram freshman channel.
   - Add your bot `@HuluAcademybot` as an administrator.
   - Grant permission: **Invite Users via Link** and **Manage Members**.

---

## 2. Supabase Database Setup

1. Log into your [Supabase Dashboard](https://supabase.com).
2. Create a new PostgreSQL project.
3. Under **Settings > Database**, copy:
   - **Transaction Pooler URL** (port 6543) → `DATABASE_URL`
   - **Direct Connection URL** (port 5432) → `DIRECT_URL`
4. Run Prisma database migrations & seed:
   ```bash
   pnpm db:push
   pnpm db:seed
   ```

---

## 3. Telegram update delivery

Use one update-delivery mode at a time.

### Local development: bot polling

The local bot in `apps/bot/src/index.ts` uses Telegram long polling for `chat_member` updates and forwards them to the Mini App at `MINI_APP_URL/api/webhooks/telegram`. Keep the bot, Mini App, and Cloudflare Tunnel running while testing. Do not register Telegram's direct webhook at the same time; Telegram does not allow long polling while a webhook is active. If this bot was previously configured with a webhook, remove it (preserving pending updates) before starting the local polling bot. `getWebhookInfo` should report an empty `url` for polling mode.

### Production: Vercel Mini App plus a persistent bot worker

Deploy `apps/mini-app` to Vercel. Run `apps/bot` as a persistent Node.js worker on a service that keeps processes running, such as Render, Railway, or a VPS. The bot uses long polling for `/start`, `/help`, and channel-member updates. For referral joins, it forwards `chat_member` updates to the Mini App's `/api/webhooks/telegram` endpoint.

Configure the bot worker with `TELEGRAM_BOT_TOKEN`, `MINI_APP_URL` (the production Vercel URL), and `TELEGRAM_WEBHOOK_SECRET`. Set the same `TELEGRAM_WEBHOOK_SECRET` in Vercel and the bot worker. Use these commands from the repository root on the worker service:

```bash
pnpm --filter @hulu/bot build
pnpm --filter @hulu/bot start
```

Do not register Telegram's direct webhook while the polling bot is running. The current Mini App webhook route processes `chat_member` updates only; bot commands are handled by the polling worker.

For Vercel, set the Root Directory to `apps/mini-app`, enable **Include source files outside of the Root Directory in the Build Step**, and use Node.js 24.x. Vercel can auto-detect the pnpm install from the root lockfile. Set the Build Command to:

```bash
cd ../.. && pnpm --filter @hulu/db db:generate && pnpm --filter @hulu/mini-app build
```

---

## 4. Environment Variables Checklist

Add the Mini App variables in Vercel Project Settings → Environment Variables. Add the bot worker variables in the persistent worker service. Never commit .env.local or paste its secret values into source files.

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

TELEGRAM_BOT_TOKEN=123456789:ABCdef...
TELEGRAM_BOT_USERNAME=HuluAcademybot
TELEGRAM_TARGET_CHAT_ID=-1001234567890
TELEGRAM_WEBHOOK_SECRET=your-random-32-char-secret
NEXT_PUBLIC_CHANNEL_USERNAME=HuluAcademy
NEXT_PUBLIC_BOT_USERNAME=HuluAcademybot

APP_URL=https://your-domain.com
MINI_APP_URL=https://your-domain.com

SESSION_SECRET=your-64-character-random-secret
ADMIN_TELEGRAM_IDS=123456789

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
SUPABASE_STORAGE_BUCKET=hulu-materials
```
