"""Core business-logic services: RAG, gap detection, KB generation, QA scoring, OWASP."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from openai import OpenAI

from .config import Settings
from .vector_store import VectorStore, COL_KB, COL_SCRIPTS, COL_TICKETS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OWASP / Compliance patterns
# ---------------------------------------------------------------------------

PCI_PATTERNS = [
    re.compile(r"\b(?:\d[ -]*?){13,16}\b"),               # credit card numbers
    re.compile(r"\b\d{3}[ -]?\d{2}[ -]?\d{4}\b"),         # SSN
    re.compile(r"\bcvv\s*[:=]\s*\d{3,4}\b", re.I),        # CVV exposure
]

PII_PATTERNS = [
    re.compile(r"\bpassword\s*[:=]\s*\S+", re.I),
    re.compile(r"\bssn\s*[:=]\s*\S+", re.I),
    re.compile(r"\bsocial\s*security\s*[:=]\s*\S+", re.I),
]


def _call_llm(client: OpenAI, model: str, system: str, user: str, temperature: float = 0.2) -> str:
    """Make an OpenAI chat completion call."""
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=3000,
    )
    return resp.choices[0].message.content or ""


# ---------------------------------------------------------------------------
# RAG Copilot
# ---------------------------------------------------------------------------

COPILOT_SYSTEM = """You are SupportMind AI, an expert support copilot for property management software.
Given the user's question and relevant source documents, provide a clear, accurate answer.

Rules:
- Ground your answer ONLY in the provided sources. Do not hallucinate.
- If the answer requires a backend script, cite the Script_ID and explain what inputs are needed.
- If the answer comes from a KB article, cite the KB_Article_ID.
- If unsure, say so and suggest escalation.
- Be concise and actionable.
- Format your response in clear paragraphs. Use markdown for structure."""


def copilot_answer(
    question: str,
    vector_store: VectorStore,
    settings: Settings,
    include_scripts: bool = True,
    include_kb: bool = True,
    include_tickets: bool = True,
) -> dict[str, Any]:
    """Answer a support question using RAG."""
    collections = []
    if include_kb:
        collections.append(COL_KB)
    if include_scripts:
        collections.append(COL_SCRIPTS)
    if include_tickets:
        collections.append(COL_TICKETS)

    results = vector_store.search(question, collections=collections, top_k=settings.retrieval_top_k)

    if not results:
        return {
            "answer": "I couldn't find relevant information for your question. Please escalate to a Tier 3 engineer.",
            "confidence": 0.0,
            "sources": [],
            "answer_type": "UNKNOWN",
        }

    context_parts = []
    for i, r in enumerate(results, 1):
        context_parts.append(
            f"[Source {i}] ({r['doc_type']}) ID: {r['id']}\n"
            f"Title: {r['title']}\n"
            f"Content: {r['snippet']}\n"
        )
    context = "\n---\n".join(context_parts)

    top_type = results[0]["doc_type"]
    answer_type = {
        "kb_article": "KB",
        "script": "SCRIPT",
        "ticket": "TICKET_RESOLUTION",
    }.get(top_type, "UNKNOWN")

    if not settings.openai_api_key:
        answer = _build_fallback_answer(results)
    else:
        client = OpenAI(api_key=settings.openai_api_key)
        user_prompt = f"Question: {question}\n\nRelevant Sources:\n{context}"
        answer = _call_llm(client, settings.openai_model, COPILOT_SYSTEM, user_prompt)

    return {
        "answer": answer,
        "confidence": round(results[0]["score"], 4),
        "sources": results[:5],
        "answer_type": answer_type,
    }


def _build_fallback_answer(results: list[dict]) -> str:
    """Build a basic answer when no LLM is available."""
    if not results:
        return "No relevant documents found."
    top = results[0]
    return (
        f"**Best match** ({top['doc_type']}): **{top['title']}**\n\n"
        f"ID: `{top['id']}` | Relevance: {top['score']:.0%}\n\n"
        f"{top['snippet'][:1000]}"
    )


# ---------------------------------------------------------------------------
# Knowledge Gap Detection
# ---------------------------------------------------------------------------

def detect_gaps(
    tickets: list[dict],
    vector_store: VectorStore,
    threshold: float = 0.35,
) -> list[dict[str, Any]]:
    """Find resolved Tier 3 tickets with no close KB match."""
    gaps = []
    for tk in tickets:
        if tk.get("Status") != "Closed" or not tk.get("Resolution"):
            continue
        tier = tk.get("Tier", 0)
        if tier and float(tier) < 3:
            continue

        query = f"{tk.get('Subject', '')} {tk.get('Description', '')} {tk.get('Resolution', '')}"
        results = vector_store.search(query[:1000], collections=[COL_KB], top_k=1)

        best_score = results[0]["score"] if results else 0.0
        if best_score < threshold:
            gaps.append({
                "ticket_number": tk["Ticket_Number"],
                "subject": tk.get("Subject", ""),
                "resolution": tk.get("Resolution", ""),
                "best_kb_score": best_score,
                "best_kb_match": results[0]["id"] if results else None,
            })

    return gaps


# ---------------------------------------------------------------------------
# KB Article Generation (Self-Learning)
# ---------------------------------------------------------------------------

KB_GEN_SYSTEM = """You are a knowledge-base author for enterprise property management support.
Given a resolved support ticket with its conversation transcript and script details,
generate a knowledge-base article that captures the resolution for future reuse.

