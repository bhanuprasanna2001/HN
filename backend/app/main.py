"""Speare AI — FastAPI backend."""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .data_loader import (
    build_conversation_lookup,
    build_kb_lookup,
    build_script_lookup,
    build_ticket_lookup,
    load_workbook_data,
)
from .models import (
    CopilotQuery,
    CopilotResponse,
    DashboardStats,
    GraphLink,
    GraphNode,
    KBDraft,
    KBDraftRequest,
    KnowledgeGap,
    KnowledgeGraphData,
    QAScoreRequest,
    ReviewAction,
    SourceDocument,
)
from .services import (
    check_owasp_compliance,
    copilot_answer,
    detect_gaps,
    generate_kb_draft,
    score_qa,
)
from .vector_store import VectorStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application state (populated at startup)
# ---------------------------------------------------------------------------
state: dict[str, Any] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load data and build vector index on startup."""
    settings = get_settings()
    logger.info("Starting Speare AI backend")

    data = load_workbook_data(settings.data_path)
    state["data"] = data
    state["settings"] = settings
    state["tickets"] = build_ticket_lookup(data)
    state["conversations"] = build_conversation_lookup(data)
    state["scripts"] = build_script_lookup(data)
    state["kb_articles"] = build_kb_lookup(data)

    # Initialize learning events state
    state["learning_events"] = _init_learning_events(data)

    # Build vector index
    vs = VectorStore(settings.chroma_persist_dir)
    vs.index_kb_articles(data.get("Knowledge_Articles", []))
    vs.index_scripts(data.get("Scripts_Master", []))
    vs.index_tickets(data.get("Tickets", []))
    state["vector_store"] = vs

    logger.info("Backend ready — %d KB articles, %d scripts, %d tickets indexed",
                 len(data.get("Knowledge_Articles", [])),
                 len(data.get("Scripts_Master", [])),
                 len(data.get("Tickets", [])))
    yield
    logger.info("Shutting down Speare AI backend")


def _init_learning_events(data: dict) -> list[dict]:
    """Parse Learning_Events sheet into mutable state."""
    events = []
    for row in data.get("Learning_Events", []):
        eid = row.get("Event_ID", "")
        if not eid:
            continue
        events.append({
            "event_id": eid,
            "ticket_number": row.get("Trigger_Ticket_Number", ""),
            "conversation_id": row.get("Trigger_Conversation_ID", ""),
            "detected_gap": row.get("Detected_Gap", ""),
            "proposed_kb_id": row.get("Proposed_KB_Article_ID", ""),
            "draft_summary": row.get("Draft_Summary", ""),
            "status": row.get("Final_Status", "Pending"),
            "reviewer_role": row.get("Reviewer_Role", ""),
            "timestamp": str(row.get("Event_Timestamp", "")),
        })
    return events


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Speare AI",
    description="Self-learning intelligence layer for customer support",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.get("/api/stats", response_model=DashboardStats)
async def get_stats():
    """Return aggregate dashboard statistics."""
    data = state["data"]
    events = state["learning_events"]

    tiers = [float(t.get("Tier", 0)) for t in data.get("Tickets", []) if t.get("Tier")]
    avg_tier = sum(tiers) / len(tiers) if tiers else 0

    return DashboardStats(
        total_tickets=len(data.get("Tickets", [])),
        total_conversations=len(data.get("Conversations", [])),
        total_kb_articles=len(data.get("Knowledge_Articles", [])),
        total_scripts=len(data.get("Scripts_Master", [])),
        total_gaps_detected=len(events),
        gaps_approved=sum(1 for e in events if e["status"] == "Approved"),
        gaps_rejected=sum(1 for e in events if e["status"] == "Rejected"),
        gaps_pending=sum(1 for e in events if e["status"] == "Pending"),
        avg_resolution_tier=round(avg_tier, 2),
    )


# ---------------------------------------------------------------------------
# Copilot
# ---------------------------------------------------------------------------

@app.post("/api/copilot/ask", response_model=CopilotResponse)
async def ask_copilot(query: CopilotQuery):
    """Answer a support question using RAG over the knowledge base."""
    result = copilot_answer(
        question=query.question,
        vector_store=state["vector_store"],
        settings=state["settings"],
        include_scripts=query.include_scripts,
        include_kb=query.include_kb,
        include_tickets=query.include_tickets,
    )
    return CopilotResponse(
        answer=result["answer"],
        confidence=result["confidence"],
        sources=[SourceDocument(**s) for s in result["sources"]],
        answer_type=result["answer_type"],
    )


# ---------------------------------------------------------------------------
# Knowledge
# ---------------------------------------------------------------------------

@app.get("/api/knowledge/articles")
async def list_kb_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=200),
):
    """List knowledge-base articles with pagination and optional search."""
    articles = state["data"].get("Knowledge_Articles", [])

    if search:
        search_lower = search.lower()
        articles = [
            a for a in articles
            if search_lower in str(a.get("Title", "")).lower()
            or search_lower in str(a.get("KB_Article_ID", "")).lower()
            or search_lower in str(a.get("Module", "")).lower()
            or search_lower in str(a.get("Category", "")).lower()
            or search_lower in str(a.get("Tags", "")).lower()
            or search_lower in str(a.get("Body", ""))[:500].lower()
        ]

    total = len(articles)
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "data": articles[start:end],
        "meta": {"total": total, "page": page, "page_size": page_size},
    }


@app.get("/api/knowledge/graph", response_model=KnowledgeGraphData)
async def get_knowledge_graph(limit: int = Query(300, ge=10, le=500)):
    """Return the knowledge graph data for visualization."""
    lineage = state["data"].get("KB_Lineage", [])
    nodes_map: dict[str, GraphNode] = {}
    links: list[GraphLink] = []

    count = 0
    for row in lineage:
        if count >= limit:
            break

        kb_id = row.get("KB_Article_ID", "")
        source_id = row.get("Source_ID", "")
        source_type = row.get("Source_Type", "")
        relationship = row.get("Relationship", "RELATED")

        if not kb_id or not source_id:
            continue

        # Add KB node
        if kb_id not in nodes_map:
            kb_data = state["kb_articles"].get(kb_id, {})
            nodes_map[kb_id] = GraphNode(
                id=kb_id,
                label=str(kb_data.get("Title", kb_id))[:60],
                group="kb_article",
                metadata={"module": kb_data.get("Module", ""), "category": kb_data.get("Category", "")},
            )

        # Determine source node group
        source_group = "ticket"
        if source_type == "Conversation":
            source_group = "conversation"
        elif source_type == "Script":
            source_group = "script"

        # Add source node
        if source_id not in nodes_map:
            label = source_id
            meta: dict[str, Any] = {}
            if source_group == "ticket":
                tk = state["tickets"].get(source_id, {})
                label = str(tk.get("Subject", source_id))[:60]
                meta = {"status": tk.get("Status", ""), "priority": tk.get("Priority", "")}
            elif source_group == "script":
                sc = state["scripts"].get(source_id, {})
                label = str(sc.get("Script_Title", source_id))[:60]
            elif source_group == "conversation":
                conv = state["conversations"].get(source_id, {})
                if not conv:
                    for c in state["data"].get("Conversations", []):
                        if c.get("Conversation_ID") == source_id:
                            conv = c
                            break
                label = str(conv.get("Issue_Summary", source_id))[:60]

            nodes_map[source_id] = GraphNode(
                id=source_id, label=label, group=source_group, metadata=meta
            )

        links.append(GraphLink(source=kb_id, target=source_id, relationship=relationship))
        count += 1

    return KnowledgeGraphData(nodes=list(nodes_map.values()), links=links)


@app.get("/api/knowledge/articles/{article_id}")
async def get_kb_article(article_id: str):
    """Get a single KB article by ID with its lineage connections."""
    article = state["kb_articles"].get(article_id)
    if not article:
        raise HTTPException(404, f"Article {article_id} not found")

    lineage: list[dict[str, str]] = []
    for row in state["data"].get("KB_Lineage", []):
        if row.get("KB_Article_ID") == article_id:
            lineage.append({
                "source_id": row.get("Source_ID", ""),
                "source_type": row.get("Source_Type", ""),
                "relationship": row.get("Relationship", ""),
            })

    return {"data": {**article, "lineage": lineage}}


# ---------------------------------------------------------------------------
# Learning / Human-in-the-Loop
# ---------------------------------------------------------------------------

@app.get("/api/learning/events")
async def list_learning_events(
    status: str = Query("", max_length=20),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List learning events (knowledge gap detections) with optional status filter."""
    events = state["learning_events"]
    if status:
        events = [e for e in events if e["status"].lower() == status.lower()]

    total = len(events)
    start = (page - 1) * page_size
    return {
        "data": events[start:start + page_size],
        "meta": {"total": total, "page": page, "page_size": page_size},
    }


