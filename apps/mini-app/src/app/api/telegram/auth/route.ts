import { NextRequest, NextResponse } from 'next/server'
import { validateTelegramInitData } from '@hulu/telegram'
import { TelegramAuthSchema } from '@hulu/validation'
import { upsertUser } from '@/lib/referral-service'
import { signAccessToken, setAuthCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = TelegramAuthSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { initData } = parsed.data
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Server-side Telegram initData validation (HMAC-SHA-256)
    let parsedInitData
    try {
      parsedInitData = validateTelegramInitData(initData, botToken)
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid or expired Telegram session' },
        { status: 401 },
      )
    }

    // Create or update user
    const user = await upsertUser(parsedInitData.user)

    if (user.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    }

    // Issue JWT
    const token = await signAccessToken({
      sub: user.id,
      telegramId: String(user.telegramUserId),
      role: user.role,
    })

    const response = NextResponse.json({ ok: true, user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      role: user.role,
    }})

    response.headers.set('Set-Cookie', setAuthCookie(token))
    return response
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
