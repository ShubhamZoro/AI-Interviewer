import React, { useState } from 'react'
import './index.css'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import InterviewPage from './pages/InterviewPage'
import FeedbackPage from './pages/FeedbackPage'
import ReportsPage from './pages/ReportsPage'

export default function App() {
  const { user, loading, signOut } = useAuth()
  const [page, setPage] = useState('setup')       // 'setup' | 'interview' | 'feedback' | 'reports'
  const [sessionData, setSessionData] = useState(null)
  const [feedbackData, setFeedbackData] = useState(null)

  // ── Auth loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg-primary)',
        flexDirection: 'column', gap: 20,
      }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Checking authentication…</p>
      </div>
    )
  }

  // ── Not logged in ──────────────────────────────────────────
  if (!user) return <LoginPage />

  // ── Handlers ───────────────────────────────────────────────
  const handleInterviewStart = (data) => { setSessionData(data); setPage('interview') }
  const handleInterviewEnd = (fb) => { setFeedbackData(fb); setPage('feedback') }
  const handleRestart = () => { setSessionData(null); setFeedbackData(null); setPage('setup') }

  // ── Header ─────────────────────────────────────────────────
  const Header = () => (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(10,9,20,0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* Brand */}
      <div
        onClick={() => setPage('setup')}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <span style={{ fontSize: '1.3rem' }}>🎙️</span>
        <span style={{
          fontWeight: 700, fontSize: '0.95rem',
          background: 'linear-gradient(135deg,#f1f0ff,#a78bfa)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>AI Interviewer</span>
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* History */}
        <button
          id="history-btn"
          onClick={() => setPage('reports')}
          style={{
            background: page === 'reports' ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${page === 'reports' ? 'rgba(167,139,250,0.4)' : 'var(--border)'}`,
            borderRadius: 8, padding: '6px 14px',
            color: page === 'reports' ? '#a78bfa' : 'var(--text-secondary)',
            fontSize: '0.84rem', fontWeight: 500, cursor: 'pointer',
            transition: 'var(--transition)',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'}
          onMouseLeave={e => { if (page !== 'reports') e.currentTarget.style.borderColor = 'var(--border)' }}
        >📋 History</button>

        {/* Avatar */}
        {user.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt="avatar"
            style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(167,139,250,0.4)' }}
          />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.85rem', fontWeight: 700, color: '#fff',
          }}>
            {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
          </div>
        )}

        {/* Sign out */}
        <button
          id="signout-btn"
          onClick={signOut}
          style={{
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 12px',
            color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer',
            transition: 'var(--transition)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef444430' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >Sign Out</button>
      </div>
    </div>
  )

  // ── Pages ──────────────────────────────────────────────────
  return (
    <>
      <Header />
      {page === 'setup' && <SetupPage onStart={handleInterviewStart} />}
      {page === 'interview' && <InterviewPage initialData={sessionData} onEnd={handleInterviewEnd} />}
      {page === 'feedback' && <FeedbackPage feedback={feedbackData} onRestart={handleRestart} onViewHistory={() => setPage('reports')} />}
      {page === 'reports' && <ReportsPage onBack={() => setPage('setup')} />}
    </>
  )
}
