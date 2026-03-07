import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function ReportsPage({ onBack }) {
    const { session } = useAuth()
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [openIdx, setOpenIdx] = useState(null)

    useEffect(() => {
        async function fetchReports() {
            const { data, error } = await supabase
                .from('interview_reports')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) { setError(error.message) }
            else { setReports(data || []) }
            setLoading(false)
        }
        fetchReports()
    }, [session])

    const gradeColor = g => ({ A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444' }[g] || '#9ca3af')
    const recColor = r => ({ 'Strong Yes': '#10b981', 'Yes': '#3b82f6', 'Maybe': '#f59e0b', 'No': '#ef4444' }[r] || '#9ca3af')

    const formatDate = iso => {
        const d = new Date(iso)
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="app-container" style={{ padding: '24px 16px', alignItems: 'flex-start' }}>
            <div style={{ width: '100%', maxWidth: 760 }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }} className="animate-fade-up">
                    <button
                        onClick={onBack}
                        id="reports-back-btn"
                        style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                            borderRadius: 10, padding: '8px 14px', color: 'var(--text-secondary)',
                            cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500,
                            transition: 'var(--transition)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    >← Back</button>

                    <div>
                        <h1 style={{
                            fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em',
                            background: 'linear-gradient(135deg,#f1f0ff,#a78bfa)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 2,
                        }}>📋 My Interview History</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                            {loading ? 'Loading…' : `${reports.length} session${reports.length !== 1 ? 's' : ''} recorded`}
                        </p>
                    </div>
                </div>

                {/* States */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                        <div className="spinner" style={{ margin: '0 auto 16px' }} />
                        Loading your reports…
                    </div>
                )}

                {!loading && error && (
                    <div className="glass-card" style={{ padding: 24, color: '#ef4444', textAlign: 'center' }}>
                        ❌ {error}
                    </div>
                )}

                {!loading && !error && reports.length === 0 && (
                    <div className="glass-card animate-fade-up" style={{ padding: 48, textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎙️</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                            No interviews yet. Complete your first session to see your report here!
                        </p>
                    </div>
                )}

                {/* Report cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {reports.map((r, i) => {
                        const gc = gradeColor(r.grade)
                        const rc = recColor(r.recommendation)
                        const open = openIdx === i
                        const strengths = Array.isArray(r.strengths) ? r.strengths : []
                        const improvements = Array.isArray(r.improvements) ? r.improvements : []
                        const qs = Array.isArray(r.question_scores) ? r.question_scores : []

                        return (
                            <div key={r.id} className="glass-card animate-fade-up" style={{
                                overflow: 'hidden', border: open ? '1px solid rgba(167,139,250,0.25)' : '1px solid var(--border)',
                                animationDelay: `${i * 0.04}s`,
                            }}>
                                {/* Card header */}
                                <button
                                    id={`report-toggle-${i}`}
                                    onClick={() => setOpenIdx(open ? null : i)}
                                    style={{
                                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                                        padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                                    }}
                                >
                                    {/* Grade badge */}
                                    <span style={{
                                        flexShrink: 0, width: 44, height: 44, borderRadius: '50%',
                                        background: `${gc}18`, border: `2px solid ${gc}55`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.1rem', fontWeight: 900, color: gc,
                                    }}>{r.grade}</span>

                                    {/* Main info */}
                                    <div style={{ flex: 1, textAlign: 'left', minWidth: 160 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 3 }}>
                                            {r.role}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                            {r.interview_type} · {r.experience} · {formatDate(r.created_at)}
                                        </div>
                                    </div>

                                    {/* Score */}
                                    <div style={{
                                        textAlign: 'right', flexShrink: 0,
                                        background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(167,139,250,0.06))',
                                        border: '1px solid rgba(167,139,250,0.15)', borderRadius: 10, padding: '6px 14px',
                                    }}>
                                        <div style={{
                                            fontSize: '1.4rem', fontWeight: 800,
                                            background: 'linear-gradient(135deg,#f1f0ff,#a78bfa)',
                                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                        }}>{r.overall_score}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>/ 100</div>
                                    </div>

                                    {/* Recommendation pill */}
                                    <span style={{
                                        flexShrink: 0, padding: '4px 12px', borderRadius: 99,
                                        background: `${rc}18`, border: `1px solid ${rc}44`,
                                        color: rc, fontSize: '0.76rem', fontWeight: 700,
                                    }}>{r.recommendation}</span>

                                    <span style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
                                </button>

                                {/* Expanded detail */}
                                {open && (
                                    <div className="animate-fade-in" style={{ padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                                        {/* Summary */}
                                        {r.summary && (
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.65, margin: 0 }}>
                                                {r.summary}
                                            </p>
                                        )}

                                        {/* Strengths & Improvements */}
                                        {(strengths.length > 0 || improvements.length > 0) && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                {strengths.length > 0 && (
                                                    <div style={{
                                                        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                                                        borderRadius: 10, padding: '14px 16px',
                                                    }}>
                                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981', marginBottom: 10 }}>
                                                            ✅ Strengths
                                                        </div>
                                                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                                                            {strengths.map((s, j) => (
                                                                <li key={j} style={{ display: 'flex', gap: 8, fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                                    <span style={{ color: '#10b981', flexShrink: 0 }}>▸</span>{s}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {improvements.length > 0 && (
                                                    <div style={{
                                                        background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                                                        borderRadius: 10, padding: '14px 16px',
                                                    }}>
                                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f59e0b', marginBottom: 10 }}>
                                                            💡 Improve
                                                        </div>
                                                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                                                            {improvements.map((m, j) => (
                                                                <li key={j} style={{ display: 'flex', gap: 8, fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                                    <span style={{ color: '#f59e0b', flexShrink: 0 }}>▸</span>{m}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Q&A accordion */}
                                        {qs.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>
                                                    📊 Question Breakdown
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    {qs.map((q, j) => {
                                                        const pct = (q.score / 10) * 100
                                                        const col = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
                                                        return (
                                                            <div key={j} style={{
                                                                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                                                                borderRadius: 10, padding: '12px 14px',
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                                                    <span style={{
                                                                        flexShrink: 0, fontSize: '0.78rem', fontWeight: 800,
                                                                        color: col, background: `${col}18`, border: `1px solid ${col}44`,
                                                                        padding: '2px 9px', borderRadius: 99,
                                                                    }}>{q.score}/10</span>
                                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>
                                                                        Q{j + 1}: {q.question}
                                                                    </span>
                                                                </div>
                                                                <div className="progress-bar-track" style={{ marginBottom: 10 }}>
                                                                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg,${col}88,${col})` }} />
                                                                </div>
                                                                {q.feedback && (
                                                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                                                        💬 {q.feedback}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Recommendation reason */}
                                        {r.recommendation_reason && (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic', margin: 0 }}>
                                                "{r.recommendation_reason}"
                                            </p>
                                        )}

                                        {/* Gaze warnings */}
                                        {r.gaze_warnings > 0 && (
                                            <p style={{ color: '#f59e0b', fontSize: '0.8rem', margin: 0 }}>
                                                👁 {r.gaze_warnings} gaze warning{r.gaze_warnings > 1 ? 's' : ''} recorded during this session.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
