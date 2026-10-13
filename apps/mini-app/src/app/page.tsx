'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTelegram } from '@/hooks/useTelegram'

interface ReferralData {
  inviteUrl: string
  shareMessage: string
  verifiedCount: number
  remaining: number
  percentage: number
  threshold: number
  isUnlocked: boolean
  status: string
}

interface UserData {
  id: string
  firstName: string
  lastName?: string
  username?: string
  role: string
}

type Screen = 'welcome' | 'dashboard' | 'activity' | 'unlocked' | 'materials' | 'locked'

export default function MiniApp() {
  const { webApp, user: tgUser, isReady } = useTelegram()
  const [screen, setScreen] = useState<Screen>('welcome')
  const [userData, setUserData] = useState<UserData | null>(null)
  const [referral, setReferral] = useState<ReferralData | null>(null)
  const [referralError, setReferralError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [authDone, setAuthDone] = useState(false)

  // Authenticate with backend using Telegram initData
  const authenticate = useCallback(async () => {
    if (!webApp?.initData) {
      console.log('No webApp.initData present')
      return false
    }
    setLoading(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    try {
      console.log('Authenticating with Telegram initData...')
      const res = await fetch('/api/telegram/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: webApp.initData }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Auth response not ok:', res.status, errorText)
        throw new Error(`Auth failed (${res.status}): ${errorText}`)
      }
      const data = await res.json() as { user: UserData }
      console.log('Auth successful:', data.user)
      setUserData(data.user)
      setAuthDone(true)
      return true
    } catch (e: any) {
      console.error('Auth error:', e)
      showToast(
        e.name === 'AbortError'
          ? 'Authentication is taking too long. Please try again.'
          : e.message || 'Authentication failed. Please restart the app.'
      )
      return false
    } finally {
      window.clearTimeout(timeout)
      setLoading(false)
    }
  }, [webApp])

  // Load referral data
  const loadReferral = useCallback(async () => {
    try {
      const res = await fetch('/api/referral')
      if (!res.ok) {
        setReferralError(
          res.status === 401
            ? 'Your Telegram session expired. Close and reopen the Mini App from the bot.'
            : 'Could not load your referral dashboard. Check that the bot can create invite links in the official channel, then try again.'
        )
        return
      }
      const data = await res.json() as ReferralData
      setReferral(data)
      setReferralError(null)
      if (data.isUnlocked && screen === 'dashboard') {
        // Show unlocked screen if just reached threshold
      }
    } catch (error) {
      console.error('Referral data request failed:', error)
      setReferralError('Could not connect to the referral service. Check your connection and try again.')
    }
  }, [screen])

  useEffect(() => {
    if (isReady && webApp?.initData) {
      authenticate()
    }
  }, [isReady, webApp, authenticate])

  useEffect(() => {
    if (authDone) {
      loadReferral()
    }
  }, [authDone, loadReferral])

  // Poll referral data every 30s when on dashboard
  useEffect(() => {
    if (screen !== 'dashboard' || !authDone) return
    const interval = setInterval(loadReferral, 30_000)
    return () => clearInterval(interval)
  }, [screen, authDone, loadReferral])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const copyLink = async () => {
    if (!referral?.inviteUrl) return
    try {
      await navigator.clipboard.writeText(referral.inviteUrl)
      showToast('✓ Link copied!')
    } catch {
      showToast('Could not copy link')
    }
  }

  const shareLink = () => {
    if (!referral) return
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(referral.inviteUrl)}&text=${encodeURIComponent(referral.shareMessage)}`
      )
    }
  }

  const openChannel = () => {
    webApp?.openTelegramLink('https://t.me/' + (process.env.NEXT_PUBLIC_CHANNEL_USERNAME ?? ''))
  }

  const [devPreview, setDevPreview] = useState(false)

  // ── LOADING STATE ──────────────────────────────────────────────────
  if (!isReady || loading) {
    return (
      <LoadingScreen
        onSkip={() => {
          setLoading(false)
          setAuthDone(true)
          setUserData({ id: 'student', firstName: tgUser?.first_name || 'Student', role: 'STUDENT' })
        }}
      />
    )
  }

  // ── Not in Telegram — show friendly message ────────────────────────
  if ((!webApp || !tgUser) && !devPreview) {
    return (
      <OpenInTelegramScreen
        onDevPreview={() => {
          setDevPreview(true)
          setUserData({ id: 'demo-user', firstName: 'Student (Preview)', role: 'STUDENT' })
          setReferral({
            inviteUrl: 'https://t.me/+hulu_demo_invite_link',
            shareMessage: 'Join Hulu Academy freshman channel!',
            verifiedCount: 7,
            remaining: 13,
            percentage: 35,
            threshold: 20,
            isUnlocked: false,
            status: 'IN_PROGRESS',
          })
          setAuthDone(true)
        }}
      />
    )
  }

  // ── SCREENS ────────────────────────────────────────────────────────
  return (
    <>
      {screen === 'welcome' && (
        <WelcomeScreen
          isAdmin={userData?.role === 'ADMIN'}
          onOpen={async () => {
            if (authDone) {
              setScreen('dashboard')
              return
            }

            if (await authenticate()) setScreen('dashboard')
          }}
          onChannel={openChannel}
        />
      )}

      {screen === 'dashboard' && referral && (
        <DashboardScreen
          user={userData}
          referral={referral}
          onCopy={copyLink}
          onShare={shareLink}
          onChannel={openChannel}
          onActivity={() => setScreen('activity')}
          onMaterials={() => setScreen(referral.isUnlocked ? 'unlocked' : 'locked')}
        />
      )}

      {screen === 'dashboard' && !referral && referralError && (
        <div className="page-content">
          <div className="card" role="alert" style={{ display: 'block', textAlign: 'center', padding: 24 }}>
            <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>Dashboard could not load</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{referralError}</p>
            <button className="btn btn-primary btn-sm" onClick={() => void loadReferral()}>
              Try again
            </button>
          </div>
        </div>
      )}

      {screen === 'dashboard' && !referral && !referralError && (
        <DashboardSkeleton />
      )}

      {screen === 'activity' && (
        <ActivityScreen onBack={() => setScreen('dashboard')} />
      )}

      {screen === 'unlocked' && referral?.isUnlocked && (
        <UnlockedScreen
          onOpenMaterials={() => setScreen('materials')}
          onDashboard={() => setScreen('dashboard')}
          onShare={shareLink}
        />
      )}

      {screen === 'locked' && (
        <LockedScreen
          referral={referral}
          onShare={shareLink}
          onCopy={copyLink}
          onBack={() => setScreen('dashboard')}
        />
      )}

      {screen === 'materials' && referral?.isUnlocked && (
        <MaterialsScreen onBack={() => setScreen('dashboard')} />
      )}

      {/* Bottom Navigation */}
      {authDone && screen !== 'welcome' && (
        <BottomNav
          current={screen}
          isUnlocked={referral?.isUnlocked ?? false}
          onNavigate={setScreen}
        />
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// SCREEN: Loading
// ══════════════════════════════════════════════════════════════

function LoadingScreen({ onSkip }: { onSkip?: () => void }) {
  const [showSkip, setShowSkip] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowSkip(true), 4000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 20, padding: 24, textAlign: 'center' }}>
      <img src="/hulu-logo.jpg" alt="Hulu Academy" style={{ width: 72, height: 72, borderRadius: '50%', border: '2px solid rgba(212,175,55,0.4)' }} />
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: '#D4AF37',
            animation: `pulse 1.2s ${i * 0.2}s infinite ease-in-out`,
          }} />
        ))}
      </div>
      {showSkip && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 10 }}>Taking longer than usual?</p>
          <button
            onClick={() => {
              if (onSkip) onSkip()
              else window.location.reload()
            }}
            className="btn btn-secondary btn-sm"
          >
            Continue to App →
          </button>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// SCREEN: Open In Telegram
// ══════════════════════════════════════════════════════════════

function OpenInTelegramScreen({ onDevPreview }: { onDevPreview?: () => void }) {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'Hulu_Academy_Tutors_bot'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', padding: 32, textAlign: 'center', gap: 20 }}>
      <img src="/hulu-logo.jpg" alt="Hulu Academy" style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid rgba(212,175,55,0.4)' }} />
      <h1 className="text-gold" style={{ fontSize: '1.5rem' }}>Hulu Academy</h1>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        This app is designed to run inside the Telegram Mini App.<br />
        Please open it from the <strong>@{botUsername}</strong> bot.
      </p>
      <a href={`https://t.me/${botUsername}`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
        Open in Telegram
      </a>

      {process.env.NODE_ENV === 'development' && onDevPreview && (
        <button
          onClick={onDevPreview}
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 12, border: '1px dashed var(--gold-border)', color: 'var(--gold-primary)' }}
        >
          🛠️ Preview UI (Dev Mode)
        </button>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// SCREEN: Welcome / Onboarding
// ══════════════════════════════════════════════════════════════

function WelcomeScreen({ isAdmin, onOpen, onChannel }: { isAdmin: boolean; onOpen: () => void; onChannel: () => void }) {
  return (
    <div className="page-content animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 48 }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: 24 }}>
          <div style={{ position: 'relative', width: 96, height: 96 }}>
            <div style={{
              position: 'absolute', inset: -8,
              background: 'radial-gradient(ellipse, rgba(212,175,55,0.25) 0%, transparent 70%)',
              borderRadius: '50%',
            }} />
            <img
              src="/hulu-logo.jpg"
              alt="Hulu Academy"
              style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid rgba(212,175,55,0.5)', position: 'relative', objectFit: 'cover' }}
            />
          </div>
        </div>

        <div className="badge badge-gold" style={{ marginBottom: 16, maxWidth: '100%', justifyContent: 'center', whiteSpace: 'normal' }}>
          🎓 Master Every Courses. Ace Every Exam. Reach 4.00. Join Your Dream Department
        </div>

        <h1 style={{ marginBottom: 12, lineHeight: 1.2 }}>
          Welcome to{' '}
          <span className="text-gold">Hulu Academy</span>
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
          Invite your freshman classmates and unlock the complete{' '}
          <strong style={{ color: 'var(--gold-primary)' }}>Year 1 • Semester 2</strong>{' '}
          tutorial package.
        </p>
      </div>

      {/* Features */}
      <div className="card stagger-children" style={{ gap: 12, display: 'flex', flexDirection: 'column' }}>
        {[
          { icon: '📹', label: 'UHD Video Mastery' },
          { icon: '📄', label: 'Bilingual Concept Clarity' },
          { icon: '📝', label: 'Proven Past Exams' },
          { icon: '🧠', label: 'Quick Quiz & Recap' },
          { icon: '🎯', label: 'Precision Exam Prep' },
        ].map(({ icon, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.25rem', width: 28 }}>{icon}</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Trust note */}
      <div style={{
        background: 'rgba(109,76,0,0.08)',
        border: '1px solid rgba(212,175,55,0.15)',
        borderRadius: 12,
        padding: '12px 16px',
        fontSize: '0.8125rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
        lineHeight: 1.6,
      }}>
        🔒 Referrals are verified through <strong>real Telegram channel membership</strong> — not just link clicks.
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn btn-primary btn-full btn-lg animate-pulse-gold" onClick={onOpen}>
          Open My Referral Dashboard
        </button>
        <button className="btn btn-secondary btn-full" onClick={onChannel}>
          Join the Official Channel
        </button>
        {isAdmin && (
          <a href="/admin" className="btn btn-ghost btn-full" style={{ textAlign: 'center', textDecoration: 'none' }}>
            Open Admin Dashboard
          </a>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// SCREEN: Dashboard
// ══════════════════════════════════════════════════════════════

function DashboardScreen({
  user, referral, onCopy, onShare, onChannel, onActivity, onMaterials
}: {
  user: UserData | null
  referral: ReferralData
  onCopy: () => void
  onShare: () => void
  onChannel: () => void
  onActivity: () => void
  onMaterials: () => void
}) {
  const radius = 80
  const circumference = 2 * Math.PI * radius
  const filled = circumference - (circumference * referral.percentage) / 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="app-header">
        <div className="logo-container">
          <img src="/hulu-logo.jpg" alt="Hulu Academy" className="logo-image" />
          <span className="logo-text">
            <span className="text-gold">Hulu</span> Academy
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {user?.firstName ?? 'Student'}
          </div>
          {user?.role === 'ADMIN' && (
            <a href="/admin" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
              Admin
            </a>
          )}
        </div>
      </div>

      <div className="page-content stagger-children" style={{ paddingTop: 0 }}>
        {/* Hero Progress Card */}
        <div className="card-hero" style={{ marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 20 }}>
            Your Referral Progress
          </div>

          {/* Progress Ring */}
          <div className="progress-ring-container" style={{ margin: '0 auto 20px', width: 200, height: 200 }}>
            <svg width="200" height="200" className="progress-ring-svg">
              <defs>
                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6D4C00" />
                  <stop offset="25%" stopColor="#B8860B" />
                  <stop offset="50%" stopColor="#D4AF37" />
                  <stop offset="75%" stopColor="#C9A227" />
                  <stop offset="100%" stopColor="#6D4C00" />
                </linearGradient>
              </defs>
              <circle className="progress-ring-track" cx="100" cy="100" r={radius} />
              <circle
                className="progress-ring-fill"
                cx="100" cy="100" r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={filled}
              />
            </svg>
            <div className="progress-ring-text">
              <div className="progress-count">{referral.verifiedCount}</div>
              <div className="progress-total">/ {referral.threshold}</div>
            </div>
          </div>

          {/* Stats Row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gold-primary)' }}>
                {referral.verifiedCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Verified
              </div>
            </div>
            <div style={{ width: 1, background: 'var(--gold-border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {referral.remaining}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Remaining
              </div>
            </div>
            <div style={{ width: 1, background: 'var(--gold-border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gold-primary)' }}>
                {referral.percentage}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Progress
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className={`badge ${referral.isUnlocked ? 'badge-verified' : referral.status === 'ALMOST_THERE' ? 'badge-pending' : 'badge-gold'}`}>
              {referral.isUnlocked ? '🏆 Package Unlocked!' : referral.status === 'ALMOST_THERE' ? '⚡ Almost There!' : '📊 In Progress'}
            </div>
          </div>
        </div>

        {/* Referral Link */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
            My Referral Link
          </div>
          <div className="referral-link-box" style={{ marginBottom: 12 }}>
            <span className="referral-link-text">{referral.inviteUrl}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={onCopy}>
              📋 Copy Link
            </button>
            <button className="btn btn-primary btn-sm" onClick={onShare}>
              📤 Share
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-ghost btn-full" onClick={onActivity} style={{ justifyContent: 'space-between', borderRadius: 12 }}>
            <span>📋 View Referral Activity</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
          </button>
          <button className="btn btn-ghost btn-full" onClick={onChannel} style={{ justifyContent: 'space-between', borderRadius: 12 }}>
            <span>📢 Open Official Channel</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
          </button>
          {referral.isUnlocked && (
            <button className="btn btn-primary btn-full" onClick={onMaterials} style={{ borderRadius: 12 }}>
              🎓 Open Full Package
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// SCREEN: Dashboard Skeleton
// ══════════════════════════════════════════════════════════════

function DashboardSkeleton() {
  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="skeleton" style={{ height: 280, borderRadius: 20 }} />
      <div className="skeleton" style={{ height: 120, borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 48, borderRadius: 12 }} />
      <div className="skeleton" style={{ height: 48, borderRadius: 12 }} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// SCREEN: Referral Activity
// ══════════════════════════════════════════════════════════════

function ActivityScreen({ onBack }: { onBack: () => void }) {
  const [activity, setActivity] = useState<{ data: Array<{ id: string; status: string; referredMasked: string; verifiedAt: string | null; createdAt: string }>; pagination: { total: number } } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadActivity() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/referral/activity')
        const result = await response.json()

        if (!response.ok || !Array.isArray(result.data) || !result.pagination) {
          throw new Error(
            response.status === 401
              ? 'Your Telegram session expired. Close and reopen the Mini App from the bot.'
              : `Could not load referral activity (HTTP ${response.status}). Please check the Mini App server log and try again.`
          )
        }

        if (!cancelled) setActivity(result)
      } catch (cause) {
        console.error('Referral activity request failed:', cause)
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load referral activity. Please try again.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadActivity()
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <div className="app-header">
        <button onClick={onBack} className="btn btn-ghost btn-sm">← Back</button>
        <h2 style={{ fontSize: '1rem' }}>Referral Activity</h2>
        <div style={{ width: 60 }} />
      </div>

      <div className="page-content">
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}
          </div>
        ) : error ? (
          <div className="card" role="alert" style={{ display: 'block', textAlign: 'center', padding: 24 }}>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{error}</p>
            <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
              Reopen app
            </button>
          </div>
        ) : !activity ? (
          <div className="card" role="status" style={{ display: 'block', textAlign: 'center', padding: 24 }}>
            <p style={{ color: 'var(--text-secondary)' }}>No activity data was returned.</p>
          </div>
        ) : activity.data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📭</div>
            <p>No referrals yet. Share your link to get started!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              {activity.pagination.total} total referral{activity.pagination.total !== 1 ? 's' : ''}
            </div>
            {activity.data.map((r) => (
              <div key={r.id} className="card" style={{ padding: '14px 16px', flexDirection: 'row', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{r.referredMasked}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {r.verifiedAt ? new Date(r.verifiedAt).toLocaleDateString() : new Date(r.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className={`badge badge-${r.status.toLowerCase()}`}>{r.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// SCREEN: Reward Unlocked
// ══════════════════════════════════════════════════════════════

function UnlockedScreen({ onOpenMaterials, onDashboard, onShare }: {
  onOpenMaterials: () => void
  onDashboard: () => void
  onShare: () => void
}) {
  return (
    <div className="page-content celebration-bg animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 24, paddingTop: 48 }}>
      <div style={{
        width: 120, height: 120,
        borderRadius: '50%',
        background: 'var(--gradient-gold)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '3.5rem',
        animation: 'celebrate 0.6s ease forwards',
        boxShadow: 'var(--shadow-gold)',
      }}>
        🏆
      </div>

      <div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 12, lineHeight: 1.3 }}>
          Congratulations —{' '}
          <span className="text-gold">Full Package Unlocked!</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9375rem' }}>
          You reached <strong style={{ color: 'var(--gold-primary)' }}>20 verified freshman referrals</strong>.{' '}
          Your <strong>Year 1 • Semester 2 Full Tutorial Package</strong> is now available.
        </p>
      </div>

      <div className="card" style={{ width: '100%', textAlign: 'left' }}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Package Includes
        </div>
        {['4K Video Lectures', 'PDFs, Notes (Amharic & English)', 'Past Exam Papers + Answers', 'Chapter Quizzes & Summaries', 'Exam-focused Practice'].map(item => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>✓</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <button className="btn btn-primary btn-full btn-lg" onClick={onOpenMaterials}>
          🎓 Open Full Package
        </button>
        <button className="btn btn-secondary btn-full" onClick={onDashboard}>
          View My Dashboard
        </button>
        <button className="btn btn-ghost btn-full" onClick={onShare}>
          📤 Share Hulu Academy
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// SCREEN: Locked Materials
// ══════════════════════════════════════════════════════════════

function LockedScreen({ referral, onShare, onCopy, onBack }: {
  referral: ReferralData | null
  onShare: () => void
  onCopy: () => void
  onBack: () => void
}) {
  const count = referral?.verifiedCount ?? 0
  const remaining = referral?.remaining ?? 20

  return (
    <div>
      <div className="app-header">
        <button onClick={onBack} className="btn btn-ghost btn-sm">← Back</button>
        <h2 style={{ fontSize: '1rem' }}>Tutorial Package</h2>
        <div style={{ width: 60 }} />
      </div>
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Lock Visual */}
        <div className="card-hero" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
          <h2 style={{ marginBottom: 8 }}>
            1 Semester{' '}
            <span className="text-gold">Full Package</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
            Invite <strong style={{ color: 'var(--gold-primary)' }}>{remaining} more student{remaining !== 1 ? 's' : ''}</strong> to unlock all course materials.
          </p>
          {/* Mini progress bar */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 999, height: 8, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%',
              width: `${referral?.percentage ?? 0}%`,
              background: 'var(--gradient-gold)',
              borderRadius: 999,
              transition: 'width 0.8s ease',
            }} />
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {count} / 20 verified referrals
          </div>
        </div>

        {/* Course Preview */}
        <div className="card">
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
            Course Preview
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Communicative English Language Skills 2',
              'Applied Mathematics 1',
              'Computer Programming',
              'Biology',
              'Chemistry',
              'Civics & Moral Education',
              '+ 11 more courses',
            ].map((course, i) => (
              <div key={course} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0',
                borderBottom: i < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                opacity: i === 6 ? 0.6 : 1,
              }}>
                <span style={{ color: i === 6 ? 'var(--text-muted)' : 'var(--text-muted)', fontSize: '1rem' }}>
                  {i === 6 ? '•••' : '📚'}
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: i === 6 ? 'italic' : 'normal' }}>
                  {course}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.875rem' }}>🔒</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={onCopy}>📋 Copy Link</button>
          <button className="btn btn-primary btn-sm" onClick={onShare}>📤 Invite Students</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// SCREEN: Materials (unlocked)
// ══════════════════════════════════════════════════════════════

function MaterialsScreen({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<{ product: { name: string }; materials: Array<{ id: string; title: string; description?: string; fileType?: string }> } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/materials').then(r => r.json()).then(setData).catch(() => {})
  }, [])

  const openMaterial = async (id: string) => {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/materials/${id}`)
      const json = await res.json() as { signedUrl?: string; error?: string }
      if (json.signedUrl) {
        window.open(json.signedUrl, '_blank')
      }
      setSelectedId(id)
    } catch {} finally {
      setLoadingId(null)
    }
  }

  const fileTypeIcon = (ft?: string) => {
    if (!ft) return '📁'
    if (ft === 'video') return '🎬'
    if (ft === 'pdf') return '📄'
    if (ft === 'image') return '🖼️'
    if (ft === 'ppt') return '📊'
    return '📚'
  }

  return (
    <div>
      <div className="app-header">
        <button onClick={onBack} className="btn btn-ghost btn-sm">← Back</button>
        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
          <span className="text-gold">Full Package</span>
        </div>
        <div style={{ width: 60 }} />
      </div>
      <div className="page-content">
        {!data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.125rem', marginBottom: 4 }}>
                <span className="text-gold">{data.product.name}</span>
              </h2>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {data.materials.length} courses available
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.materials.map(m => (
                <button
                  key={m.id}
                  className="card"
                  style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', background: 'none', border: '1px solid var(--gold-border)', width: '100%' }}
                  onClick={() => openMaterial(m.id)}
                  disabled={loadingId === m.id}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: 'rgba(212,175,55,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.25rem', flexShrink: 0,
                  }}>
                    {loadingId === m.id ? '⏳' : fileTypeIcon(m.fileType ?? undefined)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{m.title}</div>
                    {m.description && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.description}
                      </div>
                    )}
                  </div>
                  <span style={{ color: 'var(--gold-primary)', fontSize: '1.25rem' }}>→</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// COMPONENT: Bottom Navigation
// ══════════════════════════════════════════════════════════════

function BottomNav({
  current, isUnlocked, onNavigate,
}: {
  current: Screen
  isUnlocked: boolean
  onNavigate: (s: Screen) => void
}) {
  const items = [
    { id: 'dashboard' as Screen, label: 'Home', icon: '🏠' },
    { id: 'activity' as Screen, label: 'Activity', icon: '📋' },
    { id: isUnlocked ? 'unlocked' : 'locked' as Screen, label: 'Package', icon: isUnlocked ? '🎓' : '🔒' },
  ]

  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <button
          key={item.id}
          className={`bottom-nav-item ${current === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span className="bottom-nav-icon" style={{ fontSize: '1.25rem' }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