@app.post("/api/learning/generate-draft")
async def generate_draft(req: KBDraftRequest):
    """Generate a KB article draft from a resolved ticket."""
    ticket = state["tickets"].get(req.ticket_number)
    if not ticket:
        raise HTTPException(404, f"Ticket {req.ticket_number} not found")

    conversation = state["conversations"].get(req.ticket_number)
    script_id = ticket.get("Script_ID", "")
    script = state["scripts"].get(script_id) if script_id else None

    draft = generate_kb_draft(ticket, conversation, script, state["settings"])

    lineage = [
        {"source_type": "Ticket", "source_id": req.ticket_number, "relationship": "CREATED_FROM"},
    ]
    if conversation:
        lineage.append({
            "source_type": "Conversation",
            "source_id": conversation.get("Conversation_ID", ""),
            "relationship": "CREATED_FROM",
        })
    if script:
        lineage.append({
            "source_type": "Script",
            "source_id": script_id,
            "relationship": "REFERENCES",
        })

    return {
        "data": KBDraft(
            title=draft.get("title", ""),
            body=draft.get("body", ""),
            tags=draft.get("tags", ""),
            source_ticket=req.ticket_number,
            source_conversation=conversation.get("Conversation_ID", "") if conversation else "",
            source_script=script_id,
            lineage=lineage,
        )
    }


