'use client'

import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { REFERRAL_THRESHOLD } from '@/lib/referral-rules'

interface Metrics {
  totalStudents: number
  totalVerifiedReferrals: number
  studentsAt20Plus: number
  activeEntitlements: number
  referralsToday: number
  suspiciousReferrals: number
}

interface UserItem {
  id: string
  telegramUserId: string
  firstName?: string
  lastName?: string
  username?: string
  role: 'STUDENT' | 'ADMIN'
  status: 'ACTIVE' | 'SUSPENDED'
  createdAt: string
  lastSeenAt?: string
  verifiedReferrals: number
  hasEntitlement: boolean
}

interface AuditLogItem {
  id: string
  admin: { firstName?: string; username?: string }
  action: string
  targetType?: string
  targetId?: string
  reason: string
  createdAt: string
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'metrics' | 'users' | 'audit'>('metrics')
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [users, setUsers] = useState<UserItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [adminTelegramId, setAdminTelegramId] = useState('')
  const [adminReason, setAdminReason] = useState('')
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const res = await fetch('/api/admin/metrics')
      if (!res.ok) throw new Error('Metrics request failed')
      setMetrics(await res.json())
      setMetricsError(null)
    } catch {
      setMetrics(null)
      setMetricsError('Could not load metrics. Please retry.')
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async (query = search) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}`)
      if (res.ok) {
        const json = await res.json()
        setUsers(json.data)
      }
    } catch { } finally {
      setLoading(false)
    }
  }, [search])

  const handleAddAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!adminTelegramId.trim() || adminReason.trim().length < 5 || addingAdmin) return

    setAddingAdmin(true)
    try {
      const res = await fetch('/api/admin/users/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: adminTelegramId.trim(),
          reason: adminReason.trim(),
        }),
      })
      const result = await res.json().catch(() => ({})) as { error?: string; alreadyAdmin?: boolean }
      if (!res.ok) {
        showToast(result.error ?? 'Could not add this admin')
        return
      }

      showToast(result.alreadyAdmin ? 'This Telegram account is already an admin' : 'Admin access granted')
      setAdminTelegramId('')
      setAdminReason('')
      setSearch('')
      await Promise.all([fetchUsers(''), fetchMetrics()])
    } catch {
      showToast('Could not add this admin')
    } finally {
      setAddingAdmin(false)
    }
  }

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/audit-logs')
      if (res.ok) {
        const json = await res.json()
        setAuditLogs(json.data)
      }
    } catch { } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  useEffect(() => {
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'audit') fetchAuditLogs()
  }, [activeTab, fetchUsers, fetchAuditLogs])

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/hulu-logo.jpg" alt="Hulu" style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--gold-border)' }} />
          <div>
            <h1 style={{ fontSize: '1.25rem' }}>Hulu Academy <span className="text-gold">Admin</span></h1>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Control Center & Audit Logs</div>
          </div>
        </div>
        <a href="/" className="btn btn-ghost btn-sm">← Mini App</a>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--gold-border)', paddingBottom: 12 }}>
        {[
          { id: 'metrics' as const, label: '📊 Metrics' },
          { id: 'users' as const, label: '👥 Users' },
          { id: 'audit' as const, label: '📜 Audit Logs' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`btn ${activeTab === t.id ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* METRICS TAB */}
      {activeTab === 'metrics' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
              Counts are calculated from database records. The daily total uses East Africa Time (UTC+3).
            </p>
            <button className="btn btn-ghost btn-sm" onClick={fetchMetrics} disabled={metricsLoading}>
              {metricsLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {metricsError && (
            <div role="alert" style={{ color: 'var(--error)', marginBottom: 16 }}>{metricsError}</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div className="metric-card">
              <div className="metric-value">{metricsLoading ? '…' : metrics?.totalStudents ?? '—'}</div>
              <div className="metric-label">Registered Students</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Accounts with the student role, including suspended accounts.</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metricsLoading ? '…' : metrics?.totalVerifiedReferrals ?? '—'}</div>
              <div className="metric-label">Verified Channel Referrals</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Referral records with VERIFIED status; each referred account can count once.</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metricsLoading ? '…' : metrics?.studentsAt20Plus ?? '—'}</div>
              <div className="metric-label">Students with {REFERRAL_THRESHOLD}+ Verified Referrals</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Counted from referral records, independently of entitlement rows.</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metricsLoading ? '…' : metrics?.activeEntitlements ?? '—'}</div>
              <div className="metric-label">Active Entitlements</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Active records that have not expired.</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metricsLoading ? '…' : metrics?.referralsToday ?? '—'}</div>
              <div className="metric-label">Verified Referrals Today (EAT)</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Uses verification time from midnight to midnight, UTC+3.</div>
            </div>
            <div className="metric-card">
              <div className="metric-value" style={{ color: metrics?.suspiciousReferrals ? 'var(--error)' : 'var(--gold-primary)' }}>
                {metricsLoading ? '…' : metrics?.suspiciousReferrals ?? '—'}
              </div>
              <div className="metric-label">Flagged Referrals</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Referral records marked suspicious, regardless of current status.</div>
            </div>
          </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="admin-users-content">
          <form className="card admin-add-admin-form" onSubmit={handleAddAdmin}>
            <div>
              <h2 style={{ fontSize: '1.05rem', marginBottom: 6 }}>Add administrator</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
                Enter their Telegram user ID. They can open the Mini App later to add their profile details.
              </p>
            </div>
            <div className="admin-add-admin-fields">
              <label className="admin-form-field">
                <span>Telegram user ID</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={20}
                  pattern="[1-9][0-9]*"
                  placeholder="e.g. 123456789"
                  value={adminTelegramId}
                  onChange={e => setAdminTelegramId(e.target.value)}
                  required
                />
              </label>
              <label className="admin-form-field">
                <span>Audit reason</span>
                <input
                  type="text"
                  minLength={5}
                  placeholder="Why are you adding this admin?"
                  value={adminReason}
                  onChange={e => setAdminReason(e.target.value)}
                  required
                />
              </label>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={addingAdmin || !/^[1-9]\d{0,19}$/.test(adminTelegramId) || adminReason.trim().length < 5}
              >
                {addingAdmin ? 'Adding…' : 'Add admin'}
              </button>
            </div>
          </form>

          <div className="admin-users-toolbar">
            <input
              type="text"
              aria-label="Search users"
              placeholder="Search name, username, or Telegram ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchUsers() }}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchUsers()}>Search users</button>
          </div>

          <div className="admin-users-table-heading">
            <div>
              <h2>Members</h2>
              <p>Registered Telegram accounts and their referral access.</p>
            </div>
            <span aria-live="polite">{loading ? 'Loading…' : `${users.length} shown`}</span>
          </div>
          <p className="admin-table-scroll-hint">Swipe horizontally to see all columns.</p>
          <div className="card admin-users-table-wrap">
            <table className="admin-table admin-users-table" aria-label="Registered members">
              <caption className="admin-visually-hidden">Member account, Telegram ID, role, referral count, entitlement, and status</caption>
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Telegram ID</th>
                  <th scope="col">Role</th>
                  <th scope="col">Referrals</th>
                  <th scope="col">Entitlement</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="admin-users-message-row"><td colSpan={6}>Loading users...</td></tr>
                ) : users.length === 0 ? (
                  <tr className="admin-users-message-row"><td colSpan={6}>No users found</td></tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-member-cell">
                        <span className="admin-member-avatar" aria-hidden="true">
                          {(u.firstName?.trim().charAt(0) || (u.role === 'ADMIN' ? 'A' : 'S')).toUpperCase()}
                        </span>
                        <span className="admin-member-details">
                          <span className="admin-member-name">
                            {[u.firstName, u.lastName].filter(Boolean).join(' ') || (u.role === 'ADMIN' ? 'Admin profile pending' : 'Student')}
                          </span>
                          {u.username && <span className="admin-member-username">@{u.username}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="admin-telegram-id">{u.telegramUserId}</td>
                    <td><span className={`badge ${u.role === 'ADMIN' ? 'badge-gold' : 'badge-pending'}`}>{u.role}</span></td>
                    <td>
                      <span className="admin-referrals-value">
                        <strong>{u.verifiedReferrals}</strong><span> / {REFERRAL_THRESHOLD}</span>
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.hasEntitlement ? 'badge-verified' : 'badge-pending'}`}>
                        {u.hasEntitlement ? 'ACTIVE' : 'LOCKED'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'ACTIVE' ? 'badge-gold' : 'badge-rejected'}`}>
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'audit' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Action</th>
                <th>Target</th>
                <th>Reason</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>Loading audit logs...</td></tr>
              ) : auditLogs.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>No audit logs recorded</td></tr>
              ) : auditLogs.map(log => (
                <tr key={log.id}>
                  <td>{log.admin.firstName ?? log.admin.username ?? 'Admin'}</td>
                  <td><span className="badge badge-gold">{log.action}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{log.targetType}: {log.targetId?.slice(0, 8)}...</td>
                  <td>{log.reason}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
