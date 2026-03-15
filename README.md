# 🤖 AI Interviewer

An AI-powered mock interview platform — sign in with Google, get interviewed by AI (voice in, voice out, camera gaze monitoring), and have your reports saved automatically for review anytime.

## ✨ Features

| Feature | Details |
|---------|---------|
| 🔐 **Google Auth** | Sign in with Google via Supabase OAuth — sessions persist across visits |
| 📋 **Interview History** | All past reports saved to your account, viewable anytime |
| 🎙️ **Voice Recording** | Small mic button below the chat — press to speak, press to stop |
| 🔊 **Streaming AI Voice** | TTS plays sentence-by-sentence as text streams in (no waiting) |
| 📷 **Camera Gaze Monitor** | Compact fixed overlay (bottom-right) — TF.js / MediaPipe flags look-aways without blocking the UI |
| 💬 **Full-Height Chat** | Questions and answers fill the entire viewport height; sticky top bar keeps Q count, timer, and status always visible |
| 🙋 **Always Intro First** | Every interview opens with a self-introduction prompt |
| 📄 **Resume Upload** | Upload PDF or .txt — AI tailors questions to your experience |
| 📋 **Job Description** | Paste the JD — AI aligns questions to the role requirements |
| 🔢 **Custom Question Count** | Slider (1–15) to choose how many questions you want |
| ⏱️ **Timed Mode** | AI sets a per-question time limit; countdown bar shown in the sticky top bar |
| 🎯 **3 Interview Types** | Technical, Behavioral, Mixed |
| 📊 **Detailed Feedback** | Score (1–100), grade, strengths, improvements + per-question accordion |
| 👤 **Your Full Answer** | Each question shows exactly what you said |
| 📝 **Model Answer** | GPT writes a complete example answer you can learn from |
| 👁️ **Look-Away Counter** | Tracks how many times you were flagged during the session |

## 🖥️ Interview Page Layout

```
┌── 🤖 Role  exp · type │ Q 2/5 ████░ │ 🎙️ Your turn │ ⏱ ███ 84s │ End Now ──┐  ← sticky
│                                                                               │
│                  Full-height chat (questions & answers)                       │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
  ▒▒▒▒▒▒▒ waveform ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  🎙 38px
                                                          📷 CAM (fixed corner)
```

- **Sticky top bar** — role name, Q count badge, progress bar, status, countdown timer and End Now all in one row; always visible as chat grows
- **Full-width chat** — uses `calc(100vh − 220px)` height, scrolls internally
- **Bottom strip** — slim waveform visualizer + compact mic button (38 px), never obscures chat
- **Camera overlay** — 110 × 82 px fixed to bottom-right; no layout impact; `onWarning` is memoized so the feed never flickers

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
| Auth & DB | Supabase (Google OAuth + Postgres with RLS) |
| STT | OpenAI Whisper-1 |
| TTS | OpenAI TTS-1 (`nova` voice) — streamed inline in SSE |
| AI (Questions) | GPT-4o-mini (fast streaming) |
| AI (Feedback) | GPT-4o (deep evaluation) |
| Face Detection | TensorFlow.js + MediaPipe Face Detection |
| Design | Vanilla CSS (dark glassmorphism) |

## 📁 Project Structure

```
AI_Interviewer/
├── backend/
│   ├── main.py              # FastAPI — streaming SSE, concurrent TTS, resume parsing, save-report
│   ├── requirements.txt     # Python deps
│   └── .env                 # OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
└── frontend/
    ├── src/
    │   ├── lib/
    │   │   └── supabaseClient.js      # Supabase singleton
    │   ├── context/
    │   │   └── AuthContext.jsx        # Google OAuth, session state, signIn/signOut
    │   ├── pages/
    │   │   ├── LoginPage.jsx          # Full-screen Google sign-in
    │   │   ├── SetupPage.jsx          # Role, experience, type, question count, resume/JD
    │   │   ├── InterviewPage.jsx      # Sticky top bar, full-height chat, waveform strip, camera overlay
    │   │   ├── FeedbackPage.jsx       # Accordion breakdown + auto-saves to Supabase
    │   │   └── ReportsPage.jsx        # Past interview history
    │   ├── components/
    │   │   ├── CameraMonitor.jsx      # Compact 110×82 px overlay, memoized onWarning
    │   │   ├── WaveformVisualizer.jsx
    │   │   └── MessageBubble.jsx
    │   ├── App.jsx                    # Auth guard + sticky header
    │   ├── main.jsx
    │   └── index.css
    └── .env                 # VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

## 🚀 Quick Start

### 1. Supabase Setup (one-time)

1. Create a project at [supabase.com](https://supabase.com)
2. Enable **Google OAuth**: Dashboard → Authentication → Providers → Google
3. Add `http://localhost:5173` to **Allowed Redirect URLs**
4. Run this SQL in **Supabase → SQL Editor**:

```sql
create table public.interview_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null, experience text not null, interview_type text not null,
  overall_score int not null, grade text not null, recommendation text not null,
  summary text, strengths jsonb, improvements jsonb, question_scores jsonb,
  recommendation_reason text, gaze_warnings int default 0,
  created_at timestamptz default now()
);
alter table public.interview_reports enable row level security;
create policy "Users can insert own reports" on public.interview_reports
  for insert with check (auth.uid() = user_id);
create policy "Users can view own reports" on public.interview_reports
  for select using (auth.uid() = user_id);
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**`backend/.env`:**
```
OPENAI_API_KEY=sk-...
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

**`frontend/.env`:**
```
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> **Browser permissions:** Allow **microphone** and **camera** when prompted. Camera is used for gaze monitoring only — no video is sent to the server.

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/start-interview` | Start session (FormData: role, experience, type, num_questions, resume?, job_description?) |
| POST | `/api/transcribe` | Audio blob → transcript via Whisper |
| POST | `/api/respond-stream` | Answer → streaming SSE with text tokens + inline base64 TTS audio |
| GET | `/api/tts/{session_id}/{index}` | Cached TTS for first question |
| POST | `/api/end-interview` | Generate GPT-4o feedback JSON with scores + model answers |
| DELETE | `/api/session/{session_id}` | Clean up session |

## 🏗️ How It Works

```
Google Sign-In (Supabase OAuth)
  ▼
Setup Page — role, experience, interview type, question count, resume/JD
  ▼
POST /api/start-interview  →  GPT-4o-mini generates intro question + pre-generates TTS
  ▼
Interview Loop
  │  Sticky bar: Q count · status · timer always visible
  │  🎙️ → MediaRecorder → POST /api/transcribe → Whisper transcript
  │  POST /api/respond-stream (SSE)
  │    ├── {type:"text"}  → live streaming chat bubble (full-width)
  │    ├── asyncio TTS tasks run concurrently per sentence
  │    └── {type:"audio"} → base64 MP3 played inline
  │  Camera overlay: TF.js checks gaze every 1.5s (memoized, no flicker)
  ▼
POST /api/end-interview → GPT-4o evaluates full transcript
  ▼
Feedback Page
  ├── Auto-saves report to Supabase (direct client insert, RLS protected)
  ├── ✅ Saved badge
  └── Accordion: score · grade · strengths · Q&A breakdown · model answers
  ▼
📋 History Page — view all past reports from your account
```

## 🔐 Auth Flow

```
User opens app
  ├── No session → LoginPage → "Continue with Google" → Supabase OAuth
  │                                                     └── redirect back → session stored
  └── Session exists → App with sticky header (avatar + History + Sign Out)
          └── Feedback Page auto-saves → History Page fetches all reports (RLS protected)
```
