import { NextRequest, NextResponse } from 'next/server'
import { TelegramUpdateSchema } from '@hulu/validation'
import { processWebhookUpdate } from '@/lib/referral-service'

export const runtime = 'nodejs'
export const maxDuration = 60

type TelegramMessage = {
  chat?: { id?: unknown; type?: unknown }
  text?: unknown
}

function parseBotCommand(message: unknown) {
  if (!message || typeof message !== 'object') return null

  const { chat, text } = message as TelegramMessage
  if (
    !chat ||
    typeof chat.id !== 'number' ||
    !Number.isSafeInteger(chat.id) ||
    typeof chat.type !== 'string' ||
    typeof text !== 'string'
  ) {
    return null
  }

  const commandToken = text.trim().split(/\s+/, 1)[0]?.toLowerCase()
  const match = commandToken?.match(/^\/(start|help)(?:@[a-z0-9_]+)?$/i)
  if (!match) return null

  return { chatId: chat.id, chatType: chat.type, command: match[1] as 'start' | 'help' }
}

function getMiniAppUrl() {
  try {
    const url = new URL((process.env.MINI_APP_URL || process.env.APP_URL || '').trim())
    return url.protocol === 'https:' ? url.toString().replace(/\/$/, '') : null
  } catch {
    return null
  }
}

async function replyToBotCommand(
  chatId: number,
  chatType: string,
  command: 'start' | 'help',
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is not configured')

  const miniAppUrl = getMiniAppUrl()
  const startText =
    `🎓 <b>Welcome to Hulu Academy!</b>\n\n` +
    `Freshman Second Semester Class is now live! 🌟\n\n` +
    `<b>What we offer:</b>\n` +
    `✅ High quality 4K Video Lectures\n` +
    `✅ PDF Notes in Amharic & English\n` +
    `✅ 4+ Years Past Exams with Solutions\n` +
    `✅ Chapter-wise Quizzes & Summaries\n\n` +
    `<b>Supported Departments:</b>\n` +
    `🟢 Pre-Engineering | Pre-Health | Natural Science | Social Science\n\n` +
    `🏆 <b>SPECIAL REFERRAL PROGRAM:</b>\n` +
    `Invite <b>20 verified freshman classmates</b> into our official channel using your unique link, and unlock the <b>ENTIRE Year 1 • Semester 2 Full Package</b> for FREE!\n\n` +
    (miniAppUrl ? `Tap below to open your referral dashboard:` : `The referral dashboard is temporarily unavailable.`)
  const helpText =
    `ℹ️ <b>Hulu Academy Help & Rules</b>\n\n` +
    `<b>How referrals work:</b>\n` +
    `1. Open the Mini App to get your unique referral invite link.\n` +
    `2. Share your link with freshman classmates.\n` +
    `3. When a classmate joins the official channel via your link, Telegram verifies their membership.\n` +
    `4. Your verified referral count increases by 1.\n` +
    `5. Reach 20 verified referrals to automatically unlock all course materials!\n\n` +
    `⚠️ <i>Referral links count when the user joins the channel; clicks alone do not count.</i>`

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: command === 'start' ? startText : helpText,
    parse_mode: 'HTML',
  }

  if (command === 'start' && miniAppUrl && chatType === 'private') {
    body.reply_markup = {
      inline_keyboard: [[{
        text: '🎓 Open Referral Dashboard',
        web_app: { url: miniAppUrl },
      }]],
    }
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  })
  const result = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null

  if (!response.ok || !result?.ok) {
    throw new Error(`Telegram sendMessage failed: ${result?.description || response.status}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    // Validate webhook secret token
    const secretToken = req.headers.get('x-telegram-bot-api-secret-token')
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET

    if (!expectedSecret || secretToken !== expectedSecret) {
      console.warn('Webhook: Invalid or missing secret token')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = TelegramUpdateSchema.safeParse(body)

    if (!parsed.success) {
      console.error(
        'Webhook: Invalid Telegram update payload',
        parsed.error.issues.map(({ path, code }) => ({ path, code })),
      )
      return NextResponse.json({ error: 'Invalid Telegram update' }, { status: 400 })
    }

    const update = parsed.data

    const command = parseBotCommand(update.message)
    if (command) {
      await replyToBotCommand(command.chatId, command.chatType, command.command)
      return NextResponse.json({ ok: true, action: command.command })
    }

    // Process channel join/leave events. Other update types need no action.
    if (!update.chat_member) {
      return NextResponse.json({ ok: true })
    }

    const chatMember = update.chat_member
    const newMember = chatMember.new_chat_member
    const inviteLinkUrl = chatMember.invite_link?.invite_link

    console.log(`Webhook: update_id=${update.update_id}, user=${newMember.user.id}, status=${newMember.status}`)

    const result = await processWebhookUpdate(
      update.update_id,
      chatMember.chat.id,
      chatMember.old_chat_member,
      newMember,
      newMember.user,
      inviteLinkUrl,
    )

    console.log(`Webhook result: ${result.action} — ${result.message}`)

    // Ask Telegram to retry on a transient processing error.
    if (result.action === 'ERROR') {
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: result.action })
  } catch (error) {
    console.error('Webhook fatal error:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
