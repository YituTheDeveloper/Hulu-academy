import { Bot, InlineKeyboard } from 'grammy'
import dotenv from 'dotenv'

dotenv.config({ path: '../../.env.local' })
dotenv.config({ path: '../../.env' })

const token = process.env.TELEGRAM_BOT_TOKEN
const miniAppUrl = process.env.MINI_APP_URL || process.env.APP_URL || 'https://your-domain.com'

if (!token) {
  console.error('⚠️  TELEGRAM_BOT_TOKEN is not defined in environment variables.')
  console.error('Please configure .env before starting the bot.')
  process.exit(1)
}

const bot = new Bot(token)

function getMiniAppUrl() {
  return (process.env.MINI_APP_URL || process.env.APP_URL || '').trim()
}

async function forwardChatMemberUpdate(update: unknown) {
  const baseUrl = getMiniAppUrl().replace(/\/+$/, '')
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (!baseUrl || !secret) {
    throw new Error('MINI_APP_URL and TELEGRAM_WEBHOOK_SECRET are required to process referral joins')
  }

  const endpoint = `${baseUrl}/api/webhooks/telegram`
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': secret,
        },
        body: JSON.stringify(update),
        signal: AbortSignal.timeout(10_000),
      })

      if (response.ok) return

      throw new Error(`Referral webhook returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Referral webhook request failed')
}

// Error handling
bot.catch((err) => {
  console.error('Bot error caught:', err.message)
})

// Helper to build keyboard safely
function buildAppKeyboard(url: string) {
  const keyboard = new InlineKeyboard()
  if (url.startsWith('https://')) {
    keyboard.webApp('🎓 Open Referral Dashboard', url)
  }
  return keyboard
}

// Handle /start command
bot.command('start', async (ctx) => {
  const currentAppUrl = getMiniAppUrl()
  const isHttps = currentAppUrl.startsWith('https://')
  const keyboard = buildAppKeyboard(currentAppUrl)

  const welcomeText =
    `🎓 <b>Welcome to Hulu Academy!</b>\n\n` +
    `Freshman Second Semester Class is now live! 🌟\n\n` +
    `<b>What we offer:</b>\n` +
    `✅ High quality 4K Video Lectures\n` +
    `✅ PDF Notes in Amharic & English\n` +
    `✅ 4+ Years Past Exams with Solutions\n` +
    `✅ Chapter-wise Quizzes & Summaries\n` +
    `✅ Senior Advice & Experience Sharing\n\n` +
    `<b>Supported Departments:</b>\n` +
    `🟢 Pre-Engineering | Pre-Health | Natural Science | Social Science\n\n` +
    `🏆 <b>SPECIAL REFERRAL PROGRAM:</b>\n` +
    `Invite <b>20 verified freshman classmates</b> into our official channel using your unique link, and unlock the <b>ENTIRE Year 1 • Semester 2 Full Package</b> for FREE!\n\n` +
    (isHttps
      ? `Tap below to open your referral dashboard:`
      : `⚠️ <b>Local Development Mode</b>\n` +
        `Telegram requires an <b>HTTPS</b> URL to attach buttons.\n` +
        `• Browser Preview: <code>${currentAppUrl}</code>\n` +
        `• Quick Tunnel: run <code>cloudflared tunnel --url http://localhost:3000</code>, then set its HTTPS URL as <code>MINI_APP_URL</code> in <code>.env.local</code>.\n` +
        `• Named Tunnel: add <code>CLOUDFLARE_TUNNEL_TOKEN</code> to <code>.env.local</code> and run <code>npm run tunnel:cloudflare</code>.`)

  await ctx.reply(welcomeText, {
    parse_mode: 'HTML',
    ...(isHttps ? { reply_markup: keyboard } : {}),
  })
})

// Handle /help command
bot.command('help', async (ctx) => {
  const currentAppUrl = getMiniAppUrl()
  const isHttps = currentAppUrl.startsWith('https://')
  const keyboard = buildAppKeyboard(currentAppUrl)

  const helpText =
    `ℹ️ <b>Hulu Academy Help & Rules</b>\n\n` +
    `<b>How referrals work:</b>\n` +
    `1. Open the Mini App to get your unique referral invite link.\n` +
    `2. Share your link with freshman classmates.\n` +
    `3. When a classmate joins the official channel via your link, Telegram verifies their membership.\n` +
    `4. Your verified referral count increases by 1.\n` +
    `5. Reach 20 verified referrals to automatically unlock all course materials!\n\n` +
    `⚠️ <i>Note: Referral links only count when the user actually joins the channel. Clicks alone do not count.</i>`

  await ctx.reply(helpText, {
    parse_mode: 'HTML',
    ...(isHttps ? { reply_markup: keyboard } : {}),
  })
})

// Telegram excludes chat_member updates from its default long-polling types.
// Forward membership updates to the Mini App's existing referral processor.
bot.on('chat_member', async (ctx) => {
  await forwardChatMemberUpdate(ctx.update)
})

// Start bot (Polling mode for local development)
console.log('🚀 Starting Hulu Academy Telegram Bot...')
bot.start({
  allowed_updates: ['message', 'callback_query', 'chat_member'],
  onStart: (info) => {
    console.log(`✅ Bot @${info.username} is running!`)
  },
})
