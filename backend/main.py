import os
import uuid
import json
import re
import base64
import asyncio
import tempfile
import io
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI, AsyncOpenAI

load_dotenv()

app = FastAPI(title="AI Interviewer API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000",
                   "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client       = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
async_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

sessions: dict[str, dict] = {}
MAX_QUESTIONS = 5

SENTENCE_END_RE = re.compile(r'[.!?]["\']?\s')


# ─── TTS helper ──────────────────────────────────────────────────
async def _fetch_tts(text: str) -> bytes:
    """Async TTS — runs concurrently with GPT streaming."""
    resp = await async_client.audio.speech.create(
        model="tts-1",
        voice="nova",
        input=text.strip(),
        response_format="mp3",
    )
    return resp.content


# ─── Resume extractor ─────────────────────────────────────────────
async def extract_resume_text(upload: UploadFile) -> str:
    content = await upload.read()
    fname = (upload.filename or "").lower()
    if fname.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            return "\n".join(p.extract_text() or "" for p in reader.pages)
        except Exception:
            return ""
    return content.decode("utf-8", errors="ignore")


# ─── System prompt builder ────────────────────────────────────────
SYSTEM_TEMPLATE = """You are an expert interviewer conducting a {interview_type} interview for a {role} position.
The candidate has {experience} of experience.
{resume_section}
{jd_section}
Rules:
- Ask ONE focused question at a time. Keep it to 2-3 sentences max.
- Base follow-up questions on what the candidate just said or can ask questions based on their resume or job description.
- Match difficulty to their experience level.
- Be warm, professional, and encouraging.
- Do NOT evaluate their answer verbally — just ask the next question naturally.

Interview type:
- behavioral: STAR-method questions about past experiences
- technical: technical concepts, system design, problem-solving
- mixed: balanced mix of both"""


def build_system_prompt(role, experience, interview_type,
                        resume_text="", jd_text="") -> str:
    resume_section = ""
    if resume_text.strip():
        resume_section = f"\nCANDIDATE'S RESUME:\n{resume_text[:3500]}\n\nUse the resume to ask specific questions about their experience, projects, and skills.\n"

    jd_section = ""
    if jd_text.strip():
        jd_section = f"\nJOB DESCRIPTION:\n{jd_text[:2000]}\n\nAlign questions with the job requirements and look for qualification gaps.\n"

    return SYSTEM_TEMPLATE.format(
        role=role,
        experience=experience,
        interview_type=interview_type,
        resume_section=resume_section,
        jd_section=jd_section,
    )


# ─── Routes ──────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "AI Interviewer API v3 running"}


# ── Start Interview (FormData with optional resume + JD) ──────────
@app.post("/api/start-interview")
async def start_interview(
    role: str = Form(...),
    experience: str = Form(...),
    interview_type: str = Form(...),
    job_description: str = Form(""),
    resume: Optional[UploadFile] = File(None),
):
    session_id = str(uuid.uuid4())

    resume_text = ""
    if resume and resume.filename:
        resume_text = await extract_resume_text(resume)

    system_prompt = build_system_prompt(
        role, experience, interview_type, resume_text, job_description
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Start the interview. I'm applying for {role}."},
    ]

    # Use sync client for first question (simpler, still fast with gpt-4o-mini)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.7,
        max_tokens=250,
    )
    first_question = response.choices[0].message.content
    messages.append({"role": "assistant", "content": first_question})

    # Generate first TTS concurrently (non-blocking via await)
    audio_bytes = await _fetch_tts(first_question)

    sessions[session_id] = {
        "role": role,
        "experience": experience,
        "interview_type": interview_type,
        "resume_text": resume_text,
        "job_description": job_description,
        "messages": messages,
        "qa_pairs": [],
        "question_count": 1,
        "current_question": first_question,
        "first_audio": audio_bytes,
    }

    return JSONResponse({
        "session_id": session_id,
        "question": first_question,
        "question_index": 0,
        "question_count": 1,
    })


# ── First question cached TTS ──────────────────────────────────────
@app.get("/api/tts/{session_id}/{index}")
async def get_tts(session_id: str, index: int):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    audio_bytes = session.get("first_audio")
    if not audio_bytes:
        raise HTTPException(status_code=404, detail="Audio not cached")
    return StreamingResponse(
        iter([audio_bytes]),
        media_type="audio/mpeg",
        headers={"Accept-Ranges": "bytes"},
    )


