import os
import io
import json
from dotenv import load_dotenv

load_dotenv()

import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from anthropic import AsyncAnthropic

from app.agents.graph import run_pipeline
from app.rag.retrieval import get_retriever

load_dotenv()

app = FastAPI(title="CivicPulse API", version="1.0.0")

# Allow frontend origins (Netlify + local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.netlify.app",
        "https://civicpulse.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


class ChatRequest(BaseModel):
    query: str

class PrefillRequest(BaseModel):
    form_name: str
    agency: str
    user_context: str   # the original user query
    language: str = "English"

class PrefillPDFRequest(BaseModel):
    form_name: str
    agency: str
    user_answers: dict   # {question_id: value} from the intake form
    user_context: str
    language: str = "English"


@app.on_event("startup")
async def startup():
    # Pre-load FAISS index so first request isn't slow
    try:
        get_retriever()
    except Exception as e:
        print(f"Warning: Could not load RAG index at startup: {e}")
        print("Run 'python -m app.rag.scraper && python -m app.rag.build_index' first.")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "CivicPulse API"}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    async def event_stream():
        async for chunk in run_pipeline(req.query.strip(), client):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/prefill")
async def prefill(req: PrefillRequest):
    """Generate pre-filled form field suggestions for a given government form."""
    lang_note = f"Respond in {req.language}." if req.language != "English" else "Respond in English."

    system = f"""You are a government form assistant. Given a form name and user context, generate helpful pre-fill suggestions for each key field.
{lang_note}

Output ONLY valid JSON, no markdown:
{{
  "form_name": "exact form name",
  "agency": "agency name",
  "disclaimer": "One sentence reminding user these are suggestions only and they should verify with the official agency.",
  "fields": [
    {{
      "field": "Field name as it appears on the form",
      "suggestion": "What to write based on the user's context",
      "note": "Short helpful tip about this field (optional, null if not needed)"
    }}
  ]
}}

Include 5-10 of the most important fields for this form. Base suggestions on the user's context.
If a field requires specific info you don't have (like SSN or EIN), say what type of info is needed."""

    user = f"Form: {req.form_name}\nAgency: {req.agency}\nUser's goal: {req.user_context}"

    msg = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1200,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    raw = msg.content[0].text.strip()

    # Strip code fences
    if raw.startswith("```"):
        lines = raw.split("\n")
        inner = lines[1:]
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        raw = "\n".join(inner).strip()

    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end + 1]

    try:
        return json.loads(raw)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to generate form suggestions")


class PrefillQuestionsRequest(BaseModel):
    form_name: str
    agency: str
    user_context: str
    language: str = "English"


@app.post("/api/prefill/questions")
async def prefill_questions(req: PrefillQuestionsRequest):
    """Return the specific intake questions needed for this government form."""
    lang_note = f"Labels should be in {req.language}." if req.language != "English" else ""

    system = f"""You are a government form expert. Given a specific government form and agency, return exactly the personal information questions needed to fill that form.

{lang_note}

Output ONLY valid JSON:
{{
  "questions": [
    {{
      "id": "snake_case_id",
      "label": "Human-readable field label",
      "placeholder": "Example answer",
      "type": "text | email | tel | date | number"
    }}
  ]
}}

Rules:
- Include 5-9 questions tailored to THIS specific form (not generic)
- For a business license: ask about business name, owner, address, business type, start date
- For a health/food permit: ask about facility address, food types, seating capacity, commissary
- For LLC formation: ask about LLC name, registered agent, member names, business purpose
- For a street use / vehicle permit: ask about vehicle type, operating location, schedule
- Always include full name and contact info
- Do NOT include fields that require official documents (SSN, EIN) - just note those in placeholder
- Keep labels concise and clear"""

    user = f"Form: {req.form_name}\nAgency: {req.agency}\nUser's goal: {req.user_context}"

    msg = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    raw = msg.content[0].text.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        inner = lines[1:]
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        raw = "\n".join(inner).strip()
    s, e = raw.find("{"), raw.rfind("}")
    if s != -1 and e != -1:
        raw = raw[s:e + 1]
    try:
        return json.loads(raw)
    except Exception:
        # Fallback: generic questions
        return {"questions": [
            {"id": "full_name",     "label": "Full Legal Name",   "placeholder": "e.g. Maria Garcia",        "type": "text"},
            {"id": "address",       "label": "Address",            "placeholder": "e.g. 1234 Main St, Seattle", "type": "text"},
            {"id": "email",         "label": "Email",              "placeholder": "e.g. maria@email.com",     "type": "email"},
            {"id": "phone",         "label": "Phone",              "placeholder": "e.g. (206) 555-0123",      "type": "tel"},
            {"id": "business_name", "label": "Business Name",      "placeholder": "e.g. Maria's Food Truck",  "type": "text"},
        ]}


@app.post("/api/prefill/pdf")
async def prefill_pdf(req: PrefillPDFRequest):
    """Generate a filled PDF form summary from user-provided answers."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib.colors import HexColor, white, black
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.enums import TA_LEFT, TA_CENTER

    lang_note = f"Respond in {req.language}." if req.language != "English" else ""

    # Ask Claude to fill in remaining fields based on user answers + context
    answers_text = "\n".join(f"- {k}: {v}" for k, v in req.user_answers.items() if v.strip())
    system = f"""You are a government form assistant. The user has provided their personal information.