@app.post("/api/learning/review")
async def review_event(action: ReviewAction):
    """Approve or reject a learning event (human-in-the-loop)."""
    event = next((e for e in state["learning_events"] if e["event_id"] == action.event_id), None)
    if not event:
        raise HTTPException(404, f"Learning event {action.event_id} not found")

    if event["status"] not in ("Pending", "Approved", "Rejected"):
        pass  # Allow re-review

    new_status = "Approved" if action.action == "approve" else "Rejected"
    event["status"] = new_status
    event["reviewer_role"] = "Human Reviewer"
    event["review_notes"] = action.reviewer_notes
    event["reviewed_at"] = datetime.now(timezone.utc).isoformat()

    # If approved, add the new KB article to the vector index
    if new_status == "Approved" and event.get("proposed_kb_id"):
        ticket = state["tickets"].get(event["ticket_number"], {})
        if ticket:
            article_id = event["proposed_kb_id"]
            text = f"{event.get('draft_summary', '')}\n{ticket.get('Resolution', '')}"
            state["vector_store"].add_kb_article(
                article_id,
                text,
                {
                    "title": event.get("draft_summary", "")[:500],
                    "module": ticket.get("Module", ""),
                    "category": ticket.get("Category", ""),
                    "source_type": "generated",
                    "doc_type": "kb_article",
                },
            )

    return {"data": event, "message": f"Event {action.event_id} {new_status.lower()}"}


