import React from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
    const { signIn } = useAuth()

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            padding: '24px',
        }}>
            <div className="glass-card animate-fade-up" style={{
                width: '100%',
                maxWidth: 420,
                padding: '48px 40px',
                textAlign: 'center',
                border: '1px solid rgba(167,139,250,0.2)',
                background: 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(167,139,250,0.05))',
            }}>
                {/* Logo / Icon */}
                <div style={{
                    width: 72, height: 72,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2rem',
                    margin: '0 auto 24px',
                    boxShadow: '0 0 32px rgba(124,58,237,0.4)',
                }}>🎙️</div>

                <h1 style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    background: 'linear-gradient(135deg,#f1f0ff,#a78bfa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: 8,
                }}>AI Interviewer</h1>

                <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.93rem',
                    lineHeight: 1.6,
                    marginBottom: 36,
                }}>
                    Practice real interviews with AI feedback.<br />
                    Sign in to get started and save your reports.
                </p>

                {/* Feature pills */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
                    {['🧠 AI Questions', '🎤 Voice Answers', '📊 Instant Reports'].map(f => (
                        <span key={f} style={{
                            padding: '4px 12px',
                            borderRadius: 99,
                            border: '1px solid rgba(167,139,250,0.25)',
                            background: 'rgba(167,139,250,0.08)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                        }}>{f}</span>
                    ))}
                </div>

                {/* Google sign in button */}
                <button
                    id="google-signin-btn"
                    onClick={signIn}
                    style={{
                        width: '100%',
                        padding: '14px 20px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(255,255,255,0.06)',
                        color: '#f1f0ff',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        transition: 'all 0.2s ease',
                        backdropFilter: 'blur(8px)',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                        e.currentTarget.style.borderColor = 'rgba(167,139,250,0.5)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                        e.currentTarget.style.transform = 'translateY(0)'
                    }}
                >
                    {/* Google SVG logo */}
                    <svg width="20" height="20" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                        <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                    </svg>
                    Continue with Google
                </button>

                <p style={{ marginTop: 20, color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.5 }}>
                    By signing in you agree to our terms of service.<br />
                    Your interview reports are private and only visible to you.
                </p>
            </div>
        </div>
    )
}