Generate completed field suggestions for the remaining fields on this government form.
{lang_note}

Output ONLY valid JSON:
{{
  "disclaimer": "One sentence: these are AI-generated suggestions, verify with the official agency.",
  "fields": [
    {{"field": "Field name on the form", "value": "What to write", "note": "Optional tip or null"}}
  ]
}}

Include 6-10 key fields. Use the user's provided answers wherever relevant.
For unknown fields (SSN, EIN, etc.) explain what is needed."""

    user = f"Form: {req.form_name}\nAgency: {req.agency}\nUser goal: {req.user_context}\n\nUser provided:\n{answers_text}"

    msg = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1200,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    raw = msg.content[0].text.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        inner = lines[1:]
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        raw = "\n".join(inner).strip()
    s, e = raw.find("{"), raw.rfind("}")
    if s != -1 and e != -1:
        raw = raw[s:e + 1]
    try:
        ai_data = json.loads(raw)
    except Exception:
        ai_data = {"disclaimer": "Please verify all information with the official agency.", "fields": []}

    # ── Build PDF ──────────────────────────────────────────────────────────────
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
    )

    BLUE   = HexColor("#1D4ED8")
    LBLUE  = HexColor("#EFF6FF")
    AMBER  = HexColor("#FEF3C7")
    GRAY   = HexColor("#6B7280")
    LGRAY  = HexColor("#F9FAFB")
    BORDER = HexColor("#E5E7EB")

    styles = getSampleStyleSheet()
    title_style   = ParagraphStyle("cp_title",   parent=styles["Normal"], fontSize=18, textColor=BLUE,  fontName="Helvetica-Bold", spaceAfter=2)
    sub_style     = ParagraphStyle("cp_sub",     parent=styles["Normal"], fontSize=10, textColor=GRAY,  fontName="Helvetica",      spaceAfter=2)
    label_style   = ParagraphStyle("cp_label",   parent=styles["Normal"], fontSize=8,  textColor=GRAY,  fontName="Helvetica-Bold", spaceAfter=1)
    value_style   = ParagraphStyle("cp_value",   parent=styles["Normal"], fontSize=10, textColor=black, fontName="Helvetica",      spaceAfter=1)
    note_style    = ParagraphStyle("cp_note",    parent=styles["Normal"], fontSize=8,  textColor=GRAY,  fontName="Helvetica-Oblique")
    section_style = ParagraphStyle("cp_section", parent=styles["Normal"], fontSize=11, textColor=BLUE,  fontName="Helvetica-Bold", spaceBefore=12, spaceAfter=6)
    disc_style    = ParagraphStyle("cp_disc",    parent=styles["Normal"], fontSize=8,  textColor=HexColor("#92400E"), fontName="Helvetica", leading=12)

    story = []

    # Header
    story.append(Paragraph("CivicPulse", title_style))
    story.append(Paragraph("AI-Assisted Form Summary · Seattle City Navigator", sub_style))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    story.append(Spacer(1, 8))

    # Form info
    story.append(Paragraph(req.form_name, ParagraphStyle("fn", parent=styles["Normal"], fontSize=14, fontName="Helvetica-Bold", spaceAfter=2)))
    story.append(Paragraph(req.agency, sub_style))
    story.append(Spacer(1, 12))

    # Disclaimer
    disc_table = Table(
        [[Paragraph(f"⚠ {ai_data.get('disclaimer', 'Verify all information with the official agency before submitting.')}", disc_style)]],
        colWidths=[6.5 * inch],
    )
    disc_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AMBER),
        ("BOX",        (0, 0), (-1, -1), 0.5, HexColor("#D97706")),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [4]),
    ]))
    story.append(disc_table)
    story.append(Spacer(1, 14))

    # ── Section 1: Your Information ──
    story.append(Paragraph("Your Information", section_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 6))

    user_rows = [[
        Paragraph(k.replace("_", " ").title(), label_style),
        Paragraph(v if v.strip() else "—", value_style),
    ] for k, v in req.user_answers.items()]

    if user_rows:
        user_table = Table(user_rows, colWidths=[2.0 * inch, 4.5 * inch])
        user_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (0, -1), LGRAY),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("LINEBELOW",     (0, 0), (-1, -2), 0.5, BORDER),
            ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
        ]))
        story.append(user_table)

    # ── Section 2: AI-Suggested Fields ──
    story.append(Spacer(1, 14))
    story.append(Paragraph("AI-Suggested Field Values", section_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 6))

    for field in ai_data.get("fields", []):
        rows = [
            [Paragraph(field.get("field", ""), label_style), Paragraph(field.get("value", ""), value_style)],
        ]
        if field.get("note"):
            rows.append(["", Paragraph(field["note"], note_style)])
        t = Table(rows, colWidths=[2.0 * inch, 4.5 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (0, 0), LGRAY),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
        ]))
        story.append(t)
        story.append(Spacer(1, 4))

    # Footer
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Generated by CivicPulse · civicpulse.netlify.app · Always verify with official government sources before submitting.",
        ParagraphStyle("footer", parent=styles["Normal"], fontSize=7, textColor=GRAY, alignment=TA_CENTER),
    ))

    doc.build(story)
    buffer.seek(0)

    safe_name = req.form_name.replace(" ", "_").replace("/", "-")[:50]
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_prefilled.pdf"'},
    )