@app.post("/api/learning/scan-gaps")
async def scan_for_gaps():
    """Run gap detection across all resolved Tier 3 tickets and create new learning events."""
    tickets = state["data"].get("Tickets", [])
    vs = state["vector_store"]

    gaps = detect_gaps(tickets, vs, threshold=state["settings"].similarity_threshold)

    existing_tickets = {e["ticket_number"] for e in state["learning_events"]}
    new_events = []
    for gap in gaps:
        if gap["ticket_number"] in existing_tickets:
            continue
        event_id = f"LEARN-AUTO-{len(state['learning_events']) + len(new_events) + 1:04d}"
        new_event = {
            "event_id": event_id,
            "ticket_number": gap["ticket_number"],
            "conversation_id": state["conversations"].get(gap["ticket_number"], {}).get("Conversation_ID", ""),
            "detected_gap": f"No KB match above {state['settings'].similarity_threshold:.0%} for: {gap['subject'][:100]}",
            "proposed_kb_id": f"KB-AUTO-{len(state['learning_events']) + len(new_events) + 1:04d}",
            "draft_summary": f"Auto-detected gap for: {gap['subject']}",
            "status": "Pending",
            "reviewer_role": "",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        new_events.append(new_event)

    state["learning_events"].extend(new_events)

    return {
        "data": {
            "gaps_scanned": len(tickets),
            "new_gaps_found": len(new_events),
            "total_events": len(state["learning_events"]),
        },
        "message": f"Scan complete: {len(new_events)} new knowledge gaps detected",
    }


@app.post("/api/learning/report-gap")
async def report_gap_from_copilot(payload: dict):
    """Create a learning event when Copilot has low confidence on a question."""
    question = payload.get("question", "")
    confidence = payload.get("confidence", 0)
    if not question:
        raise HTTPException(400, "No question provided")

    event_id = f"LEARN-COPILOT-{len(state['learning_events']) + 1:04d}"
    new_event = {
        "event_id": event_id,
        "ticket_number": "",
        "conversation_id": "",
        "detected_gap": f"Copilot low confidence ({confidence:.0%}) on: {question[:200]}",
        "proposed_kb_id": "",
        "draft_summary": f"User question not well covered: {question[:200]}",
        "status": "Pending",
        "reviewer_role": "",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    state["learning_events"].append(new_event)

    return {"data": new_event, "message": "Gap reported from Copilot"}


# ---------------------------------------------------------------------------
# QA / Compliance
# ---------------------------------------------------------------------------

@app.post("/api/qa/score")
async def qa_score(req: QAScoreRequest):
    """Score a ticket/conversation for quality using the QA rubric."""
    ticket = state["tickets"].get(req.ticket_number)
    if not ticket:
        raise HTTPException(404, f"Ticket {req.ticket_number} not found")

    conversation = state["conversations"].get(req.ticket_number)
    rubric = state["data"].get("_qa_rubric", "")

    qa_result = score_qa(ticket, conversation, rubric, state["settings"])

    # Run OWASP compliance checks
    text_to_scan = f"{ticket.get('Description', '')} {ticket.get('Resolution', '')}"
    if conversation:
        text_to_scan += f" {conversation.get('Transcript', '')}"
    owasp_result = check_owasp_compliance(text_to_scan)

    qa_result["owasp_checks"] = owasp_result
    qa_result["ticket_number"] = req.ticket_number

    return {"data": qa_result}


@app.post("/api/qa/owasp-scan")
async def owasp_scan(payload: dict):
    """Run OWASP compliance checks on arbitrary text."""
    text = payload.get("text", "")
    if not text:
        raise HTTPException(400, "No text provided")
    return {"data": check_owasp_compliance(text)}


# ---------------------------------------------------------------------------
# Tickets / Conversations listing
# ---------------------------------------------------------------------------

@app.get("/api/tickets")
async def list_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query("", max_length=20),
    search: str = Query("", max_length=200),
):
    """List tickets with pagination and optional filters."""
    tickets = state["data"].get("Tickets", [])

    if status:
        tickets = [t for t in tickets if t.get("Status", "").lower() == status.lower()]
    if search:
        sl = search.lower()
        tickets = [
            t for t in tickets
            if sl in str(t.get("Subject", "")).lower()
            or sl in str(t.get("Description", "")).lower()
            or sl in str(t.get("Ticket_Number", "")).lower()
        ]

    total = len(tickets)
    start = (page - 1) * page_size
    return {
        "data": tickets[start:start + page_size],
        "meta": {"total": total, "page": page, "page_size": page_size},
    }


@app.get("/api/tickets/{ticket_number}")
async def get_ticket(ticket_number: str):
    """Get a single ticket with its conversation and related data."""
    ticket = state["tickets"].get(ticket_number)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_number} not found")

    conversation = state["conversations"].get(ticket_number)
    script_id = ticket.get("Script_ID", "")
    script = state["scripts"].get(script_id) if script_id else None
    kb_id = ticket.get("KB_Article_ID", "")
    kb = state["kb_articles"].get(kb_id) if kb_id else None

    return {
        "data": {
            "ticket": ticket,
            "conversation": conversation,
            "script": script,
            "kb_article": kb,
        }
    }


@app.get("/api/conversations")
async def list_conversations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List conversations with pagination."""
    convos = state["data"].get("Conversations", [])
    total = len(convos)
    start = (page - 1) * page_size
    return {
        "data": convos[start:start + page_size],
        "meta": {"total": total, "page": page, "page_size": page_size},
    }
