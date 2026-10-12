import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Hulu Academy — Freshman Referral',
  description:
    'Invite your freshman classmates through your personalized referral link and unlock the complete Year 1 • Semester 2 tutorial package from Hulu Academy.',
  keywords: ['Hulu Academy', 'Ethiopian students', 'freshman', 'tutorial', 'referral'],
  robots: 'noindex,nofollow', // Mini App — not for public search
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A0A0A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="telegram:bot" content={process.env.NEXT_PUBLIC_BOT_USERNAME} />
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body suppressHydrationWarning>
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  )
}
