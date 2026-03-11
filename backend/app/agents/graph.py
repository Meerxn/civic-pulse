"""
LangGraph multi-agent pipeline for CivicPulse.

Graph:  START → router → permit_agent (conditional) → health_agent (conditional) → synthesizer → END

Each node yields SSE events so the frontend can show a live agent activity log.
"""

import json
from typing import AsyncGenerator, TypedDict

from anthropic import AsyncAnthropic
from langgraph.graph import StateGraph, END

from app.rag.retrieval import get_retriever

# ── State ─────────────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    user_query: str
    detected_language: str
    active_agents: list[str]          # which specialist agents to run
    permit_context: str               # retrieved docs for permit agent
    health_context: str               # retrieved docs for health agent
    permit_output: str                # permit agent's step list
    health_output: str                # health agent's step list
    final_roadmap: str                # synthesizer output


# ── Helpers ───────────────────────────────────────────────────────────────────

def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def claude_complete(client: AsyncAnthropic, model: str, system: str, user: str, max_tokens: int = 1500) -> str:
    msg = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return msg.content[0].text


# ── Node Factories ─────────────────────────────────────────────────────────────

def make_router(client: AsyncAnthropic):
    async def router_node(state: AgentState) -> AgentState:
        system = """You are a routing agent for a government service navigation system.
Analyze the user's query and determine:
1. Which specialist agents are needed: "business_permit", "health_safety", or both.
2. The user's language (e.g. "Spanish", "English", "Vietnamese", "Somali").

Respond ONLY with valid JSON, exactly this format:
{
  "agents": ["business_permit", "health_safety"],
  "language": "Spanish"
}

Use "business_permit" for: business licenses, permits, zoning, tax registration, business startup, corporation registration.
Use "health_safety" for: health permits, food safety, inspections, sanitation.
ALWAYS include BOTH for any food-related business: food truck, restaurant, taco shop, bakery, cafe, catering, food cart, deli, food stand, mobile food unit, grocery, bar, brewery, etc.
If unsure, include both."""

        result = await claude_complete(
            client, "claude-haiku-4-5-20251001", system, state["user_query"]
        )

        try:
            parsed = json.loads(result.strip())
            agents = parsed.get("agents", ["business_permit"])
            language = parsed.get("language", "English")
        except Exception:
            agents = ["business_permit"]
            language = "English"

        return {
            **state,
            "active_agents": agents,
            "detected_language": language,
        }

    return router_node


def make_permit_agent(client: AsyncAnthropic):
    async def permit_node(state: AgentState) -> AgentState:
        if "business_permit" not in state["active_agents"]:
            return {**state, "permit_output": "", "permit_context": ""}

        retriever = get_retriever()
        docs = retriever.search(state["user_query"], k=5, category="business_permit")
        context = "\n\n---\n\n".join(
            f"[Source: {d['url']}]\n{d['text']}" for d in docs
        )

        system = """You are a Business Permit Specialist Agent for the City of Seattle.
Using ONLY the provided government documents, create a numbered step-by-step checklist
for the user's business permit and licensing needs.

Rules:
- Be specific (mention form names, fees, office locations when available)
- Include a source URL for each step
- Keep each step concise (1-2 sentences)
- Do NOT translate — respond in English regardless of query language
- If a step is unclear from the documents, say "Contact Seattle OED for details"
- Format: numbered list, plain text (no markdown headers)"""

        user = f"Documents:\n{context}\n\nUser query: {state['user_query']}"
        output = await claude_complete(client, "claude-haiku-4-5-20251001", system, user)

        return {**state, "permit_output": output, "permit_context": context}

    return permit_node


def make_health_agent(client: AsyncAnthropic):
    async def health_node(state: AgentState) -> AgentState:
        if "health_safety" not in state["active_agents"]:
            return {**state, "health_output": "", "health_context": ""}

        retriever = get_retriever()
        docs = retriever.search(state["user_query"], k=5, category="health_safety")
        context = "\n\n---\n\n".join(
            f"[Source: {d['url']}]\n{d['text']}" for d in docs
        )

        system = """You are a Health & Safety Permit Specialist Agent for King County Public Health.
Using ONLY the provided government documents, create a numbered step-by-step checklist
for the user's health and food safety permit requirements.

Rules:
- Be specific (mention inspection requirements, permit types, fees when available)
- Include a source URL for each step
- Keep each step concise (1-2 sentences)
- Do NOT translate — respond in English
- If a step is unclear from the documents, say "Contact King County Public Health for details"
- Format: numbered list, plain text"""

        user = f"Documents:\n{context}\n\nUser query: {state['user_query']}"
        output = await claude_complete(client, "claude-haiku-4-5-20251001", system, user)

        return {**state, "health_output": output, "health_context": context}

    return health_node


