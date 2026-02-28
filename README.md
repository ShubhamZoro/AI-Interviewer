# 🤖 AI Interviewer

An AI-powered mock interview platform — the AI speaks questions aloud, monitors your camera for eye contact, listens to your answers via voice, and delivers a rich feedback report at the end.

## ✨ Features

| Feature | Details |
|---------|---------|
| 🎙️ **Voice Recording** | Press mic, speak your answer, press stop |
| 🔊 **Streaming AI Voice** | TTS starts playing sentence-by-sentence as text streams in (no waiting for full response) |
| 📷 **Camera Gaze Monitor** | Live webcam with TF.js / MediaPipe face detection — flags if you look away |
| 💬 **Chat Transcript** | Real-time streaming chat with blinking cursor while AI types |
| 🙋 **Always Intro First** | Every interview opens with "Tell me about yourself" |
| 📄 **Resume Upload** | Upload PDF or .txt — AI tailors questions to your experience |
| 📋 **Job Description** | Paste the JD — AI aligns questions to the role requirements |
| 🔢 **Custom Question Count** | Slider (1–15) to choose how many questions you want |
| 🎯 **3 Interview Types** | Technical, Behavioral, Mixed |
| 📊 **Detailed Feedback** | Score (1–100), grade, strengths, improvements + per-question accordion |
| 👤 **Your Full Answer** | Each question shows exactly what you said |
| 📝 **Model Answer** | GPT writes a complete example answer you can learn from |
| 👁️ **Look-Away Counter** | Tracks how many times you were flagged during the session |

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
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
│   ├── main.py              # FastAPI v3 — streaming SSE + concurrent TTS + resume parsing
│   ├── requirements.txt     # Python deps (includes pypdf)
│   └── .env                 # OPENAI_API_KEY (create this)
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── SetupPage.jsx      # Role, experience, type, question count, resume/JD
    │   │   ├── InterviewPage.jsx  # Recording, streaming, camera monitor
    │   │   └── FeedbackPage.jsx   # Accordion breakdown with answer + model answer
    │   ├── components/
    │   │   ├── CameraMonitor.jsx  # Webcam + TF.js gaze detection
    │   │   ├── WaveformVisualizer.jsx
    │   │   └── MessageBubble.jsx
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    └── .env                 # VITE_API_URL
```

## 🚀 Quick Start

### 1. Backend

```bash
cd backend

# Copy env file and add your key
cp .env.example .env
# Edit .env → set OPENAI_API_KEY=sk-...

# Create virtual env and install deps
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate  # macOS/Linux

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend: http://localhost:8000 · Swagger: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

> **Browser permissions:** Allow **microphone** and **camera** when prompted. Camera is used for gaze monitoring only — no video is sent to the server.

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/start-interview` | Start session (FormData: role, experience, type, num_questions, resume?, job_description?) |
| POST | `/api/transcribe` | Audio blob → transcript via Whisper |
| POST | `/api/respond-stream` | Answer → streaming SSE with text tokens + inline base64 TTS audio |
| GET | `/api/tts/{session_id}/{index}` | Cached TTS for the first question |
| POST | `/api/end-interview` | Generate GPT-4o feedback JSON with scores + model answers |
| DELETE | `/api/session/{session_id}` | Clean up session |

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```
OPENAI_API_KEY=your-openai-api-key
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:8000
```

## 🏗️ How It Works

```
Setup Page
  │  role + experience + interview type + question count
  │  optional: resume (PDF/txt) + job description
  ▼
POST /api/start-interview  →  GPT-4o-mini generates intro question
                           →  TTS pre-generated and cached
  ▼
Interview Loop
  │  User clicks 🎙️ → MediaRecorder captures audio
  │  POST /api/transcribe → Whisper → transcript
  │  POST /api/respond-stream (SSE)
  │    ├── {type:"text"} events → live streaming bubble
  │    ├── asyncio.create_task(_fetch_tts(sentence)) → runs concurrently
  │    └── {type:"audio"} events → base64 MP3 played inline (no extra fetch!)
  │  Camera: TF.js checks gaze every 1.5s → warns if face not detected
  ▼
POST /api/end-interview → GPT-4o evaluates full transcript
  ▼
Feedback Page (accordion per question)
  ├── 👤 Your Answer (full, untruncated)
  ├── 💬 Feedback (specific to what you said)
  └── 📝 Model Answer (complete example with concrete details)
```
