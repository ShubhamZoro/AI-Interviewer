import React, { useState, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const ROLES = [
    'Software Engineer', 'Frontend Developer', 'Backend Developer',
    'Full Stack Developer', 'Data Scientist', 'Machine Learning Engineer',
    'DevOps Engineer', 'Product Manager', 'Data Analyst',
    'System Design Engineer', 'Mobile Developer', 'Cloud Architect',
]

const EXPERIENCE_LEVELS = [
    { label: 'Entry Level (0–1 years)', value: '0–1 years' },
    { label: 'Junior (1–3 years)', value: '1–3 years' },
    { label: 'Mid-Level (3–5 years)', value: '3–5 years' },
    { label: 'Senior (5–8 years)', value: '5–8 years' },
    { label: 'Lead / Principal (8+ years)', value: '8+ years' },
]

const INTERVIEW_TYPES = [
    { id: 'technical', icon: '⚙️', title: 'Technical', desc: 'Coding, system design & concepts' },
    { id: 'behavioral', icon: '🧠', title: 'Behavioral', desc: 'STAR questions about past work' },
    { id: 'mixed', icon: '🎯', title: 'Mixed', desc: 'Balanced tech + behavioral' },
]

export default function SetupPage({ onStart }) {
    const [role, setRole] = useState('')
    const [customRole, setCustomRole] = useState('')
    const [experience, setExperience] = useState('')
    const [interviewType, setInterviewType] = useState('')
    const [jobDescription, setJobDescription] = useState('')
    const [resumeFile, setResumeFile] = useState(null)
    const [showOptional, setShowOptional] = useState(false)
    const [numQuestions, setNumQuestions] = useState(5)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const fileInputRef = useRef(null)

    const finalRole = role === '__custom__' ? customRole : role
    const isValid = finalRole.trim() && experience && interviewType

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        if (file) setResumeFile(file)
    }

    const handleStart = async () => {
        if (!isValid) return
        setLoading(true)
        setError('')
        try {
            const formData = new FormData()
            formData.append('role', finalRole.trim())
            formData.append('experience', experience)
            formData.append('interview_type', interviewType)
            formData.append('job_description', jobDescription || '')
            formData.append('num_questions', String(numQuestions))
            if (resumeFile) formData.append('resume', resumeFile)

            const res = await fetch(`${API_URL}/api/start-interview`, {
                method: 'POST',
                body: formData,
            })
            if (!res.ok) throw new Error(await res.text())
            const data = await res.json()
            onStart({ ...data, role: finalRole.trim(), experience, interview_type: interviewType })
        } catch (err) {
            setError(err.message || 'Failed to start. Check backend & API key.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="app-container">
            <div className="glass-card animate-fade-up"
                style={{ width: '100%', maxWidth: 600, padding: '44px 44px' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{
                        width: 68, height: 68, borderRadius: '50%', margin: '0 auto 18px',
                        background: 'linear-gradient(135deg, #7c3aed22, #a78bfa33)',
                        border: '1.5px solid rgba(167,139,250,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 30, boxShadow: '0 0 30px rgba(124,58,237,0.2)',
                    }}>🤖</div>
                    <h1 style={{
                        fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em',
                        background: 'linear-gradient(135deg, #f1f0ff, #a78bfa)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        marginBottom: 6,
                    }}>AI Interviewer</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                        Practice with an AI that speaks, listens, and gives real feedback
                    </p>
                </div>

                {/* Role */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Job Role</label>
                    <select className="form-control" value={role}
                        onChange={e => setRole(e.target.value)}>
                        <option value="">Select a role…</option>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        <option value="__custom__">Other (type below)</option>
                    </select>
                    {role === '__custom__' && (
                        <input className="form-control" placeholder="e.g. Blockchain Developer"
                            value={customRole} onChange={e => setCustomRole(e.target.value)}
                            style={{ marginTop: 8 }} />
                    )}
                </div>

                {/* Experience */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label">Experience Level</label>
                    <select className="form-control" value={experience}
                        onChange={e => setExperience(e.target.value)}>
                        <option value="">Select experience…</option>
                        {EXPERIENCE_LEVELS.map(l => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                    </select>
                </div>

                {/* Interview Type */}
                <div className="form-group" style={{ marginBottom: 24 }}>
                    <label className="form-label">Interview Type</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 4 }}>
                        {INTERVIEW_TYPES.map(t => (
                            <button key={t.id} onClick={() => setInterviewType(t.id)} style={{
                                background: interviewType === t.id
                                    ? 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(167,139,250,0.15))'
                                    : 'rgba(255,255,255,0.03)',
                                border: interviewType === t.id
                                    ? '1.5px solid rgba(167,139,250,0.6)' : '1px solid var(--border)',
                                borderRadius: 14, padding: '13px 8px', cursor: 'pointer',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                                transition: 'var(--transition)',
                                boxShadow: interviewType === t.id ? '0 0 16px rgba(124,58,237,0.2)' : 'none',
                            }}>
                                <span style={{ fontSize: 20 }}>{t.icon}</span>
                                <span style={{
                                    color: interviewType === t.id ? 'var(--accent-secondary)' : 'var(--text-primary)',
                                    fontWeight: 600, fontSize: '0.86rem',
                                }}>{t.title}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.70rem', textAlign: 'center' }}>
                                    {t.desc}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Number of Questions */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Number of Questions</span>
                        <span style={{
                            color: 'var(--accent-secondary)', fontWeight: 700, fontSize: '0.92rem',
                            background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(167,139,250,0.3)',
                            padding: '2px 11px', borderRadius: 99,
                        }}>{numQuestions}</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: 10 }}>1</span>
                        <input
                            type="range" min={1} max={15} step={1}
                            value={numQuestions}
                            onChange={e => setNumQuestions(Number(e.target.value))}
                            style={{
                                flex: 1, accentColor: '#7c3aed', height: 4, cursor: 'pointer',
                                appearance: 'auto',
                            }}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: 16 }}>15</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 5, marginBottom: 0 }}>
                        First question is always "Introduce yourself". Max 15.
                    </p>
                </div>

                {/* Optional Context Toggle */}
                <button
                    onClick={() => setShowOptional(v => !v)}
                    style={{
                        width: '100%', background: 'rgba(255,255,255,0.03)',
                        border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 12,
                        color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: 500,
                        padding: '11px', cursor: 'pointer', marginBottom: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'var(--transition)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
                >
                    <span style={{ fontSize: 14 }}>{showOptional ? '▲' : '▼'}</span>
                    {showOptional ? 'Hide' : 'Add'} Resume & Job Description
                    <span style={{
                        fontSize: '0.72rem', padding: '2px 8px', borderRadius: 99,
                        background: 'rgba(124,58,237,0.2)', color: 'var(--accent-secondary)',
                    }}>optional · improves question quality</span>
                </button>

                {/* Optional section */}
                {showOptional && (
                    <div className="animate-fade-in" style={{
                        background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(167,139,250,0.15)',
                        borderRadius: 16, padding: '20px 20px', marginBottom: 20,
                        display: 'flex', flexDirection: 'column', gap: 16,
                    }}>
                        {/* Resume Upload */}
                        <div className="form-group">
                            <label className="form-label">Resume (PDF or .txt)</label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: resumeFile
                                        ? '1.5px solid rgba(16,185,129,0.5)'
                                        : '2px dashed rgba(255,255,255,0.15)',
                                    borderRadius: 12, padding: '18px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: 10, transition: 'var(--transition)',
                                    background: resumeFile ? 'rgba(16,185,129,0.07)' : 'transparent',
                                }}
                                onMouseEnter={e => !resumeFile && (e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)')}
                                onMouseLeave={e => !resumeFile && (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
                            >
                                <span style={{ fontSize: 22 }}>{resumeFile ? '✅' : '📄'}</span>
                                <div>
                                    <div style={{
                                        color: resumeFile ? '#10b981' : 'var(--text-secondary)',
                                        fontSize: '0.88rem', fontWeight: 500,
                                    }}>
                                        {resumeFile ? resumeFile.name : 'Click to upload resume'}
                                    </div>
                                    {!resumeFile && (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                                            PDF or .txt — used to tailor questions
                                        </div>
                                    )}
                                </div>
                                {resumeFile && (
                                    <button
                                        onClick={e => { e.stopPropagation(); setResumeFile(null); fileInputRef.current.value = '' }}
                                        style={{
                                            marginLeft: 'auto', background: 'rgba(239,68,68,0.15)',
                                            border: 'none', borderRadius: 99, color: '#f87171',
                                            width: 26, height: 26, cursor: 'pointer', fontSize: 12,
                                        }}>✕</button>
                                )}
                            </div>
                            <input
                                ref={fileInputRef} type="file"
                                accept=".pdf,.txt" style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />
                        </div>

                        {/* Job Description */}
                        <div className="form-group">
                            <label className="form-label">Job Description</label>
                            <textarea
                                className="form-control"
                                placeholder="Paste the job description here… The AI will tailor questions to the role requirements."
                                value={jobDescription}
                                onChange={e => setJobDescription(e.target.value)}
                                rows={4}
                                style={{ resize: 'vertical', minHeight: 90 }}
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 10, padding: '11px 16px', marginBottom: 18,
                        color: '#fca5a5', fontSize: '0.875rem',
                    }}>⚠️ {error}</div>
                )}

                <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
                    onClick={handleStart} disabled={!isValid || loading} id="start-interview-btn">
                    {loading
                        ? <><div className="spinner" /> Preparing your interview…</>
                        : <>Start Interview →</>}
                </button>

                <p style={{ textAlign: 'center', marginTop: 14, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    🎙️ Allow mic &amp; camera · {numQuestions} questions · always starts with self-intro
                </p>
            </div>
        </div>
    )
}
