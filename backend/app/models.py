"""Pydantic schemas for API requests and responses."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Copilot
# ---------------------------------------------------------------------------

class CopilotQuery(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    include_scripts: bool = True
    include_kb: bool = True
    include_tickets: bool = True


class SourceDocument(BaseModel):
    id: str
    doc_type: str  # "kb_article" | "script" | "ticket"
    title: str
    snippet: str
    score: float
    metadata: dict[str, Any] = {}


class ConfidenceDetails(BaseModel):
    method: str = "cosine_similarity"
    threshold: float = 0.35
    top_match_score: float = 0.0
    sources_searched: int = 0
    is_below_threshold: bool = False


class CopilotResponse(BaseModel):
    answer: str
    confidence: float
    sources: list[SourceDocument]
    answer_type: str  # "SCRIPT" | "KB" | "TICKET_RESOLUTION" | "UNKNOWN"
    confidence_details: ConfidenceDetails | dict = {}


# ---------------------------------------------------------------------------
# Knowledge
# ---------------------------------------------------------------------------

class KBArticle(BaseModel):
    id: str
    title: str
    body: str
    tags: str = ""
    module: str = ""
    category: str = ""
    source_type: str = ""
    status: str = ""
    created_at: str = ""


class Script(BaseModel):
    id: str
    title: str
    purpose: str
    inputs: str = ""
    module: str = ""
    category: str = ""
    text: str = ""


# ---------------------------------------------------------------------------
# Knowledge Graph
# ---------------------------------------------------------------------------

class GraphNode(BaseModel):
    id: str
    label: str
    group: str  # "kb_article" | "script" | "ticket" | "conversation"
    metadata: dict[str, Any] = {}


class GraphLink(BaseModel):
    source: str
    target: str
    relationship: str


class KnowledgeGraphData(BaseModel):
    nodes: list[GraphNode]
    links: list[GraphLink]


# ---------------------------------------------------------------------------
# Learning / Human-in-the-Loop
# ---------------------------------------------------------------------------

class KnowledgeGap(BaseModel):
    event_id: str
    ticket_number: str
    conversation_id: str
    detected_gap: str
    proposed_kb_id: str
    draft_summary: str
    status: str  # "Pending" | "Approved" | "Rejected"
    reviewer_role: str = ""
    timestamp: str = ""


class ReviewAction(BaseModel):
    event_id: str
    action: str = Field(..., pattern="^(approve|reject)$")
    reviewer_notes: str = ""


class KBDraftRequest(BaseModel):
    ticket_number: str


class KBDraft(BaseModel):
    title: str
    body: str
    tags: str
    source_ticket: str
    source_conversation: str
    source_script: str
    lineage: list[dict[str, str]]


# ---------------------------------------------------------------------------
# QA / OWASP Compliance
# ---------------------------------------------------------------------------

class QAScoreRequest(BaseModel):
    ticket_number: str


class QACategory(BaseModel):
    score: str  # "Yes" | "No" | "N/A"
    tracking_items: list[str] = []
    evidence: str = ""


class QARedFlag(BaseModel):
    score: str  # "Yes" | "No" | "N/A"
    tracking_items: list[str] = []
    evidence: str = ""


class QAScoreResponse(BaseModel):
    ticket_number: str
    evaluation_mode: str
    interaction_qa: dict[str, Any] = {}
    case_qa: dict[str, Any] = {}
    red_flags: dict[str, Any] = {}
    owasp_checks: dict[str, Any] = {}
    overall_score: str = ""
    contact_summary: str = ""
    case_summary: str = ""
    qa_recommendation: str = ""


# ---------------------------------------------------------------------------
# Dashboard Stats
# ---------------------------------------------------------------------------

class DashboardStats(BaseModel):
    total_tickets: int
    total_conversations: int
    total_kb_articles: int
    total_scripts: int
    total_gaps_detected: int
    gaps_approved: int
    gaps_rejected: int
    gaps_pending: int
    avg_resolution_tier: float


# ---------------------------------------------------------------------------
# Tickets / Conversations (for listing)
# ---------------------------------------------------------------------------

class TicketSummary(BaseModel):
    ticket_number: str
    subject: str
    status: str
    priority: str
    tier: int | None = None
    product: str = ""
    category: str = ""
    created_at: str = ""


class ConversationSummary(BaseModel):
    conversation_id: str
    ticket_number: str
    channel: str
    agent_name: str = ""
    issue_summary: str = ""
    sentiment: str = ""
