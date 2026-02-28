import React from 'react'

export default function MessageBubble({ role, text, index, streaming }) {
    const isAI = role === 'ai'

    return (
        <div
            className="animate-fade-up"
            style={{
                display: 'flex',
                gap: 10,
                justifyContent: isAI ? 'flex-start' : 'flex-end',
                animationDelay: `${Math.min(index, 6) * 0.05}s`,
            }}
        >
            {isAI && (
                <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #7c3aed33, #a78bfa22)',
                    border: '1px solid rgba(167,139,250,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15,
                }}>🤖</div>
            )}

            <div style={{
                maxWidth: '82%',
                background: isAI
                    ? 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(167,139,250,0.07))'
                    : 'rgba(255,255,255,0.06)',
                border: isAI
                    ? '1px solid rgba(167,139,250,0.22)'
                    : '1px solid rgba(255,255,255,0.09)',
                borderRadius: isAI ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                padding: '12px 16px',
                fontSize: '0.915rem',
                lineHeight: 1.65,
                color: isAI ? 'var(--text-primary)' : 'rgba(241,240,255,0.9)',
                minHeight: 20,
            }}>
                {text || (streaming && <span style={{ color: 'var(--text-muted)' }}>…</span>)}
                {streaming && text && (
                    <span style={{
                        display: 'inline-block',
                        width: 2, height: '1em',
                        background: 'var(--accent-secondary)',
                        marginLeft: 3,
                        verticalAlign: 'text-bottom',
                        animation: 'blink-cursor 0.8s step-end infinite',
                    }} />
                )}
            </div>

            {!isAI && (
                <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15,
                }}>👤</div>
            )}
        </div>
    )
}
