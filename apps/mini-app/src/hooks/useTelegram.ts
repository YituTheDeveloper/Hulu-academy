'use client'

import { useEffect, useState } from 'react'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    query_id?: string
    user?: TelegramUser
    auth_date?: number
    hash?: string
  }
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  headerColor: string
  backgroundColor: string
  ready: () => void
  expand: () => void
  close: () => void
  openTelegramLink: (url: string) => void
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    isProgressVisible: boolean
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

export function useTelegram() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let attempts = 0
    const checkTelegram = () => {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const app = window.Telegram.WebApp

        // Publish the SDK state before calling optional host methods. Some
        // Telegram clients/WebViews can throw from these methods; that must
        // not leave the app's startup screen waiting forever.
        setWebApp(app)
        if (app.initDataUnsafe?.user) {
          setUser(app.initDataUnsafe.user)
        }
        setIsReady(true)

        try {
          app.ready()
        } catch (error) {
          console.warn('Telegram WebApp ready() failed:', error)
        }

        try {
          app.expand()
        } catch (error) {
          console.warn('Telegram WebApp expand() failed:', error)
        }

        return true
      }
      return false
    }

    if (checkTelegram()) return

    const interval = setInterval(() => {
      attempts++
      if (checkTelegram() || attempts > 20) {
        clearInterval(interval)
        setIsReady(true)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [])

  return {
    webApp,
    user,
    isReady,
  }
}
