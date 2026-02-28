import React, { useState, useEffect, useRef, useCallback } from 'react'
import WaveformVisualizer from '../components/WaveformVisualizer'
import MessageBubble from '../components/MessageBubble'
import CameraMonitor from '../components/CameraMonitor'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function InterviewPage({ initialData, onEnd }) {
    const { session_id, question, question_index, role, experience, interview_type, num_questions = 5 } = initialData
    const MAX_QUESTIONS = num_questions

    const [status, setStatus] = useState('ai_speaking')
    const [messages, setMessages] = useState([{ role: 'ai', text: question }])
    const [questionCount, setQuestionCount] = useState(1)
    const [error, setError] = useState('')
    const [endingInterview, setEndingInterview] = useState(false)
    const [analyser, setAnalyser] = useState(null)
    const [gazeWarnings, setGazeWarnings] = useState(0)   // flagged look-away count

    // Audio queue (ordered playback of base64-decoded blobs)
    const audioQueueRef = useRef([])    // {order, url}[]
    const nextPlayOrderRef = useRef(0)
    const isPlayingRef = useRef(false)
    const streamingDoneRef = useRef(false)

    // Mic
    const mediaRecorderRef = useRef(null)
    const audioChunksRef = useRef([])
    const streamRef = useRef(null)
    const micCtxRef = useRef(null)
    const chatEndRef = useRef(null)

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

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
        audio.oncanplaythrough = () => audio.play().catch(() => { })
        audio.onended = () => {
            URL.revokeObjectURL(item.url)
            isPlayingRef.current = false
            if (audioQueueRef.current.length > 0) {
                playNextInQueue()
            } else if (streamingDoneRef.current) {
                setStatus('idle')
            }
        }
        audio.onerror = () => {
            isPlayingRef.current = false
            if (streamingDoneRef.current && audioQueueRef.current.length === 0) {
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

    // ── SSE streaming + inline base64 audio handling ────────────────

    const streamResponse = useCallback(async (transcript) => {
        audioQueueRef.current = []
        nextPlayOrderRef.current = 0
        isPlayingRef.current = false
        streamingDoneRef.current = false
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
                            setMessages(prev => prev.map(m =>
                                m.streaming ? { ...m, text: fullText } : m
                            ))
                            break

                        case 'audio':
                            // Audio arrives inline — decode and enqueue immediately
                            enqueueBase64Audio(payload.audio_b64, payload.order)
                            break

                        case 'done':
                            setQuestionCount(payload.question_count)
                            setMessages(prev => prev.map(m =>
                                m.streaming ? { role: 'ai', text: fullText } : m
                            ))
                            streamingDoneRef.current = true
                            // If no audio playing / queued, go idle
                            if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
                                setStatus('idle')
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

    // ── UI ──────────────────────────────────────────────────────────

    const progress = Math.round((questionCount / MAX_QUESTIONS) * 100)

    const statusLabel = endingInterview
        ? '📊 Generating feedback report…'
        : { ai_speaking: '🔊 AI is speaking…', idle: '🎙️ Your turn', recording: '🔴 Recording…', processing: '⚙️ Processing…' }[status] || ''

    const isAISpeaking = status === 'ai_speaking'

    return (
        <div className="app-container" style={{ padding: '18px 14px' }}>
            <div style={{ width: '100%', maxWidth: 700 }}>

                {/* Top bar */}
                <div className="glass-card animate-fade-in" style={{
                    padding: '13px 20px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                }}>
                    {/* Left: role info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 20 }}>🤖</span>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.71rem' }}>
                                {experience} · {interview_type}
                                {gazeWarnings > 0 && (
                                    <span style={{ marginLeft: 8, color: '#f97316', fontWeight: 600 }}>👁️ {gazeWarnings} look-away{gazeWarnings > 1 ? 's' : ''}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Center: camera */}
                    <CameraMonitor onWarning={() => setGazeWarnings(n => n + 1)} />

                    {/* Right: progress + end btn */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginBottom: 4 }}>
                                Q {questionCount} / {MAX_QUESTIONS}
                            </div>
                            <div className="progress-bar-track" style={{ width: 80 }}>
                                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                        <button className="btn btn-secondary"
                            style={{ padding: '7px 11px', fontSize: '0.75rem' }}
                            onClick={endInterviewFn}
                            disabled={endingInterview || status === 'recording' || questionCount < 2}>
                            {endingInterview
                                ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Ending…</>
                                : 'End Now'}
                        </button>
                    </div>
                </div>

                {/* Chat */}
                <div className="glass-card" style={{
                    padding: '16px 20px', marginBottom: 12,
                    minHeight: 310, maxHeight: 400, overflowY: 'auto',
                    display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                    {messages.map((m, i) => (
                        <MessageBubble key={i} role={m.streaming ? 'ai' : m.role}
                            text={m.text} index={i} streaming={m.streaming && !streamingDoneRef.current} />
                    ))}
                    {status === 'processing' && !endingInterview && !messages.some(m => m.streaming) && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            <div className="spinner" style={{ width: 13, height: 13, borderTopColor: 'var(--accent-secondary)' }} />
                            Thinking…
                        </div>
                    )}
                    {endingInterview && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            <div className="spinner" style={{ width: 13, height: 13, borderTopColor: 'var(--accent-secondary)' }} />
                            Generating feedback report…
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Waveform + controls */}
                <div className="glass-card" style={{ padding: '16px 20px' }}>
                    <div style={{
                        textAlign: 'center', marginBottom: 10,
                        fontSize: '0.86rem', fontWeight: 500, transition: 'color 0.3s',
                        color: status === 'recording' ? '#f87171'
                            : isAISpeaking ? 'var(--accent-secondary)'
                                : 'var(--text-secondary)',
                    }}>{statusLabel}</div>

                    <div style={{ marginBottom: 16 }}>
                        <WaveformVisualizer
                            analyser={analyser}
                            isActive={status === 'recording' || isAISpeaking}
                            color={status === 'recording' ? '#ef4444' : '#a78bfa'}
                        />
                    </div>

                    {/* Mic button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {status === 'idle' && (
                            <button id="start-recording-btn" onClick={startRecording} style={{
                                width: 66, height: 66, borderRadius: '50%', border: 'none',
                                background: 'var(--accent-gradient)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 26, boxShadow: 'var(--shadow-btn)',
                                transition: 'var(--transition)', position: 'relative',
                            }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                🎙️
                                <span style={{
                                    position: 'absolute', inset: -8, borderRadius: '50%',
                                    border: '2px solid rgba(124,58,237,0.4)',
                                    animation: 'glow-pulse 2s ease-in-out infinite', pointerEvents: 'none',
                                }} />
                            </button>
                        )}
                        {status === 'recording' && (
                            <button id="stop-recording-btn" onClick={stopRecording} style={{
                                width: 66, height: 66, borderRadius: '50%', border: 'none',
                                background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: 24,
                                boxShadow: '0 4px 20px rgba(239,68,68,0.45)',
                                animation: 'glow-pulse 1.2s ease-in-out infinite',
                            }}>⏹️</button>
                        )}
                        {(isAISpeaking || status === 'processing') && (
                            <div style={{
                                width: 66, height: 66, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 24, color: 'var(--text-muted)',
                            }}>
                                {isAISpeaking ? '🔊' : '⚙️'}
                            </div>
                        )}
                    </div>

                    {status === 'idle' && (
                        <p style={{ textAlign: 'center', marginTop: 10, color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                            Press 🎙️ to record your answer
                        </p>
                    )}
                    {status === 'recording' && (
                        <p style={{ textAlign: 'center', marginTop: 10, color: '#fca5a5', fontSize: '0.74rem' }}>
                            Press ⏹️ when done speaking
                        </p>
                    )}
                    {error && (
                        <div style={{
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 10, padding: '9px 14px', marginTop: 12,
                            color: '#fca5a5', fontSize: '0.84rem', textAlign: 'center',
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
