# 🤖 AI Interviewer

An AI-powered mock interview platform — the AI speaks questions aloud, listens to your answers, and gives a detailed feedback report at the end.

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React + Vite |
| Backend   | FastAPI (Python) |
| STT       | OpenAI Whisper |
| TTS       | OpenAI TTS (`nova` voice) |
| AI Brain  | GPT-4o-mini |
| Design    | Vanilla CSS (dark glassmorphism) |

## Features

- 🎙️ **Voice Recording** — press mic, speak your answer, press stop
- 🔊 **AI Voice** — every question spoken aloud via OpenAI TTS
- 📊 **Live Waveform** — frequency-bar visualizer for both mic and AI audio
- 💬 **Chat Transcript** — full interview history in a chat-style UI
- 🧠 **Smart Follow-ups** — GPT-4o generates contextual follow-up questions
- 📝 **Detailed Feedback** — score (1-100), grade, strengths, improvements, per-question breakdown
- 🎯 **3 Interview Types** — Technical, Behavioral, Mixed

## Project Structure

```
AI_Interviewer/
├── backend/
│   ├── main.py            # FastAPI app
│   ├── requirements.txt   # Python deps
│   └── .env               # OPENAI_API_KEY (create this)
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── SetupPage.jsx
    │   │   ├── InterviewPage.jsx
    │   │   └── FeedbackPage.jsx
    │   ├── components/
    │   │   ├── WaveformVisualizer.jsx
    │   │   └── MessageBubble.jsx
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    └── .env               # VITE_API_URL
```

## Quick Start

### 1. Backend

```bash
cd backend
# Create .env
echo OPENAI_API_KEY=sk-... > .env

# Install and run
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000  
Swagger docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/start-interview` | Start session, get first question + TTS |
| POST | `/api/transcribe` | Upload audio blob → transcript (Whisper) |
| POST | `/api/respond` | Send answer → get next question + TTS |
| GET | `/api/tts/{session_id}/{index}` | Stream TTS audio for a question |
| POST | `/api/end-interview` | Generate feedback JSON report |
| DELETE | `/api/session/{session_id}` | Clean up a session |

## Environment Variables

### Backend (`backend/.env`)
```
OPENAI_API_KEY=your-openai-api-key
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:8000
```
