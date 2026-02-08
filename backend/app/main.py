"""Speare AI — FastAPI backend."""

from __future__ import annotations

import logging
import re
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
    generate_kb_draft_from_gap,
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
KB_ID_PREFIX = "KB-SYN"


def _next_kb_sequence(prefix: str = KB_ID_PREFIX) -> int:
    """Return the next numeric sequence for a KB ID prefix."""
    existing_ids: list[str] = []
    for art in state.get("data", {}).get("Knowledge_Articles", []):
        existing_ids.append(str(art.get("KB_Article_ID", "")))
    for ev in state.get("learning_events", []):
        existing_ids.append(str(ev.get("proposed_kb_id", "")))

    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    max_num = 0
    for kb_id in existing_ids:
        match = pattern.match(kb_id)
        if match:
            try:
                max_num = max(max_num, int(match.group(1)))
            except ValueError:
                continue
    return max_num + 1


def _status_counts(events: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"Pending": 0, "Approved": 0, "Rejected": 0}
    for e in events:
        status = str(e.get("status", "")).lower()
        if status == "approved":
            counts["Approved"] += 1
        elif status == "rejected":
            counts["Rejected"] += 1
        else:
            counts["Pending"] += 1
    return counts


def _upsert_kb_article_record(
    article_id: str,
    title: str,
    body: str,
    tags: str,
    module: str,
    category: str,
    source_type: str,
) -> None:
    """Upsert a KB article into in-memory data and lookup maps."""
    record = {
        "KB_Article_ID": article_id,
        "Title": title,
        "Body": body,
        "Tags": tags,
        "Module": module,
        "Category": category,
        "Source_Type": source_type,
        "Created_At": datetime.now(timezone.utc).isoformat(),
    }

    articles = state["data"].setdefault("Knowledge_Articles", [])
    existing = state["kb_articles"].get(article_id)
    if existing:
        record["Created_At"] = existing.get("Created_At", record["Created_At"])
        for row in articles:
            if row.get("KB_Article_ID") == article_id:
                row.update(record)
                break
        else:
            articles.append(record)
    else:
        articles.append(record)

    state["kb_articles"][article_id] = record


def _append_kb_lineage(article_id: str, sources: list[dict[str, str]]) -> None:
    """Append KB lineage rows, avoiding duplicates."""
    lineage = state["data"].setdefault("KB_Lineage", [])
    existing = {
        (
            row.get("KB_Article_ID", ""),
            row.get("Source_ID", ""),
            row.get("Source_Type", ""),
            row.get("Relationship", ""),
        )
        for row in lineage
    }

    for src in sources:
        src_id = src.get("source_id", "")
        src_type = src.get("source_type", "")
        relationship = src.get("relationship", "")
        key = (article_id, src_id, src_type, relationship)
        if not src_id or key in existing:
            continue
        lineage.append({
            "KB_Article_ID": article_id,
            "Source_ID": src_id,
            "Source_Type": src_type,
            "Relationship": relationship,
        })
        existing.add(key)


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

    tiers = []
    for t in data.get("Tickets", []):
        try:
            tiers.append(float(t["Tier"]))
        except (ValueError, TypeError, KeyError):
            pass
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
        confidence_details=result.get("confidence_details", {}),
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
                label=str(kb_data.get("Title", kb_id)),
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
                label = str(tk.get("Subject", source_id))
                meta = {"status": tk.get("Status", ""), "priority": tk.get("Priority", "")}
            elif source_group == "script":
                sc = state["scripts"].get(source_id, {})
                label = str(sc.get("Script_Title", source_id))
            elif source_group == "conversation":
                conv = state["conversations"].get(source_id, {})
                if not conv:
                    for c in state["data"].get("Conversations", []):
                        if c.get("Conversation_ID") == source_id:
                            conv = c
                            break
                label = str(conv.get("Issue_Summary", source_id))

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
    all_events = state["learning_events"]
    status_counts = _status_counts(all_events)
    events = all_events
    if status:
        events = [e for e in events if e["status"].lower() == status.lower()]

    total = len(events)
    start = (page - 1) * page_size
    return {
        "data": events[start:start + page_size],
        "meta": {"total": total, "page": page, "page_size": page_size, "status_counts": status_counts},
    }


