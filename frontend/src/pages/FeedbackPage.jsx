import React, { useState } from 'react'

export default function FeedbackPage({ feedback, onRestart }) {
    const {
        overall_score = 0, grade = 'N/A', summary = '',
        strengths = [], improvements = [],
        question_scores = [],
        recommendation = '', recommendation_reason = '',
    } = feedback || {}

    const [openIdx, setOpenIdx] = useState(null)

    const gradeColor = { A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444' }[grade] || '#9ca3af'
    const recColor = { 'Strong Yes': '#10b981', 'Yes': '#3b82f6', 'Maybe': '#f59e0b', 'No': '#ef4444' }[recommendation] || '#9ca3af'

    return (
        <div className="app-container" style={{ padding: '24px 16px' }}>
            <div style={{ width: '100%', maxWidth: 700 }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 28 }} className="animate-fade-up">
                    <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>🎉</div>
                    <h1 style={{
                        fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.03em',
                        background: 'linear-gradient(135deg, #f1f0ff, #a78bfa)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 6,
                    }}>Interview Complete!</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.93rem' }}>
                        Here's your full performance report
                    </p>
                </div>

                {/* Score card */}
                <div className="glass-card animate-fade-up" style={{
                    padding: '28px 32px', marginBottom: 16, textAlign: 'center',
                    background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(167,139,250,0.06))',
                    border: '1px solid rgba(167,139,250,0.2)', animationDelay: '0.05s',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
                        <div>
                            <div style={{
                                fontSize: '4rem', fontWeight: 800, lineHeight: 1,
                                background: 'linear-gradient(135deg,#f1f0ff,#a78bfa)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>{overall_score}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 3 }}>out of 100</div>
                        </div>
                        <div style={{ width: 1, height: 56, background: 'var(--border)' }} />
                        <div>
                            <div style={{ fontSize: '3.2rem', fontWeight: 900, color: gradeColor, textShadow: `0 0 18px ${gradeColor}55` }}>{grade}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 3 }}>Grade</div>
                        </div>
                        <div style={{ width: 1, height: 56, background: 'var(--border)' }} />
                        <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: recColor, marginBottom: 4 }}>{recommendation}</div>
                            <div style={{ padding: '3px 12px', borderRadius: 99, background: `${recColor}22`, color: recColor, fontSize: '0.73rem', fontWeight: 600 }}>
                                Hiring Recommendation
                            </div>
                        </div>
                    </div>
                    {summary && <p style={{ marginTop: 20, color: 'var(--text-secondary)', fontSize: '0.93rem', lineHeight: 1.65, maxWidth: 500, margin: '20px auto 0' }}>{summary}</p>}
                    {recommendation_reason && <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.83rem', fontStyle: 'italic' }}>"{recommendation_reason}"</p>}
                </div>

                {/* Strengths & Improvements */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                    <div className="glass-card animate-fade-up" style={{ padding: '20px', animationDelay: '0.1s' }}>
                        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981', marginBottom: 12 }}>✅ Strengths</h3>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                            {strengths.map((s, i) => (
                                <li key={i} style={{ display: 'flex', gap: 9, fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    <span style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }}>▸</span>{s}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="glass-card animate-fade-up" style={{ padding: '20px', animationDelay: '0.12s' }}>
                        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f59e0b', marginBottom: 12 }}>💡 Improve</h3>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                            {improvements.map((imp, i) => (
                                <li key={i} style={{ display: 'flex', gap: 9, fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    <span style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }}>▸</span>{imp}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Per-question breakdown (accordion) */}
                {question_scores.length > 0 && (
                    <div className="glass-card animate-fade-up" style={{ padding: '20px 22px', marginBottom: 22, animationDelay: '0.15s' }}>
                        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 16 }}>
                            📊 Question Breakdown
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {question_scores.map((qs, i) => {
                                const pct = (qs.score / 10) * 100
                                const col = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
                                const open = openIdx === i

                                return (
                                    <div key={i} style={{
                                        background: open ? 'rgba(124,58,237,0.07)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${open ? 'rgba(167,139,250,0.2)' : 'var(--border)'}`,
                                        borderRadius: 12, overflow: 'hidden', transition: 'var(--transition)',
                                    }}>
                                        {/* Row header — always visible */}
                                        <button
                                            onClick={() => setOpenIdx(open ? null : i)}
                                            style={{
                                                width: '100%', background: 'none', border: 'none',
                                                padding: '13px 16px', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: 12,
                                            }}
                                        >
                                            {/* Score badge */}
                                            <span style={{
                                                flexShrink: 0, fontSize: '0.8rem', fontWeight: 800,
                                                color: col, background: `${col}18`,
                                                border: `1px solid ${col}44`,
                                                padding: '2px 9px', borderRadius: 99,
                                            }}>{qs.score}/10</span>

                                            {/* Question text */}
                                            <span style={{
                                                flex: 1, textAlign: 'left', fontSize: '0.88rem',
                                                color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4,
                                                overflow: 'hidden', textOverflow: 'ellipsis',
                                                display: '-webkit-box', WebkitLineClamp: open ? 'unset' : 2,
                                                WebkitBoxOrient: 'vertical',
                                            }}>Q{i + 1}: {qs.question}</span>

                                            <span style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>
                                                {open ? '▲' : '▼'}
                                            </span>
                                        </button>

                                        {/* Score bar */}
                                        <div style={{ padding: '0 16px 4px' }}>
                                            <div className="progress-bar-track">
                                                <div className="progress-bar-fill" style={{
                                                    width: `${pct}%`,
                                                    background: `linear-gradient(90deg,${col}88,${col})`,
                                                }} />
                                            </div>
                                        </div>

                                        {/* Expanded detail */}
                                        {open && (
                                            <div className="animate-fade-in" style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                                                {/* Your answer */}
                                                <div style={{
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.07)',
                                                    borderRadius: 10, padding: '12px 14px',
                                                }}>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
                                                        👤 Your Answer
                                                    </div>
                                                    <p style={{ fontSize: '0.875rem', color: 'rgba(241,240,255,0.8)', lineHeight: 1.65, margin: 0 }}>
                                                        {qs.answer || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No answer recorded</span>}
                                                    </p>
                                                </div>

                                                {/* AI Feedback */}
                                                {qs.feedback && (
                                                    <div style={{
                                                        background: `${col}0e`,
                                                        border: `1px solid ${col}28`,
                                                        borderRadius: 10, padding: '12px 14px',
                                                    }}>
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: col, marginBottom: 6 }}>
                                                            💬 Feedback
                                                        </div>
                                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                                                            {qs.feedback}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Ideal Answer */}
                                                {qs.ideal_answer && (
                                                    <div style={{
                                                        background: 'rgba(167,139,250,0.08)',
                                                        border: '1px solid rgba(167,139,250,0.2)',
                                                        borderRadius: 10, padding: '12px 14px',
                                                    }}>
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-secondary)', marginBottom: 6 }}>
                                                            ⭐ What a Strong Answer Includes
                                                        </div>
                                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                                                            {qs.ideal_answer}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* CTA */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }} className="animate-fade-up">
                    <button className="btn btn-primary btn-lg" onClick={onRestart} id="restart-btn">
                        🔄 Practice Again
                    </button>
                </div>
                <p style={{ textAlign: 'center', marginTop: 14, color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                    Every session makes you sharper 🚀
                </p>
            </div>
        </div>
    )
}