Output JSON with these fields:
{
  "title": "Short descriptive title",
  "body": "Full article body with problem description, steps to resolve, and verification steps. Use markdown formatting.",
  "tags": "comma-separated relevant tags"
}

Rules:
- Be specific and actionable.
- Include the exact steps the agent took.
- Reference the script ID if one was used.
- Replace any real customer names with placeholders.
- Structure: Problem → Cause → Resolution Steps → Verification."""


def generate_kb_draft(
    ticket: dict,
    conversation: dict | None,
    script: dict | None,
    settings: Settings,
) -> dict[str, Any]:
    """Generate a KB article draft from a resolved ticket."""
    user_content = f"Ticket: {ticket.get('Subject', '')}\n"
    user_content += f"Description: {ticket.get('Description', '')}\n"
    user_content += f"Resolution: {ticket.get('Resolution', '')}\n"
    user_content += f"Root Cause: {ticket.get('Root_Cause', '')}\n"
    user_content += f"Module: {ticket.get('Module', '')} / {ticket.get('Category', '')}\n"
    user_content += f"Product: {ticket.get('Product', '')}\n"

    if script:
        user_content += f"\nScript ID: {script.get('Script_ID', '')}\n"
        user_content += f"Script Purpose: {script.get('Script_Purpose', '')}\n"
        user_content += f"Script Inputs: {script.get('Script_Inputs', '')}\n"
        user_content += f"Script Text:\n{script.get('Script_Text_Sanitized', '')[:2000]}\n"

    if conversation:
        user_content += f"\nTranscript:\n{conversation.get('Transcript', '')[:3000]}\n"

    if not settings.openai_api_key:
        return {
            "title": f"Resolution: {ticket.get('Subject', 'Unknown Issue')}",
            "body": f"## Problem\n{ticket.get('Description', '')}\n\n## Resolution\n{ticket.get('Resolution', '')}",
            "tags": ticket.get("Tags", ""),
        }

    client = OpenAI(api_key=settings.openai_api_key)
    raw = _call_llm(client, settings.openai_model, KB_GEN_SYSTEM, user_content)

    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        return {
            "title": f"Resolution: {ticket.get('Subject', 'Unknown Issue')}",
            "body": raw,
            "tags": ticket.get("Tags", ""),
        }


# ---------------------------------------------------------------------------
# QA Scoring
# ---------------------------------------------------------------------------

def score_qa(
    ticket: dict,
    conversation: dict | None,
    qa_rubric: str,
    settings: Settings,
) -> dict[str, Any]:
    """Score a ticket/conversation using the QA rubric."""
    case_info = (
        f"Ticket Number: {ticket.get('Ticket_Number', '')}\n"
        f"Subject: {ticket.get('Subject', '')}\n"
        f"Description: {ticket.get('Description', '')}\n"
        f"Resolution: {ticket.get('Resolution', '')}\n"
        f"Priority: {ticket.get('Priority', '')}\n"
        f"Tier: {ticket.get('Tier', '')}\n"
        f"Category: {ticket.get('Category', '')}\n"
        f"Module: {ticket.get('Module', '')}\n"
        f"Script_ID: {ticket.get('Script_ID', '')}\n"
        f"KB_Article_ID: {ticket.get('KB_Article_ID', '')}\n"
    )

    transcript = ""
    if conversation:
        transcript = conversation.get("Transcript", "")
        case_info += f"\nTranscript:\n{transcript[:4000]}\n"

    eval_mode = "Both" if conversation and transcript else "Case"

    if not settings.openai_api_key:
        return _build_fallback_qa(ticket, eval_mode)

    client = OpenAI(api_key=settings.openai_api_key)
    system = qa_rubric if qa_rubric else "Score this support interaction for quality."
    user_prompt = f"Evaluate this case:\n\n{case_info}"

    raw = _call_llm(client, settings.openai_model_heavy, system, user_prompt, temperature=0.1)

    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        return _build_fallback_qa(ticket, eval_mode, raw_text=raw)


def _build_fallback_qa(ticket: dict, eval_mode: str, raw_text: str = "") -> dict:
    """Return a structured QA result when LLM parsing fails or is unavailable."""
    return {
        "Evaluation_Mode": eval_mode,
        "Interaction_QA": {"Final_Weighted_Score": "N/A"},
        "Case_QA": {"Final_Weighted_Score": "N/A"},
        "Red_Flags": {
            "Account_Documentation_Violation": {"score": "N/A"},
            "Payment_Compliance_PCI_Violation": {"score": "N/A"},
            "Data_Integrity_Confidentiality_Violation": {"score": "N/A"},
            "Misbehavior_Unprofessionalism": {"score": "N/A"},
        },
        "Overall_Weighted_Score": "N/A",
        "Contact_Summary": raw_text[:500] if raw_text else "QA scoring requires an OpenAI API key.",
        "Case_Summary": f"Ticket {ticket.get('Ticket_Number', 'N/A')}: {ticket.get('Subject', 'N/A')}",
        "QA_Recommendation": "Manual review required",
    }


# ---------------------------------------------------------------------------
# OWASP Compliance Checks
# ---------------------------------------------------------------------------

def check_owasp_compliance(text: str) -> dict[str, Any]:
    """Scan text for OWASP-relevant security violations."""
    findings: list[dict[str, str]] = []

    for pattern in PCI_PATTERNS:
        matches = pattern.findall(text)
        if matches:
            findings.append({
                "category": "PCI-DSS Violation",
                "severity": "CRITICAL",
                "description": f"Potential payment card / SSN data found ({len(matches)} match(es))",
                "owasp_ref": "A01:2021 - Broken Access Control",
            })

    for pattern in PII_PATTERNS:
        matches = pattern.findall(text)
        if matches:
            findings.append({
                "category": "PII Exposure",
                "severity": "HIGH",
                "description": f"Potential credentials / PII in plain text ({len(matches)} match(es))",
                "owasp_ref": "A02:2021 - Cryptographic Failures",
            })

    if re.search(r"(ignore|disregard)\s+(previous|above|all)\s+(instructions|rules|prompts)", text, re.I):
        findings.append({
            "category": "Prompt Injection",
            "severity": "HIGH",
            "description": "Potential prompt injection attempt detected",
            "owasp_ref": "LLM01 - Prompt Injection (OWASP Top 10 for LLMs)",
        })

    if re.search(r"<script|javascript:|on\w+\s*=", text, re.I):
        findings.append({
            "category": "XSS Attempt",
            "severity": "MEDIUM",
            "description": "Potential cross-site scripting payload detected",
            "owasp_ref": "A03:2021 - Injection",
        })

    return {
        "compliant": len(findings) == 0,
        "findings": findings,
        "checks_run": [
            "PCI-DSS (card data, SSN)",
            "PII exposure (credentials)",
            "Prompt injection detection",
            "XSS payload detection",
        ],
        "owasp_frameworks": [
            "OWASP Top 10:2021",
            "OWASP Top 10 for LLM Applications",
        ],
    }