@app.post("/api/learning/generate-draft")
async def generate_draft(req: KBDraftRequest):
    """Generate a KB article draft from a resolved ticket or a reported gap."""
    event = None
    if req.event_id:
        event = next((e for e in state["learning_events"] if e["event_id"] == req.event_id), None)
        if not event:
            raise HTTPException(404, f"Learning event {req.event_id} not found")

    ticket_number = (req.ticket_number or "").strip()
    if not ticket_number and event:
        ticket_number = str(event.get("ticket_number", "")).strip()

    ticket = state["tickets"].get(ticket_number) if ticket_number else None
    conversation = state["conversations"].get(ticket_number) if ticket_number else None
    script_id = ticket.get("Script_ID", "") if ticket else ""
    script = state["scripts"].get(script_id) if script_id else None

    if ticket:
        draft = generate_kb_draft(ticket, conversation, script, state["settings"])
    else:
        question = (req.question or (event.get("source_question") if event else "") or (event.get("detected_gap") if event else "")).strip()
        draft = generate_kb_draft_from_gap(question, state["settings"])

    lineage: list[dict[str, str]] = []
    if ticket_number:
        lineage.append({"source_type": "Ticket", "source_id": ticket_number, "relationship": "CREATED_FROM"})
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
    if not ticket_number and event:
        lineage.append({
            "source_type": "Copilot",
            "source_id": event.get("event_id", ""),
            "relationship": "REPORTED_FROM",
        })

    draft_payload = {
        "title": draft.get("title", ""),
        "body": draft.get("body", ""),
        "tags": draft.get("tags", ""),
        "source_ticket": ticket_number,
        "source_conversation": conversation.get("Conversation_ID", "") if conversation else str(event.get("conversation_id", "")) if event else "",
        "source_script": script_id,
        "lineage": lineage,
    }

    if event:
        event["draft"] = draft_payload
        if draft_payload["title"]:
            event["draft_summary"] = draft_payload["title"]

    return {
        "data": KBDraft(**draft_payload),
        "ticket": ticket,
        "conversation": conversation,
        "script": script,
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

    ticket_number = str(event.get("ticket_number", "")).strip()
    ticket = state["tickets"].get(ticket_number) if ticket_number else None
    draft = event.get("draft", {}) if isinstance(event.get("draft"), dict) else {}

    # Index FIRST — if indexing fails, we don't want to mark as approved
    article_id = None
    if new_status == "Approved":
        if not event.get("proposed_kb_id"):
            event["proposed_kb_id"] = f"{KB_ID_PREFIX}-{_next_kb_sequence():04d}"
        article_id = event.get("proposed_kb_id")

        edited_title = action.edited_title.strip()
        edited_body = action.edited_body.strip()
        title = (
            edited_title
            or draft.get("title")
            or event.get("draft_summary")
            or event.get("detected_gap")
            or f"Knowledge Article {article_id}"
        )
        body = edited_body or draft.get("body", "")
        if not body:
            if ticket:
                body = (
                    f"## Problem\n{ticket.get('Description', '')}\n\n"
                    f"## Resolution\n{ticket.get('Resolution', '')}"
                )
            else:
                body = (
                    f"## Problem\n{event.get('detected_gap', '')}\n\n"
                    f"## Resolution\n{action.reviewer_notes or 'TBD'}"
                )

        tags = draft.get("tags") or (ticket.get("Tags", "") if ticket else "")
        module = ticket.get("Module", "") if ticket else ""
        category = ticket.get("Category", "") if ticket else ""
        source_type = "generated" if ticket else "copilot"
        text = f"{title}\n{body}"

        try:
            state["vector_store"].add_kb_article(
                article_id,
                text,
                {
                    "title": title[:500],
                    "module": module,
                    "category": category,
                    "source_type": source_type,
                    "doc_type": "kb_article",
                },
            )
        except Exception as e:
            logger.error("Failed to index KB article %s: %s", article_id, e)
            raise HTTPException(500, f"Failed to index article: {e}")

        _upsert_kb_article_record(
            article_id=article_id,
            title=title,
            body=body,
            tags=tags,
            module=module,
            category=category,
            source_type=source_type,
        )

        lineage_sources: list[dict[str, str]] = []
        if ticket_number:
            lineage_sources.append({
                "source_type": "Ticket",
                "source_id": ticket_number,
                "relationship": "CREATED_FROM",
            })
        conversation_id = ""
        if draft.get("source_conversation"):
            conversation_id = str(draft.get("source_conversation", ""))
        elif event.get("conversation_id"):
            conversation_id = str(event.get("conversation_id", ""))
        if conversation_id:
            lineage_sources.append({
                "source_type": "Conversation",
                "source_id": conversation_id,
                "relationship": "CREATED_FROM",
            })
        script_id = draft.get("source_script") or (ticket.get("Script_ID", "") if ticket else "")
        if script_id:
            lineage_sources.append({
                "source_type": "Script",
                "source_id": str(script_id),
                "relationship": "REFERENCES",
            })
        if not ticket_number:
            lineage_sources.append({
                "source_type": "Copilot",
                "source_id": event.get("event_id", ""),
                "relationship": "REPORTED_FROM",
            })
        _append_kb_lineage(article_id, lineage_sources)

        event["draft"] = {
            "title": title,
            "body": body,
            "tags": tags,
            "source_ticket": ticket_number,
            "source_conversation": conversation_id,
            "source_script": str(script_id) if script_id else "",
            "lineage": lineage_sources,
        }
        event["draft_summary"] = title

    # Only update status AFTER successful indexing
    event["status"] = new_status
    event["reviewer_role"] = "Human Reviewer"
    event["review_notes"] = action.reviewer_notes
    event["reviewed_at"] = datetime.now(timezone.utc).isoformat()

    return {
        "data": event,
        "message": f"Event {action.event_id} {new_status.lower()}",
        "article_id": article_id,
        "kb_total_after": len(state["data"].get("Knowledge_Articles", [])),
        "confidence_improvement": None,
    }


@app.post("/api/learning/scan-gaps")
async def scan_for_gaps():
    """Run gap detection across all resolved Tier 3 tickets and create new learning events."""
    tickets = state["data"].get("Tickets", [])
    vs = state["vector_store"]

    gaps = detect_gaps(tickets, vs, threshold=state["settings"].similarity_threshold)

    existing_tickets = {e["ticket_number"] for e in state["learning_events"]}
    new_events = []
    next_kb_seq = _next_kb_sequence()
    for gap in gaps:
        if gap["ticket_number"] in existing_tickets:
            continue
        event_id = f"LEARN-AUTO-{len(state['learning_events']) + len(new_events) + 1:04d}"
        proposed_kb_id = f"{KB_ID_PREFIX}-{next_kb_seq:04d}"
        next_kb_seq += 1
        new_event = {
            "event_id": event_id,
            "ticket_number": gap["ticket_number"],
            "conversation_id": state["conversations"].get(gap["ticket_number"], {}).get("Conversation_ID", ""),
            "detected_gap": f"No KB match above {state['settings'].similarity_threshold:.0%} for: {gap['subject'][:100]}",
            "proposed_kb_id": proposed_kb_id,
            "draft_summary": f"Auto-detected gap for: {gap['subject']}",
            "best_kb_score": round(gap.get("best_kb_score", 0), 4),
            "best_kb_match": gap.get("best_kb_match", ""),
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
    conversation_id = payload.get("conversation_id") or payload.get("session_id") or f"COPILOT-{event_id}"
    proposed_kb_id = payload.get("proposed_kb_id") or f"{KB_ID_PREFIX}-{_next_kb_sequence():04d}"
    new_event = {
        "event_id": event_id,
        "ticket_number": "",
        "conversation_id": conversation_id,
        "detected_gap": f"Copilot low confidence ({confidence:.0%}) on: {question[:200]}",
        "proposed_kb_id": proposed_kb_id,
        "draft_summary": f"User question not well covered: {question[:200]}",
        "source_question": question,
        "reported_confidence": confidence,
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
