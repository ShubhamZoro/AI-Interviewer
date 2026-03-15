import React, { useState, useEffect, useRef, useCallback } from 'react'
import WaveformVisualizer from '../components/WaveformVisualizer'
import MessageBubble from '../components/MessageBubble'
import CameraMonitor from '../components/CameraMonitor'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function InterviewPage({ initialData, onEnd }) {
    const { session_id, question, question_index, role, experience, interview_type, num_questions = 5, timed_mode = false, time_limit_seconds = 0 } = initialData
    const MAX_QUESTIONS = num_questions

    const [status, setStatus] = useState('ai_speaking')
    const [messages, setMessages] = useState([{ role: 'ai', text: question }])
    const [questionCount, setQuestionCount] = useState(1)
    const [timeLimit, setTimeLimit] = useState(timed_mode ? time_limit_seconds : 0)  // AI-set limit for current question
    const [timeLeft, setTimeLeft] = useState(timed_mode ? time_limit_seconds : 0)
    const [error, setError] = useState('')
    const [endingInterview, setEndingInterview] = useState(false)
    const [analyser, setAnalyser] = useState(null)
    const [gazeWarnings, setGazeWarnings] = useState(0)   // flagged look-away count

    // Audio queue (ordered playback of base64-decoded blobs)
    const audioQueueRef = useRef([])    // {order, url}[]
    const nextPlayOrderRef = useRef(0)
    const isPlayingRef = useRef(false)
    const streamingDoneRef = useRef(false)
    const pendingTextRef = useRef('')       // buffer text until audio starts
    const audioStartedRef = useRef(false)  // true once first chunk plays

    // Mic
    const mediaRecorderRef = useRef(null)
    const audioChunksRef = useRef([])
    const streamRef = useRef(null)
    const micCtxRef = useRef(null)
    const chatEndRef = useRef(null)
    const timerIntervalRef = useRef(null)  // countdown interval
    const stopRecordingRef = useRef(null)  // populated once stopRecording is defined

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // ── Per-question timer ──────────────────────────────────────────
    useEffect(() => {
        if (!timeLimit) return  // timer disabled
        clearInterval(timerIntervalRef.current)

        if (status === 'idle' || status === 'recording') {
            // Run continuously during both idle and recording
            timerIntervalRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerIntervalRef.current)
                        if (stopRecordingRef.current) stopRecordingRef.current()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        } else {
            // AI speaking / processing — reset for the next question
            setTimeLeft(timeLimit)
        }
        return () => clearInterval(timerIntervalRef.current)
    }, [status, timeLimit])

    // Play first question (cached on server)
    useEffect(() => {
        playFirstQuestion()
    }, [])

    // ── Simple audio queue (no AudioContext, just new Audio()) ──────

    const playNextInQueue = useCallback(() => {
        if (isPlayingRef.current) return
        const idx = audioQueueRef.current.findIndex(
            item => item.order === nextPlayOrderRef.current
        )
        if (idx === -1) return  // next order not arrived yet

        const item = audioQueueRef.current.splice(idx, 1)[0]
        nextPlayOrderRef.current += 1
        isPlayingRef.current = true
        setStatus('ai_speaking')

        const audio = new Audio(item.url)
        audio.oncanplaythrough = () => {
            // Reveal buffered text exactly when browser is ready to play audio
            if (!audioStartedRef.current) {
                audioStartedRef.current = true
                setMessages(prev => prev.map(m =>
                    m.streaming ? { ...m, text: pendingTextRef.current } : m
                ))
            }
            audio.play().catch(() => { })
        }
        audio.onended = () => {
            URL.revokeObjectURL(item.url)
            isPlayingRef.current = false
            if (audioQueueRef.current.length > 0) {
                playNextInQueue()
            } else if (streamingDoneRef.current) {
                // Clear the streaming flag so this bubble isn't treated as
                // "active" if another question starts streaming later
                setMessages(prev => prev.map(m =>
                    m.streaming ? { ...m, streaming: false } : m
                ))
                setStatus('idle')
            }
        }
        audio.onerror = () => {
            isPlayingRef.current = false
            if (streamingDoneRef.current && audioQueueRef.current.length === 0) {
                setMessages(prev => prev.map(m =>
                    m.streaming ? { ...m, streaming: false } : m
                ))
                setStatus('idle')
            } else {
                playNextInQueue()
            }
        }
    }, [])

    const enqueueAudio = useCallback((url, order) => {
        audioQueueRef.current.push({ url, order })
        playNextInQueue()
    }, [playNextInQueue])

    // Decode base64 MP3 → Blob URL → enqueue
    const enqueueBase64Audio = useCallback((b64, order) => {
        try {
            const binary = atob(b64)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
            const blob = new Blob([bytes], { type: 'audio/mpeg' })
            enqueueAudio(URL.createObjectURL(blob), order)
        } catch (_) { }
    }, [enqueueAudio])

    // Play first TTS from server cache
    const playFirstQuestion = async () => {
        setStatus('ai_speaking')
        streamingDoneRef.current = false
        try {
            const res = await fetch(`${API_URL}/api/tts/${session_id}/${question_index}`)
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const audio = new Audio(url)
            audio.oncanplaythrough = () => audio.play().catch(() => { })
            audio.onended = () => { URL.revokeObjectURL(url); setStatus('idle') }
            audio.onerror = () => { URL.revokeObjectURL(url); setStatus('idle') }
        } catch (_) {
            setStatus('idle')
        }
    }

    // ── Mic recording ───────────────────────────────────────────────

    const startRecording = useCallback(async () => {
        setError('')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream

            // Mic waveform via analyser
            const ctx = new (window.AudioContext || window.webkitAudioContext)()
            micCtxRef.current = ctx
            const an = ctx.createAnalyser()
            an.fftSize = 128
            ctx.createMediaStreamSource(stream).connect(an)
            setAnalyser(an)

            const mr = new MediaRecorder(stream, { mimeType: getSupportedMime() })
            mediaRecorderRef.current = mr
            audioChunksRef.current = []
            mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
            mr.start(200)
            setStatus('recording')
        } catch (_) {
            setError('Microphone access denied. Please allow microphone in browser settings.')
        }
    }, [])

    const stopRecording = useCallback(async () => {
        setStatus('processing')
        setAnalyser(null)
        micCtxRef.current?.close().catch(() => { })
        micCtxRef.current = null

        const mr = mediaRecorderRef.current
        if (!mr || mr.state === 'inactive') return
        mr.stop()
        streamRef.current?.getTracks().forEach(t => t.stop())

        mr.onstop = async () => {
            try {
                const blob = new Blob(audioChunksRef.current, { type: getSupportedMime() })
                const fd = new FormData()
                fd.append('audio', blob, 'rec.webm')
                const res = await fetch(`${API_URL}/api/transcribe`, { method: 'POST', body: fd })
                if (!res.ok) throw new Error('Transcription failed')
                const { transcript } = await res.json()
                setMessages(prev => [...prev, { role: 'user', text: transcript }])
                await streamResponse(transcript)
            } catch (err) {
                setError(err.message)
                setStatus('idle')
            }
        }
    }, [])

    // Keep ref in sync so the timer closure can call it
    useEffect(() => { stopRecordingRef.current = stopRecording }, [stopRecording])

    // ── SSE streaming + inline base64 audio handling ────────────────

    const streamResponse = useCallback(async (transcript) => {
        audioQueueRef.current = []
        nextPlayOrderRef.current = 0
        isPlayingRef.current = false
        streamingDoneRef.current = false
        pendingTextRef.current = ''
        audioStartedRef.current = false
        setStatus('processing')

        // Add empty streaming bubble
        setMessages(prev => [...prev, { role: 'ai', text: '', streaming: true }])

        try {
            const res = await fetch(`${API_URL}/api/respond-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id, transcript }),
            })
            if (!res.ok) throw new Error('Stream request failed')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let lineBuffer = ''
            let fullText = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                lineBuffer += decoder.decode(value, { stream: true })
                const lines = lineBuffer.split('\n')
                lineBuffer = lines.pop()

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    const raw = line.slice(6).trim()
                    if (!raw) continue
                    let payload
                    try { payload = JSON.parse(raw) } catch { continue }

                    switch (payload.type) {
                        case 'text':
                            fullText += payload.content
                            // Buffer text — only show it once audio starts playing
                            pendingTextRef.current = fullText
                            if (audioStartedRef.current) {
                                setMessages(prev => prev.map(m =>
                                    m.streaming ? { ...m, text: fullText } : m
                                ))
                            }
                            break

                        case 'audio':
                            // Audio arrives inline — decode and enqueue immediately
                            enqueueBase64Audio(payload.audio_b64, payload.order)
                            break

                        case 'done':
                            setQuestionCount(payload.question_count)
                            if (timed_mode && payload.time_limit_seconds) {
                                setTimeLimit(payload.time_limit_seconds)
                            }
                            streamingDoneRef.current = true
                            // If no audio ever arrived, reveal text now
                            if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
                                setMessages(prev => prev.map(m =>
                                    m.streaming ? { role: 'ai', text: fullText } : m
                                ))
                                setStatus('idle')
                            } else {
                                // Audio will finalize the message bubble when it ends
                                setMessages(prev => prev.map(m =>
                                    m.streaming ? { ...m, text: fullText } : m
                                ))
                            }
                            break

                        case 'done_interview':
                            setMessages(prev => prev.filter(m => !m.streaming))
                            streamingDoneRef.current = true
                            await endInterviewFn()
                            return

                        case 'error':
                            throw new Error(payload.message)
                    }
                }
            }
        } catch (err) {
            setError(err.message)
            setStatus('idle')
        }
    }, [session_id, enqueueBase64Audio])

    // ── End interview ───────────────────────────────────────────────

    const endInterviewFn = useCallback(async () => {
        setEndingInterview(true)
        setStatus('processing')
        try {
            const res = await fetch(`${API_URL}/api/end-interview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id, gaze_warnings: gazeWarnings }),
            })
            if (!res.ok) throw new Error('Failed to generate feedback')
            onEnd(await res.json())
        } catch (err) {
            setError(err.message)
            setStatus('idle')
            setEndingInterview(false)
        }
    }, [session_id, onEnd, gazeWarnings])


    const progress = Math.round((questionCount / MAX_QUESTIONS) * 100)

    const statusLabel = endingInterview
        ? '📊 Generating feedback report…'
        : { ai_speaking: '🔊 AI is speaking…', idle: '🎙️ Your turn', recording: '🔴 Recording…', processing: '⚙️ Processing…' }[status] || ''

    const isAISpeaking = status === 'ai_speaking'

    // Stable reference so CameraMonitor never remounts on re-render
    const handleGazeWarning = useCallback(() => setGazeWarnings(n => n + 1), [])

    return (
        <div className="app-container" style={{ padding: '18px 14px', justifyContent: 'flex-start', alignItems: 'center' }}>

            {/* ── Fixed camera overlay (bottom-right, compact) ── */}
            <div style={{
                position: 'fixed', bottom: 16, right: 16, zIndex: 999,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
            }}>
                <div style={{
                    background: 'rgba(8,8,18,0.88)', backdropFilter: 'blur(12px)',
                    borderRadius: 10, padding: '4px 5px 6px',
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: '0 2px 16px rgba(0,0,0,0.6)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                    <span style={{ fontSize: '0.52rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>📷 CAM</span>
                    <CameraMonitor onWarning={handleGazeWarning} />
                    {gazeWarnings > 0 && (
                        <div style={{
                            background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.35)',
                            borderRadius: 5, padding: '2px 6px',
                            color: '#f97316', fontSize: '0.58rem', fontWeight: 700,
                        }}>👁️ {gazeWarnings}</div>
                    )}
                </div>
            </div>

            <div style={{ width: '100%', maxWidth: 720 }}>

                {/* ── Top bar: everything in one row ── */}
                <div className="glass-card animate-fade-in" style={{
                    padding: '10px 16px', marginBottom: 8,
                    display: 'flex', alignItems: 'center', gap: 10,
                    position: 'sticky', top: 0, zIndex: 100,
                }}>
                    {/* Role icon + name */}
                    <span style={{ fontSize: 18, flexShrink: 0 }}>🤖</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                            {experience} · {interview_type}
                            {gazeWarnings > 0 && (
                                <span style={{ marginLeft: 6, color: '#f97316', fontWeight: 600 }}>👁️ {gazeWarnings}</span>
                            )}
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

                    {/* Q badge + progress */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <div style={{
                            background: 'var(--accent-gradient)', borderRadius: 20,
                            padding: '2px 10px', fontSize: '0.72rem', fontWeight: 800,
                            color: '#fff',
                        }}>Q {questionCount}/{MAX_QUESTIONS}</div>
                        <div className="progress-bar-track" style={{ width: 56 }}>
                            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

                    {/* Status label */}
                    <div style={{
                        fontSize: '0.72rem', fontWeight: 600, flexShrink: 0,
                        transition: 'color 0.3s',
                        color: status === 'recording' ? '#f87171'
                            : isAISpeaking ? 'var(--accent-secondary)'
                                : 'var(--text-muted)',
                    }}>{statusLabel}</div>

                    {/* Timer (only when counting) */}
                    {timeLimit > 0 && (status === 'idle' || status === 'recording') && (() => {
                        const pct = (timeLeft / timeLimit) * 100
                        const col = pct > 50 ? '#10b981' : pct > 25 ? '#f59e0b' : '#ef4444'
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                <div style={{ width: 48, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 99, width: `${pct}%`,
                                        background: `linear-gradient(90deg, ${col}99, ${col})`,
                                        transition: 'width 0.9s linear, background 0.5s',
                                    }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: col, fontVariantNumeric: 'tabular-nums', minWidth: 26 }}>{timeLeft}s</span>
                            </div>
                        )
                    })()}

                    {/* End Now */}
                    <button className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.72rem', flexShrink: 0 }}
                        onClick={endInterviewFn}
                        disabled={endingInterview || status === 'recording' || questionCount < 2}>
                        {endingInterview
                            ? <><div className="spinner" style={{ width: 11, height: 11 }} /> Ending…</>
                            : 'End Now'}
                    </button>
                </div>

                {/* ── Row 3: Full-width chat ── */}
                <div className="glass-card" style={{
                    padding: '16px 20px',
                    minHeight: 420, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto',
                    display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                    {messages.map((m, i) => (
                        <MessageBubble key={i} role={m.streaming ? 'ai' : m.role}
                            text={m.text} index={i} streaming={m.streaming && !streamingDoneRef.current} />
                    ))}
                    {status === 'processing' && !endingInterview && !messages.some(m => m.streaming) && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                            <div className="spinner" style={{ width: 13, height: 13, borderTopColor: 'var(--accent-secondary)' }} />
                            Thinking…
                        </div>
                    )}
                    {endingInterview && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                            <div className="spinner" style={{ width: 13, height: 13, borderTopColor: 'var(--accent-secondary)' }} />
                            Generating feedback report…
                        </div>
                    )}
                    {error && (
                        <div style={{
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 10, padding: '9px 14px',
                            color: '#fca5a5', fontSize: '0.84rem', textAlign: 'center',
                        }}>⚠️ {error}</div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* ── Row 4: Compact bottom strip — waveform + mic ── */}
                <div className="glass-card" style={{
                    padding: '8px 18px', marginTop: 8,
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    {/* Waveform fills left */}
                    <div style={{ flex: 1 }}>
                        <WaveformVisualizer
                            analyser={analyser}
                            isActive={status === 'recording' || isAISpeaking}
                            color={status === 'recording' ? '#ef4444' : '#a78bfa'}
                        />
                    </div>

                    {/* Mic / state — small, right-aligned */}
                    <div style={{ flexShrink: 0 }}>
                        {status === 'idle' && (
                            <button id="start-recording-btn" onClick={startRecording} style={{
                                width: 38, height: 38, borderRadius: '50%', border: 'none',
                                background: 'var(--accent-gradient)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 16, boxShadow: 'var(--shadow-btn)',
                                transition: 'var(--transition)', position: 'relative',
                            }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                🎙️
                                <span style={{
                                    position: 'absolute', inset: -5, borderRadius: '50%',
                                    border: '2px solid rgba(124,58,237,0.35)',
                                    animation: 'glow-pulse 2s ease-in-out infinite', pointerEvents: 'none',
                                }} />
                            </button>
                        )}
                        {status === 'recording' && (
                            <button id="stop-recording-btn" onClick={stopRecording} style={{
                                width: 38, height: 38, borderRadius: '50%', border: 'none',
                                background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: 16,
                                boxShadow: '0 3px 14px rgba(239,68,68,0.5)',
                                animation: 'glow-pulse 1.2s ease-in-out infinite',
                            }}>⏹️</button>
                        )}
                        {(isAISpeaking || status === 'processing') && (
                            <div style={{
                                width: 38, height: 38, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 16, color: 'var(--text-muted)',
                            }}>
                                {isAISpeaking ? '🔊' : '⚙️'}
                            </div>
                        )}
                    </div>
                    {error && (
                        <div style={{
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 8, padding: '5px 10px',
                            color: '#fca5a5', fontSize: '0.72rem',
                        }}>⚠️ {error}</div>
                    )}
                </div>

            </div>
        </div>
    )
}

function getSupportedMime() {
    for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
        if (MediaRecorder.isTypeSupported(t)) return t
    }
    return ''
}
