import React, { useEffect, useRef } from 'react'

export default function WaveformVisualizer({ analyser, isActive, color = '#a78bfa' }) {
    const canvasRef = useRef(null)
    const rafRef = useRef(null)

    useEffect(() => {
        cancelAnimationFrame(rafRef.current)

        if (!isActive) {
            drawFlat()
            return
        }
        if (analyser) {
            drawLive()
        } else {
            drawAnimated()
        }
        return () => cancelAnimationFrame(rafRef.current)
    }, [analyser, isActive, color])

    // ── flat idle bars ────────────────────────────────
    const drawFlat = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const { barCount, barW, gap } = layout(canvas.width)
        for (let i = 0; i < barCount; i++) {
            const x = i * (barW + gap)
            ctx.fillStyle = hexRgba(color, 0.18)
            ctx.beginPath()
            ctx.roundRect(x, (canvas.height - 4) / 2, barW, 4, 2)
            ctx.fill()
        }
    }

    // ── real mic analyser ─────────────────────────────
    const drawLive = () => {
        const canvas = canvasRef.current
        if (!canvas || !analyser) return
        const ctx = canvas.getContext('2d')
        const { width: W, height: H } = canvas
        const { barCount, barW, gap } = layout(W)
        const buf = new Uint8Array(analyser.frequencyBinCount)
        const step = Math.floor(analyser.frequencyBinCount / barCount)

        const tick = () => {
            analyser.getByteFrequencyData(buf)
            ctx.clearRect(0, 0, W, H)
            for (let i = 0; i < barCount; i++) {
                const v = buf[i * step] / 255
                const bH = Math.max(4, v * H * 0.85)
                ctx.fillStyle = hexRgba(color, 0.5 + v * 0.5)
                ctx.beginPath()
                ctx.roundRect(i * (barW + gap), (H - bH) / 2, barW, bH, barW / 2)
                ctx.fill()
            }
            rafRef.current = requestAnimationFrame(tick)
        }
        tick()
    }

    // ── animated sine wave (AI speaking, no analyser) ─
    const drawAnimated = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        const { width: W, height: H } = canvas
        const { barCount, barW, gap } = layout(W)

        const tick = () => {
            ctx.clearRect(0, 0, W, H)
            const t = Date.now() / 380
            for (let i = 0; i < barCount; i++) {
                const wave = Math.abs(Math.sin(t + i * 0.38)) * Math.abs(Math.sin(t * 0.7 + i * 0.22))
                const v = 0.2 + 0.75 * wave
                const bH = Math.max(5, v * H * 0.82)
                ctx.fillStyle = hexRgba(color, 0.35 + 0.55 * wave)
                ctx.beginPath()
                ctx.roundRect(i * (barW + gap), (H - bH) / 2, barW, bH, barW / 2)
                ctx.fill()
            }
            rafRef.current = requestAnimationFrame(tick)
        }
        tick()
    }

    return (
        <canvas ref={canvasRef} width={420} height={72}
            style={{ width: '100%', height: 72 }} />
    )
}

function layout(width) {
    const barCount = 48
    const barW = (width / barCount) * 0.58
    const gap = (width / barCount) * 0.42
    return { barCount, barW, gap }
}

function hexRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}
