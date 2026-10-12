import crypto from 'crypto'

export interface TelegramInitDataUser {
  id: number
  is_bot?: boolean | undefined
  first_name: string
  last_name?: string | undefined
  username?: string | undefined
  language_code?: string | undefined
  is_premium?: boolean | undefined
  photo_url?: string | undefined
}

export interface ParsedInitData {
  user: TelegramInitDataUser
  auth_date: number
  hash: string
  query_id?: string | undefined
  chat_type?: string | undefined
  chat_instance?: string | undefined
}

/**
 * Validates Telegram Mini App initData using HMAC-SHA-256.
 * Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * NEVER call this on the client side. Bot token must stay on the server.
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 3600,
): ParsedInitData {
  if (!initData || !botToken) {
    throw new Error('INVALID_INIT_DATA: Missing initData or bot token')
  }

  // Parse the query string
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')

  if (!hash) {
    throw new Error('INVALID_INIT_DATA: Missing hash')
  }

  // Build data-check-string: all fields except hash, sorted alphabetically, joined with \n
  const dataCheckEntries: string[] = []
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') {
      dataCheckEntries.push(`${key}=${value}`)
    }
  }
  dataCheckEntries.sort()
  const dataCheckString = dataCheckEntries.join('\n')

  // Derive secret key: HMAC-SHA-256("WebAppData", botToken)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  // Calculate expected hash
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  // Constant-time comparison to prevent timing attacks. Check lengths first
  // because timingSafeEqual throws when the supplied hash is malformed.
  const expectedHashBuffer = Buffer.from(expectedHash, 'hex')
  const actualHashBuffer = Buffer.from(hash, 'hex')
  if (
    actualHashBuffer.length !== expectedHashBuffer.length ||
    !crypto.timingSafeEqual(expectedHashBuffer, actualHashBuffer)
  ) {
    throw new Error('INVALID_INIT_DATA: Hash mismatch')
  }

  // Validate freshness
  const authDateRaw = params.get('auth_date')
  if (!authDateRaw) {
    throw new Error('INVALID_INIT_DATA: Missing auth_date')
  }

  const authDate = parseInt(authDateRaw, 10)
  const now = Math.floor(Date.now() / 1000)

  if (now - authDate > maxAgeSeconds) {
    throw new Error('INVALID_INIT_DATA: Data is too old (expired)')
  }

  // Parse user
  const userRaw = params.get('user')
  if (!userRaw) {
    throw new Error('INVALID_INIT_DATA: Missing user field')
  }

  let user: TelegramInitDataUser
  try {
    user = JSON.parse(userRaw) as TelegramInitDataUser
  } catch {
    throw new Error('INVALID_INIT_DATA: Invalid user JSON')
  }

  if (!user.id || !user.first_name) {
    throw new Error('INVALID_INIT_DATA: User data is incomplete')
  }

  return {
    user,
    auth_date: authDate,
    hash,
    query_id: params.get('query_id') ?? undefined,
    chat_type: params.get('chat_type') ?? undefined,
    chat_instance: params.get('chat_instance') ?? undefined,
  }
}

/**
 * Returns the Telegram Bot API base URL.
 */
export function getBotApiUrl(botToken: string, method: string): string {
  return `https://api.telegram.org/bot${botToken}/${method}`
}

/**
 * Creates a unique channel invite link for referral tracking.
 * The bot must be a channel administrator.
 */
export async function createChannelInviteLink(
  botToken: string,
  chatId: string | number,
  creatorName: string,
): Promise<{ invite_link: string; telegram_invite_id: string }> {
  const url = getBotApiUrl(botToken, 'createChatInviteLink')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      name: `Ref: ${creatorName}`.substring(0, 32),
      creates_join_request: false,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Telegram API error creating invite link: ${error}`)
  }

  const data = (await response.json()) as {
    ok: boolean
    result: {
      invite_link: string
      name?: string
    }
  }

  if (!data.ok || !data.result?.invite_link) {
    throw new Error('Telegram API: Failed to create invite link')
  }

  return {
    invite_link: data.result.invite_link,
    telegram_invite_id: data.result.invite_link, // URL serves as ID
  }
}

/**
 * Sends a message to a Telegram user.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
): Promise<void> {
  const url = getBotApiUrl(botToken, 'sendMessage')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`Failed to send Telegram message: ${error}`)
    // Do not throw — notification failure should not break main flow
  }
}

/**
 * Registers the webhook with Telegram.
 * Call this during deployment setup.
 */
export async function setWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken: string,
): Promise<void> {
  const url = getBotApiUrl(botToken, 'setWebhook')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ['chat_member', 'message', 'callback_query'],
      drop_pending_updates: false,
    }),
  })

  const data = await response.json()
  if (!(data as { ok: boolean }).ok) {
    throw new Error(`Failed to set webhook: ${JSON.stringify(data)}`)
  }
}
