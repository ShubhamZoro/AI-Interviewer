import React, { useEffect, useRef, useState, useCallback } from 'react'

const CHECK_INTERVAL_MS = 1500

export default function CameraMonitor({ onWarning }) {
    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const detectorRef = useRef(null)
    const timerRef = useRef(null)
    const mountedRef = useRef(true)

    const [phase, setPhase] = useState('loading') // loading | ready | error
    const [gazeOk, setGazeOk] = useState(true)
    const [warningMsg, setWarningMsg] = useState('')
    const [loadMsg, setLoadMsg] = useState('Starting camera…')

    // ── Gaze check ────────────────────────────────────────────────
    const checkGaze = useCallback(async () => {
        if (!mountedRef.current || !videoRef.current || !detectorRef.current) return
        try {
            const faces = await detectorRef.current.estimateFaces(videoRef.current)

            if (!mountedRef.current) return

            if (faces.length === 0) {
                setGazeOk(false)
                setWarningMsg('No face detected!')
                onWarning?.('no_face')
            } else {
                const kp = faces[0].keypoints || []
                const lEye = kp.find(k => k.name === 'leftEye')
                const rEye = kp.find(k => k.name === 'rightEye')
                const nose = kp.find(k => k.name === 'noseTip')

                if (lEye && rEye && nose) {
                    const midX = (lEye.x + rEye.x) / 2
                    const eyeDist = Math.abs(rEye.x - lEye.x)
                    const ratio = Math.abs(nose.x - midX) / Math.max(eyeDist, 1)

                    if (eyeDist < 18 || ratio > 0.42) {
                        // Profile view — too turned away
                        setGazeOk(false)
                        setWarningMsg('Please face the camera!')
                        onWarning?.('away')
                    } else {
                        setGazeOk(true)
                        setWarningMsg('')
                    }
                } else {
                    setGazeOk(true)  // face found, landmarks unclear — give benefit of doubt
                    setWarningMsg('')
                }
            }
        } catch (_) { }

        if (mountedRef.current) {
            timerRef.current = setTimeout(checkGaze, CHECK_INTERVAL_MS)
        }
    }, [onWarning])

    // ── Init camera + model ────────────────────────────────────────
    useEffect(() => {
        mountedRef.current = true

        const init = async () => {
            try {
                setLoadMsg('Starting camera…')
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 240, facingMode: 'user' },
                })
                if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
                streamRef.current = stream
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    await videoRef.current.play()
                }

                setLoadMsg('Loading face detector…')
                const [faceDetection] = await Promise.all([
                    import('@tensorflow-models/face-detection'),
                    import('@tensorflow/tfjs-backend-webgl'),
                ])
                if (!mountedRef.current) return

                const detector = await faceDetection.createDetector(
                    faceDetection.SupportedModels.MediaPipeFaceDetector,
                    {
                        runtime: 'mediapipe',
                        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4',
                        maxFaces: 1,
                    }
                )
                if (!mountedRef.current) return
                detectorRef.current = detector
                setPhase('ready')
                timerRef.current = setTimeout(checkGaze, 800)
            } catch (err) {
                if (mountedRef.current) setPhase('error')
            }
        }

        init()

        return () => {
            mountedRef.current = false
            clearTimeout(timerRef.current)
            streamRef.current?.getTracks().forEach(t => t.stop())
        }
    }, [checkGaze])

    // ── Render ─────────────────────────────────────────────────────
    const borderColor = phase !== 'ready'
        ? 'rgba(255,255,255,0.1)'
        : gazeOk ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.9)'

    return (
        <div style={{
            position: 'relative',
            width: 148, height: 110,
            borderRadius: 10,
            overflow: 'hidden',
            border: `2px solid ${borderColor}`,
            background: '#050508',
            flexShrink: 0,
            transition: 'border-color 0.4s',
            boxShadow: phase === 'ready' && !gazeOk
                ? '0 0 12px rgba(239,68,68,0.4)'
                : phase === 'ready' && gazeOk
                    ? '0 0 8px rgba(16,185,129,0.2)'
                    : 'none',
        }}>
            {/* Mirrored video */}
            <video
                ref={videoRef}
                muted
                playsInline
                style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',  // mirror
                    display: phase === 'error' ? 'none' : 'block',
                }}
            />

            {/* Loading overlay */}
            {phase === 'loading' && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(5,5,8,0.92)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 7,
                }}>
                    <div className="spinner" style={{ width: 16, height: 16, borderTopColor: 'var(--accent-secondary)' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem', margin: 0, textAlign: 'center', padding: '0 8px', lineHeight: 1.4 }}>
                        {loadMsg}
                    </p>
                </div>
            )}

            {/* Error overlay */}
            {phase === 'error' && (
                <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(5,5,8,0.92)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem', margin: 0, textAlign: 'center', padding: '0 10px' }}>
                        📷 Camera unavailable
                    </p>
                </div>
            )}

            {/* Gaze warning */}
            {phase === 'ready' && !gazeOk && (
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'rgba(239,68,68,0.85)',
                    padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                    <span style={{ fontSize: 9 }}>👁️</span>
                    <p style={{ color: '#fff', fontSize: '0.6rem', margin: 0, fontWeight: 600 }}>
                        {warningMsg}
                    </p>
                </div>
            )}

            {/* OK indicator */}
            {phase === 'ready' && gazeOk && (
                <div style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 6px rgba(16,185,129,0.8)',
                }} />
            )}

            {/* Label */}
            <div style={{
                position: 'absolute', top: 6, left: 6,
                fontSize: '0.58rem', color: 'rgba(255,255,255,0.5)',
                fontWeight: 600, letterSpacing: '0.03em',
            }}>📷 CAM</div>
        </div>
    )
}