# ── Transcribe ─────────────────────────────────────────────────────
@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read()
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        with open(tmp_path, "rb") as f:
            result = client.audio.transcriptions.create(
                model="whisper-1", file=f, response_format="text"
            )
        os.unlink(tmp_path)
        return {"transcript": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Streaming Respond (GPT + concurrent TTS, audio inline in SSE) ──
class RespondRequest(BaseModel):
    session_id: str
    transcript: str

@app.post("/api/respond-stream")
async def respond_stream(req: RespondRequest):
    session_id = req.session_id
    transcript = req.transcript
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Save Q&A pair immediately
    session["qa_pairs"].append({
        "question": session["current_question"],
        "answer": transcript,
    })
    session["messages"].append({"role": "user", "content": transcript})

    if session["question_count"] >= MAX_QUESTIONS:
        async def done_gen():
            yield f"data: {json.dumps({'type': 'done_interview'})}\n\n"
        return StreamingResponse(
            done_gen(), media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    async def generate():
        full_text = ""
        sentence_buffer = ""
        sentence_order = 0
        sent_audio_count = 0
        tts_futures: list[tuple[int, asyncio.Task]] = []

        try:
            stream = await async_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=session["messages"],
                temperature=0.7,
                max_tokens=250,
                stream=True,
            )

            async for chunk in stream:
                content = chunk.choices[0].delta.content or ""
                if not content:
                    continue

                full_text += content
                sentence_buffer += content

                # Emit text token immediately
                yield f"data: {json.dumps({'type': 'text', 'content': content})}\n\n"

                # Detect sentence boundaries → launch TTS concurrently
                while True:
                    m = SENTENCE_END_RE.search(sentence_buffer)
                    if not m:
                        break
                    sentence = sentence_buffer[:m.end()].strip()
                    sentence_buffer = sentence_buffer[m.end():]
                    if len(sentence) > 4:
                        task = asyncio.create_task(_fetch_tts(sentence))
                        tts_futures.append((sentence_order, task))
                        sentence_order += 1

                # Eagerly emit any completed TTS audio (in order)
                while (sent_audio_count < len(tts_futures) and
                       tts_futures[sent_audio_count][1].done()):
                    o, t = tts_futures[sent_audio_count]
                    try:
                        audio_b64 = base64.b64encode(t.result()).decode()
                        yield f"data: {json.dumps({'type': 'audio', 'order': o, 'audio_b64': audio_b64})}\n\n"
                    except Exception:
                        pass
                    sent_audio_count += 1

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return

        # Flush last partial sentence
        if sentence_buffer.strip() and len(sentence_buffer.strip()) > 4:
            task = asyncio.create_task(_fetch_tts(sentence_buffer.strip()))
            tts_futures.append((sentence_order, task))

        # Save session state
        session["messages"].append({"role": "assistant", "content": full_text})
        session["question_count"] += 1
        session["current_question"] = full_text

        # Emit any remaining audio in order (await if not yet done)
        for o, t in tts_futures[sent_audio_count:]:
            try:
                audio_bytes = await t
                audio_b64 = base64.b64encode(audio_bytes).decode()
                yield f"data: {json.dumps({'type': 'audio', 'order': o, 'audio_b64': audio_b64})}\n\n"
            except Exception:
                pass

        yield f"data: {json.dumps({'type': 'done', 'question_count': session['question_count']})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── End Interview ─────────────────────────────────────────────────
class EndInterviewRequest(BaseModel):
    session_id: str

@app.post("/api/end-interview")
async def end_interview_route(req: EndInterviewRequest):
    session_id = req.session_id
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    qa_pairs = session["qa_pairs"]
    if not qa_pairs:
        raise HTTPException(status_code=400, detail="No answers recorded yet")

    transcript_text = ""
    for i, pair in enumerate(qa_pairs, 1):
        transcript_text += f"\nQ{i}: {pair['question']}\nA{i}: {pair['answer']}\n"

    feedback_prompt = f"""You are evaluating a {session['interview_type']} interview for a {session['role']} position (candidate has {session['experience']} experience).

Interview transcript:
{transcript_text}

Return ONLY valid JSON (no markdown) in this exact schema:
{{
  "overall_score": <1-100>,
  "grade": "<A|B|C|D|F>",
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "improvements": ["<area1>", "<area2>", "<area3>"],
  "question_scores": [
    {{
      "question": "<full question text>",
      "answer": "<candidate's full answer, do not truncate>",
      "score": <1-10>,
      "feedback": "<specific constructive feedback on what they said>",
      "ideal_answer": "<key points and concepts a strong answer would include>"
    }}
  ],
  "recommendation": "<Strong Yes|Yes|Maybe|No>",
  "recommendation_reason": "<1-2 sentence reason>"
}}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": feedback_prompt}],
        temperature=0.3,
        max_tokens=2500,
        response_format={"type": "json_object"},
    )

    feedback = json.loads(response.choices[0].message.content)
    sessions.pop(session_id, None)
    return JSONResponse(feedback)


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    sessions.pop(session_id, None)
    return {"message": "ok"}
