import { describe, it, expect, vi } from 'vitest'
import { validateTelegramInitData } from '@hulu/telegram'
import crypto from 'crypto'
import {
  calculateReferralProgress,
  isReferralJoinTransition,
} from '../src/lib/referral-rules'

describe('Telegram initData Verification', () => {
  const mockBotToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'

  it('should throw an error if initData is missing or empty', () => {
    expect(() => validateTelegramInitData('', mockBotToken)).toThrow('INVALID_INIT_DATA')
  })

  it('should throw an error if hash is missing', () => {
    expect(() => validateTelegramInitData('user=%7B%22id%22%3A123%7D', mockBotToken)).toThrow(
      'INVALID_INIT_DATA: Missing hash',
    )
  })

  it('should throw an error if hash mismatch occurs (tampered initData)', () => {
    const tamperedData =
      'auth_date=1700000000&user=%7B%22id%22%3A123456%2C%22first_name%22%3A%22Test%22%7D&hash=invalidhash123'
    expect(() => validateTelegramInitData(tamperedData, mockBotToken)).toThrow(
      'INVALID_INIT_DATA: Hash mismatch',
    )
  })

  it('should correctly validate authentic Telegram initData', () => {
    const authDate = Math.floor(Date.now() / 1000)
    const userJson = JSON.stringify({ id: 987654321, first_name: 'Abebe', username: 'abebe_eth' })

    const params = new URLSearchParams()
    params.set('auth_date', String(authDate))
    params.set('user', userJson)

    // Build data-check-string
    const dataCheckString = Array.from(params.entries())
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n')

    // Generate secret key & hash
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(mockBotToken).digest()
    const validHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    params.set('hash', validHash)
    const fullInitData = params.toString()

    const result = validateTelegramInitData(fullInitData, mockBotToken)
    expect(result.user.id).toBe(987654321)
    expect(result.user.first_name).toBe('Abebe')
    expect(result.user.username).toBe('abebe_eth')
  })
})

describe('Referral Rules & Entitlement Threshold', () => {
  it('should calculate progress percentage accurately', () => {
    const threshold = 20
    const count = 7
    const percentage = Math.min(100, Math.round((count / threshold) * 100))
    expect(percentage).toBe(35)
  })

  it('should reach unlocked state at exactly 20 referrals', () => {
    expect(calculateReferralProgress(19)).toMatchObject({
      remaining: 1,
      percentage: 95,
      isUnlocked: false,
      status: 'ALMOST_THERE',
    })
    expect(calculateReferralProgress(20)).toMatchObject({
      remaining: 0,
      percentage: 100,
      isUnlocked: true,
      status: 'UNLOCKED',
    })
    expect(calculateReferralProgress(21)).toMatchObject({
      remaining: 0,
      percentage: 100,
      isUnlocked: true,
      status: 'UNLOCKED',
    })
  })

  it('counts only transitions from non-member to member', () => {
    expect(isReferralJoinTransition({ status: 'left' }, { status: 'member' })).toBe(true)
    expect(isReferralJoinTransition(
      { status: 'restricted', is_member: false },
      { status: 'restricted', is_member: true },
    )).toBe(true)
    expect(isReferralJoinTransition({ status: 'member' }, { status: 'administrator' })).toBe(false)
    expect(isReferralJoinTransition({ status: 'member' }, { status: 'left' })).toBe(false)
  })
})