def make_synthesizer(client: AsyncAnthropic):
    async def synthesizer_node(state: AgentState) -> AgentState:
        sections = []
        if state.get("permit_output"):
            sections.append(f"BUSINESS & PERMIT STEPS:\n{state['permit_output']}")
        if state.get("health_output"):
            sections.append(f"HEALTH & SAFETY STEPS:\n{state['health_output']}")

        combined = "\n\n".join(sections) if sections else "No specific steps found."
        language = state.get("detected_language", "English")

        lang_instruction = (
            f"All text values in the JSON must be in {language}."
            if language != "English"
            else "All text values in English."
        )

        system = f"""You are the CivicPulse Synthesizer. Output ONLY valid JSON — no markdown, no preamble, no explanation.

{lang_instruction}

Organize steps into logical phases (2-4 phases). Typical order:
"Business Formation" → "Licenses & Permits" → "Health & Safety" → "Launch Preparation"
Only include phases with relevant steps from agent outputs.

JSON schema (output exactly this, no extra fields):
{{
  "title": "Concise roadmap title e.g. 'Food Truck Roadmap – Seattle'",
  "intro": "1-2 sentences in {language} acknowledging the goal and setting expectations",
  "phases": [
    {{
      "phase": 1,
      "title": "Phase title in {language}",
      "summary": "One sentence describing what this phase accomplishes",
      "steps": [
        {{
          "title": "Action-oriented step title in {language} (start with a verb)",
          "description": "2-3 specific sentences: what to do, where, expected timeline or cost if known. No filler.",
          "source_url": "https://real-official-url",
          "source_label": "domain/path e.g. 'seattle.gov/licenses'",
          "document": {{
            "name": "Official form or application name if one exists, else null",
            "agency": "Issuing agency name",
            "how": "online | in-person | mail",
            "fee": "fee amount or range if known, else null"
          }}
        }}
      ]
    }}
  ],
  "closing": "One encouraging closing sentence in {language}"
}}

Rules:
- All title/description/summary/closing values in {language}
- 2–5 steps per phase
- source_url must come from the agent outputs
- document.name should be the real form name (e.g. "Certificate of Formation", "Seattle Business License Application") — set to null if no specific form
- Be specific: fees, addresses, estimated processing time when available"""

        user = f"User's goal: {state['user_query']}\n\nAgent outputs:\n{combined}"
        raw = await claude_complete(client, "claude-sonnet-4-6", system, user, max_tokens=4000)

        # Strip markdown code fences (handles ```json, ```JSON, ``` etc.)
        raw = raw.strip()
        if raw.startswith("```"):
            lines = raw.split("\n")
            # Drop first line (```json) and last line (```)
            inner = lines[1:]
            if inner and inner[-1].strip() == "```":
                inner = inner[:-1]
            raw = "\n".join(inner).strip()

        # Find the outermost JSON object in case of any leading text
        start = raw.find("{")
        end   = raw.rfind("}")
        if start != -1 and end != -1:
            raw = raw[start : end + 1]

        return {**state, "final_roadmap": raw}

    return synthesizer_node


# ── Graph Builder ─────────────────────────────────────────────────────────────

def build_graph(client: AsyncAnthropic):
    g = StateGraph(AgentState)
    g.add_node("router", make_router(client))
    g.add_node("permit_agent", make_permit_agent(client))
    g.add_node("health_agent", make_health_agent(client))
    g.add_node("synthesizer", make_synthesizer(client))

    g.set_entry_point("router")
    g.add_edge("router", "permit_agent")
    g.add_edge("permit_agent", "health_agent")
    g.add_edge("health_agent", "synthesizer")
    g.add_edge("synthesizer", END)

    return g.compile()


# ── Streaming Runner ───────────────────────────────────────────────────────────

async def run_pipeline(query: str, client: AsyncAnthropic) -> AsyncGenerator[str, None]:
    """Run the full pipeline and yield SSE strings for frontend consumption."""
    graph = build_graph(client)

    initial_state: AgentState = {
        "user_query": query,
        "detected_language": "English",
        "active_agents": [],
        "permit_context": "",
        "health_context": "",
        "permit_output": "",
        "health_output": "",
        "final_roadmap": "",
    }

    # Yield agent status events as each node completes
    agent_display = {
        "router": "Router Agent",
        "permit_agent": "Business Permit Agent",
        "health_agent": "Health & Safety Agent",
        "synthesizer": "Synthesizer Agent",
    }

    yield sse("agent_start", {"agent": "Router Agent", "message": "Analyzing your request..."})

    state = initial_state
    node_order = ["router", "permit_agent", "health_agent", "synthesizer"]

    for node_name in node_order:
        display_name = agent_display[node_name]

        if node_name == "router":
            node_fn = make_router(client)
        elif node_name == "permit_agent":
            node_fn = make_permit_agent(client)
            if "business_permit" not in state.get("active_agents", []):
                yield sse("agent_skip", {"agent": display_name})
                state = await node_fn(state)
                continue
        elif node_name == "health_agent":
            node_fn = make_health_agent(client)
            if "health_safety" not in state.get("active_agents", []):
                yield sse("agent_skip", {"agent": display_name})
                state = await node_fn(state)
                continue
        else:
            node_fn = make_synthesizer(client)

        yield sse("agent_start", {"agent": display_name, "message": f"{display_name} working..."})
        state = await node_fn(state)

        if node_name == "router":
            agents_used = state.get("active_agents", [])
            lang = state.get("detected_language", "English")
            yield sse("agent_done", {
                "agent": display_name,
                "message": f"Detected language: {lang} | Routing to: {', '.join(agents_used)}",
            })
        elif node_name == "synthesizer":
            yield sse("agent_done", {"agent": display_name, "message": "Roadmap ready!"})
        else:
            yield sse("agent_done", {"agent": display_name, "message": "Steps compiled ✓"})

    raw_roadmap = state["final_roadmap"]
    # Try to parse as JSON; fall back to plain text
    try:
        roadmap_data = json.loads(raw_roadmap)
        yield sse("result", {
            "roadmap_json": roadmap_data,
            "language": state["detected_language"],
            "agents_used": state["active_agents"],
        })
    except Exception:
        yield sse("result", {
            "roadmap_text": raw_roadmap,
            "language": state["detected_language"],
            "agents_used": state["active_agents"],
        })
    yield sse("done", {})
