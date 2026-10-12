import { NextRequest, NextResponse } from 'next/server'
import { TelegramUpdateSchema } from '@hulu/validation'
import { processWebhookUpdate } from '@/lib/referral-service'

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

    // Only process chat_member updates (channel join/leave events)
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

    // Ask the polling bot or Telegram to retry on a transient processing error.
    if (result.action === 'ERROR') {
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: result.action })
  } catch (error) {
    console.error('Webhook fatal error:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
