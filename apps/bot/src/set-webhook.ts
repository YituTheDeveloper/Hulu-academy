import dotenv from 'dotenv'
import { getBotApiUrl, setWebhook } from '@hulu/telegram'

dotenv.config({ path: '../../.env.local' })
dotenv.config({ path: '../../.env' })

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required in the root .env.local file')
  process.exitCode = 1
} else {
  configureWebhook(token).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Telegram webhook setup failed')
    process.exitCode = 1
  })
}

async function configureWebhook(botToken: string) {
  if (process.argv.includes('--delete')) {
    const response = await fetch(getBotApiUrl(botToken, 'deleteWebhook'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: false }),
    })
    const result = await response.json() as { ok?: boolean; description?: string }
    if (!response.ok || !result.ok) {
      throw new Error(`Failed to remove Telegram webhook: ${result.description || response.status}`)
    }
    console.log('Telegram webhook removed. Long polling can be used for local development.')
    return
  }

  const miniAppUrl = (process.env.MINI_APP_URL || process.env.APP_URL || '').trim().replace(/\/+$/, '')
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (!miniAppUrl.startsWith('https://')) {
    throw new Error('Set MINI_APP_URL to the deployed HTTPS URL in the root .env.local file')
  }
  if (!webhookSecret) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET is required in the root .env.local file')
  }
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET must use only letters, numbers, underscores, or hyphens')
  }

  await setWebhook(botToken, `${miniAppUrl}/api/webhooks/telegram`, webhookSecret)
  console.log(`Telegram webhook configured for ${miniAppUrl}/api/webhooks/telegram`)
}
