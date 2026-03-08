import os
import uuid
import json
import re
import base64
import asyncio
import tempfile
import io
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI, AsyncOpenAI
from supabase import create_client, Client

load_dotenv()

app = FastAPI(title="AI Interviewer API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000",
                   "http://localhost:5174", "http://localhost:5175",f'{os.getenv("FRONTEND_URL")}'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client       = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
async_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ─── Supabase client (service role — server-side only) ────────────
_supa_url = os.getenv("SUPABASE_URL", "")
_supa_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase_client: Client | None = create_client(_supa_url, _supa_key) if _supa_url and _supa_key else None

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
SYSTEM_TEMPLATE = """You are a senior interviewer at a top tech company conducting a {interview_type} interview for a {role} position.
The candidate has {experience} of experience.
{resume_section}
{jd_section}
STRICT RULES — follow every one without exception:
- Ask ONE direct, specific question at a time. 1-2 sentences max.
- NEVER ask meta-questions like "What topic would you like to cover?", "What area should we focus on?", or anything that asks the candidate to choose the direction. YOU choose the next question.
- NEVER ask permission to ask a question. Just ask it.
- Your VERY FIRST turn must be an introduction prompt: "Please start with a brief introduction about yourself and your background."
- After the intro, ask concrete, targeted questions specific to the {role} role and {experience} experience level. Examples of good questions:
  * For a backend developer: "How would you design a rate-limiting system for a high-traffic REST API?"
  * For a frontend developer: "Explain how React's reconciliation algorithm works and when you'd use useMemo."
  * For behavioral: "Tell me about a time you had to optimize a slow database query. What was your approach?"
- Match difficulty precisely to {experience}: junior = fundamentals, mid = design trade-offs, senior = architecture + leadership.
- Base follow-up questions on exactly what the candidate just said — reference their specific words.
- Do NOT evaluate or score their answer out loud. Just acknowledge briefly and ask the next question.
- Be warm and professional but stay focused — this is a real interview.

Interview type context:
- behavioral: STAR-method questions about real past experiences and decisions
- technical: specific technical concepts, system design, debugging scenarios, code reasoning
- mixed: alternate between behavioral and technical, keeping it balanced"""


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
    num_questions: int = Form(5),
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
        {"role": "user", "content": f"Start the interview. I'm applying for {role}. Please begin by asking me to introduce myself."},
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
        "max_questions": max(1, min(15, num_questions)),
    }

    return JSONResponse({
        "session_id": session_id,
        "question": first_question,
        "question_index": 0,
        "question_count": 1,
        "num_questions": max(1, min(15, num_questions)),
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

    if session["question_count"] >= session["max_questions"]:
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
    gaze_warnings: int = 0  # look-away flags from frontend camera monitor

@app.post("/api/end-interview")
async def end_interview_route(req: EndInterviewRequest):
    session_id    = req.session_id
    gaze_warnings = req.gaze_warnings
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    qa_pairs = session["qa_pairs"]
    if not qa_pairs:
        raise HTTPException(status_code=400, detail="No answers recorded yet")

    transcript_text = ""
    for i, pair in enumerate(qa_pairs, 1):
        transcript_text += f"\nQ{i}: {pair['question']}\nA{i}: {pair['answer']}\n"

    gaze_note = ""
    if gaze_warnings > 0:
        gaze_note = f"\nEye contact note: The candidate looked away from the camera {gaze_warnings} time(s) during the interview. Mention this briefly in the summary if it seems relevant to professionalism."

    # Early-end penalty
    max_q   = session.get("max_questions", 5)
    asked_q = len(qa_pairs)
    early_note = ""
    if asked_q < max_q:
        completion_pct = round((asked_q / max_q) * 100)
        early_note = f"""

IMPORTANT — EARLY TERMINATION PENALTY: The candidate ended the interview after only {asked_q} of {max_q} planned questions ({completion_pct}% completion). \
This is a significant red flag. Apply the following mandatory penalties:
- Reduce EVERY individual question score by 1–3 points compared to what you would normally give.
- The overall_score must be reduced by at least {min(30, 100 - completion_pct)} points compared to a full interview of equal quality.
- Downgrade the grade by at least one letter compared to what the answers alone would merit.
- The recommendation must be at most "Maybe" (never "Yes" or "Strong Yes").
- The summary must explicitly mention that the candidate left the interview early."""

    feedback_prompt = f"""You are evaluating a {session['interview_type']} interview for a {session['role']} position (candidate has {session['experience']} experience).{gaze_note}{early_note}
{f"Candidate's resume summary (use this to personalise ideal answers with relevant technologies/projects):{chr(10)}{session['resume_text'][:2000]}{chr(10)}" if session.get('resume_text', '').strip() else ''}
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
      "feedback": "<specific constructive feedback referencing exactly what the candidate said and what was missing>",
      "ideal_answer": "<Write a complete, well-structured model answer (4-6 sentences). If a resume was provided, ground examples in the candidate's actual projects/stack where relevant; otherwise use concrete general examples. Cover: the core concept, a real-world example, any important trade-offs, and what a senior engineer would add.>"
    }}
  ],
  "recommendation": "<Strong Yes|Yes|Maybe|No>",
  "recommendation_reason": "<1-2 sentence reason>"
}}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": feedback_prompt}],
        temperature=0.3,
        max_tokens=4000,
        response_format={"type": "json_object"},
    )

    feedback = json.loads(response.choices[0].message.content)
    sessions.pop(session_id, None)
    return JSONResponse(feedback)


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    sessions.pop(session_id, None)
    return {"message": "ok"}


# ── Delete Report ─────────────────────────────────────────────────
@app.delete("/api/report/{report_id}")
async def delete_report(
    report_id: str,
    authorization: str = Header(None),
):
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    jwt = authorization.split(" ", 1)[1]
    try:
        user_resp = supabase_client.auth.get_user(jwt)
        user_id = user_resp.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    try:
        supabase_client.table("interview_reports") \
            .delete() \
            .eq("id", report_id) \
            .eq("user_id", user_id) \
            .execute()
        return {"message": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Rename Report ────────────────────────────────────────────────
class RenameReportRequest(BaseModel):
    name: str

@app.patch("/api/report/{report_id}")
async def rename_report(
    report_id: str,
    body: RenameReportRequest,
    authorization: str = Header(None),
):
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    jwt = authorization.split(" ", 1)[1]
    try:
        user_resp = supabase_client.auth.get_user(jwt)
        user_id = user_resp.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    name = body.name.strip()[:100] or "Interview"
    try:
        supabase_client.table("interview_reports") \
            .update({"name": name}) \
            .eq("id", report_id) \
            .eq("user_id", user_id) \
            .execute()
        return {"message": "renamed", "name": name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Save Report ───────────────────────────────────────────────────
class SaveReportRequest(BaseModel):
    role: str
    experience: str
    interview_type: str
    overall_score: int
    grade: str
    recommendation: str
    summary: str = ""
    strengths: list = []
    improvements: list = []
    question_scores: list = []
    recommendation_reason: str = ""
    gaze_warnings: int = 0

@app.post("/api/save-report")
async def save_report(
    body: SaveReportRequest,
    authorization: str = Header(None),
):
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    jwt = authorization.split(" ", 1)[1]
    try:
        user_resp = supabase_client.auth.get_user(jwt)
        user_id = user_resp.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    try:
        result = supabase_client.table("interview_reports").insert({
            "user_id":              user_id,
            "role":                 body.role,
            "experience":           body.experience,
            "interview_type":       body.interview_type,
            "overall_score":        body.overall_score,
            "grade":                body.grade,
            "recommendation":       body.recommendation,
            "summary":              body.summary,
            "strengths":            body.strengths,
            "improvements":         body.improvements,
            "question_scores":      body.question_scores,
            "recommendation_reason": body.recommendation_reason,
            "gaze_warnings":        body.gaze_warnings,
        }).execute()
        return JSONResponse({"id": result.data[0]["id"]})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
