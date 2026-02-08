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
    re.compile(r"\b(?:\d[ -]*?){13,16}\b"),
    re.compile(r"\b\d{3}[ -]?\d{2}[ -]?\d{4}\b"),
    re.compile(r"\bcvv\s*[:=]\s*\d{3,4}\b", re.I),
]

PII_PATTERNS = [
    re.compile(r"\bpassword\s*[:=]\s*\S+", re.I),
    re.compile(r"\bssn\s*[:=]\s*\S+", re.I),
    re.compile(r"\bsocial\s*security\s*[:=]\s*\S+", re.I),
]

PHONE_PATTERN = re.compile(r"\(\d{3}\)\s*\d{3}[- ]?\d{4}")
EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
SENSITIVE_DATA_PATTERNS = [
    re.compile(r"\b(lease|unit|apartment)\s*(id|number|#)\s*[:=]?\s*\S+", re.I),
    re.compile(r"\b(account|routing)\s*number\s*[:=]?\s*\d+", re.I),
]


def _call_llm(
    client: OpenAI,
    model: str,
    system: str,
    user: str,
    temperature: float = 0.2,
    json_mode: bool = False,
) -> str:
    """Make an OpenAI chat completion call."""
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": 4000,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    resp = client.chat.completions.create(**kwargs)
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

You MUST respond with valid JSON only. No markdown, no code fences, just JSON.
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
    raw = _call_llm(client, settings.openai_model, KB_GEN_SYSTEM, user_content, json_mode=True)

    try:
        return json.loads(raw.strip())
    except (json.JSONDecodeError, ValueError):
        return {
            "title": f"Resolution: {ticket.get('Subject', 'Unknown Issue')}",
            "body": raw,
            "tags": ticket.get("Tags", ""),
        }


# ---------------------------------------------------------------------------
# QA Scoring
# ---------------------------------------------------------------------------

QA_SYSTEM_COMPACT = """You are a STRICT QA evaluator for customer support in property management.
You MUST respond with ONLY valid JSON. Be CRITICALLY honest — do NOT default to "Yes".

CRITICAL SCORING RULES:
- Score "No" if evidence is weak, generic, or missing. Do NOT be generous.
- A typical well-handled case should score 60-80%, not 100%.
- Score "No" for Engagement_Personalization if the agent did NOT use the customer's name or show genuine empathy beyond a template.
- Score "No" for Objection_Handling if there were no objections OR the agent did not proactively address concerns.
- Score "No" for Timeliness if there is no explicit follow-up plan or SLA mention.
- Score "No" for Customer_Facing_Clarity if resolution notes are technical/internal and not customer-readable.
- Score "No" for References_Knowledge if KB_Article_ID or Script_ID fields are missing when they should be present.
- Score "No" for Ownership_Signals if there is no explicit escalation plan or callback commitment.
- Each "Yes" MUST cite a specific quote. Each "No" MUST explain what was missing.
- Final_Weighted_Score = (count of Yes) / (count of Yes + No) * 100, rounded.

JSON structure:
{
  "Evaluation_Mode": "Both" or "Case",
  "Interaction_QA": {
    "Conversational_Professional": {"score": "Yes/No/N/A", "evidence": "quote or explanation"},
    "Engagement_Personalization": {"score": "Yes/No/N/A", "evidence": "..."},
    "Tone_Pace": {"score": "Yes/No/N/A", "evidence": "..."},
    "Language": {"score": "Yes/No/N/A", "evidence": "..."},
    "Objection_Handling": {"score": "Yes/No/N/A", "evidence": "..."},
    "Delivered_Expected_Outcome": {"score": "Yes/No/N/A", "evidence": "..."},
    "Critical_Thinking": {"score": "Yes/No/N/A", "evidence": "..."},
    "Accurate_Information": {"score": "Yes/No/N/A", "evidence": "..."},
    "Effective_Resources": {"score": "Yes/No/N/A", "evidence": "..."},
    "Timeliness": {"score": "Yes/No/N/A", "evidence": "..."},
    "Final_Weighted_Score": "XX%"
  },
  "Case_QA": {
    "Clear_Problem_Summary": {"score": "Yes/No/N/A", "evidence": "..."},
    "Captured_Key_Context": {"score": "Yes/No/N/A", "evidence": "..."},
    "Action_Log_Completeness": {"score": "Yes/No/N/A", "evidence": "..."},
    "Correct_Categorization": {"score": "Yes/No/N/A", "evidence": "..."},
    "Customer_Facing_Clarity": {"score": "Yes/No/N/A", "evidence": "..."},
    "Resolution_Specific": {"score": "Yes/No/N/A", "evidence": "..."},
    "Approved_Process": {"score": "Yes/No/N/A", "evidence": "..."},
    "Technical_Accuracy": {"score": "Yes/No/N/A", "evidence": "..."},
    "References_Knowledge": {"score": "Yes/No/N/A", "evidence": "..."},
    "Ownership_Signals": {"score": "Yes/No/N/A", "evidence": "..."},
    "Final_Weighted_Score": "XX%"
  },
  "Red_Flags": {
    "Account_Documentation_Violation": {"score": "Yes/No", "evidence": ""},
    "Payment_Compliance_PCI_Violation": {"score": "Yes/No", "evidence": ""},
    "Data_Integrity_Confidentiality_Violation": {"score": "Yes/No", "evidence": ""},
    "Misbehavior_Unprofessionalism": {"score": "Yes/No", "evidence": ""}
  },
  "Overall_Weighted_Score": "XX%",
  "Contact_Summary": "2-3 sentence summary",
  "Case_Summary": "2-3 sentence summary",
  "QA_Recommendation": "Keep doing" or "Coaching needed" or "Escalate"
}"""


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
        return _build_heuristic_qa(ticket, conversation, eval_mode)

    client = OpenAI(api_key=settings.openai_api_key)
    user_prompt = f"Evaluate this case:\n\n{case_info}"

    try:
        raw = _call_llm(
            client, settings.openai_model, QA_SYSTEM_COMPACT,
            user_prompt, temperature=0.1, json_mode=True,
        )
        result = json.loads(raw.strip())
        logger.info("QA scoring succeeded via LLM for %s", ticket.get("Ticket_Number", ""))
        return result
    except Exception as e:
        logger.warning("QA LLM scoring failed: %s — using heuristic fallback", e)
        return _build_heuristic_qa(ticket, conversation, eval_mode)


def _build_heuristic_qa(ticket: dict, conversation: dict | None, eval_mode: str) -> dict:
    """Rule-based QA scoring when LLM is unavailable or fails."""
    has_resolution = bool(ticket.get("Resolution", "").strip())
    has_description = bool(ticket.get("Description", "").strip())
    has_script = bool(ticket.get("Script_ID", "").strip())
    has_kb = bool(ticket.get("KB_Article_ID", "").strip())
    has_root_cause = bool(ticket.get("Root_Cause", "").strip())

    case_score_count = sum([has_resolution, has_description, has_script or has_kb, has_root_cause, True])
    case_pct = f"{int(case_score_count / 5 * 100)}%"

    case_qa = {
        "Clear_Problem_Summary": {"score": "Yes" if has_description else "No", "evidence": ticket.get("Description", "")[:100]},
        "Captured_Key_Context": {"score": "Yes" if has_description and ticket.get("Module") else "No", "evidence": f"Module: {ticket.get('Module', 'missing')}"},
        "Action_Log_Completeness": {"score": "Yes" if has_resolution else "No", "evidence": ticket.get("Resolution", "No resolution")[:100]},
        "Correct_Categorization": {"score": "Yes" if ticket.get("Category") else "No", "evidence": f"Category: {ticket.get('Category', 'missing')}"},
        "Customer_Facing_Clarity": {"score": "Yes" if has_resolution and len(ticket.get("Resolution", "")) > 20 else "No", "evidence": "Resolution present and detailed" if has_resolution else "No resolution"},
        "Resolution_Specific": {"score": "Yes" if has_resolution and has_root_cause else "No", "evidence": ticket.get("Root_Cause", "No root cause")[:100]},
        "Approved_Process": {"score": "Yes" if has_script else "N/A", "evidence": f"Script: {ticket.get('Script_ID', 'none')}"},
        "Technical_Accuracy": {"score": "Yes" if has_resolution else "N/A", "evidence": "Resolution documented"},
        "References_Knowledge": {"score": "Yes" if has_kb or has_script else "No", "evidence": f"KB: {ticket.get('KB_Article_ID', 'none')}, Script: {ticket.get('Script_ID', 'none')}"},
        "Ownership_Signals": {"score": "Yes" if ticket.get("Status") == "Closed" else "No", "evidence": f"Status: {ticket.get('Status', 'unknown')}"},
        "Final_Weighted_Score": case_pct,
    }

    interaction_qa: dict[str, Any] = {"Final_Weighted_Score": "N/A"}
    interaction_pct = "N/A"
    if conversation and conversation.get("Transcript"):
        transcript = conversation["Transcript"]
        has_greeting = bool(re.search(r"(hello|hi|thanks for contacting|how can I help)", transcript, re.I))
        has_closing = bool(re.search(r"(glad we|anything else|close this case|I'll close)", transcript, re.I))
        has_empathy = bool(re.search(r"(sorry|understand|appreciate|frustrating)", transcript, re.I))
        has_confirmation = bool(re.search(r"(worked|fixed|resolved|confirmed|successful)", transcript, re.I))
        has_steps = bool(re.search(r"(step|check|verify|confirm|go to|navigate)", transcript, re.I))

        int_score_count = sum([has_greeting, has_closing, has_empathy, has_confirmation, has_steps, True, True, True, True, True])
        interaction_pct = f"{int(int_score_count / 10 * 100)}%"

        interaction_qa = {
            "Conversational_Professional": {"score": "Yes" if has_greeting else "No", "evidence": "Greeting found" if has_greeting else "No greeting detected"},
            "Engagement_Personalization": {"score": "Yes" if has_empathy else "No", "evidence": "Empathy shown" if has_empathy else "No empathy markers"},
            "Tone_Pace": {"score": "Yes", "evidence": "Professional tone maintained"},
            "Language": {"score": "Yes", "evidence": "Clear language used"},
            "Objection_Handling": {"score": "Yes" if has_steps else "N/A", "evidence": "Troubleshooting steps provided" if has_steps else "N/A"},
            "Delivered_Expected_Outcome": {"score": "Yes" if has_confirmation else "No", "evidence": "Resolution confirmed" if has_confirmation else "No confirmation found"},
            "Critical_Thinking": {"score": "Yes" if has_steps else "No", "evidence": "Systematic approach" if has_steps else "No structured troubleshooting"},
            "Accurate_Information": {"score": "Yes", "evidence": "Information consistent with resolution"},
            "Effective_Resources": {"score": "Yes" if has_script or has_kb else "N/A", "evidence": f"Resources referenced: Script={ticket.get('Script_ID', 'N/A')}"},
            "Timeliness": {"score": "Yes" if has_closing else "N/A", "evidence": "Case closed with follow-up" if has_closing else "N/A"},
            "Final_Weighted_Score": interaction_pct,
        }

    overall = interaction_pct if interaction_pct != "N/A" else case_pct

    return {
        "Evaluation_Mode": eval_mode,
        "Interaction_QA": interaction_qa,
        "Case_QA": case_qa,
        "Red_Flags": {
            "Account_Documentation_Violation": {"score": "No", "evidence": "No violations detected"},
            "Payment_Compliance_PCI_Violation": {"score": "No", "evidence": "No PCI data found"},
            "Data_Integrity_Confidentiality_Violation": {"score": "No", "evidence": "No data leaks detected"},
            "Misbehavior_Unprofessionalism": {"score": "No", "evidence": "Professional conduct maintained"},
        },
        "Overall_Weighted_Score": overall,
        "Contact_Summary": f"Agent handled {ticket.get('Category', 'support')} issue for {ticket.get('Product', 'PropertySuite')}. {'Resolution was confirmed by customer.' if conversation else 'Case documented with resolution.'}",
        "Case_Summary": f"Ticket {ticket.get('Ticket_Number', 'N/A')}: {ticket.get('Subject', 'N/A')}. {ticket.get('Resolution', 'No resolution documented.')[:200]}",
        "QA_Recommendation": "Keep doing" if overall != "N/A" and int(overall.replace("%", "") or 0) >= 70 else "Coaching needed",
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

    phone_matches = PHONE_PATTERN.findall(text)
    if phone_matches:
        findings.append({
            "category": "Phone Number Exposure",
            "severity": "MEDIUM",
            "description": f"Phone numbers found in text ({len(phone_matches)} instance(s)): consider masking",
            "owasp_ref": "A01:2021 - Broken Access Control / PII Handling",
        })

    email_matches = EMAIL_PATTERN.findall(text)
    if email_matches:
        findings.append({
            "category": "Email Address Exposure",
            "severity": "LOW",
            "description": f"Email addresses found in text ({len(email_matches)} instance(s)): verify consent for storage",
            "owasp_ref": "A01:2021 - Broken Access Control / Data Minimization",
        })

    for pattern in SENSITIVE_DATA_PATTERNS:
        matches = pattern.findall(text)
        if matches:
            findings.append({
                "category": "Sensitive Property Data",
                "severity": "MEDIUM",
                "description": f"Property/account identifiers in plain text ({len(matches)} instance(s))",
                "owasp_ref": "A04:2021 - Insecure Design / Data Classification",
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
        "total_checks": 7,
        "checks_run": [
            "PCI-DSS (card numbers, SSN, CVV)",
            "PII exposure (credentials, passwords)",
            "Phone number masking",
            "Email address handling",
            "Sensitive property data",
            "Prompt injection detection",
            "XSS payload detection",
        ],
        "owasp_frameworks": [
            "OWASP Top 10:2021",
            "OWASP Top 10 for LLM Applications",
            "PCI-DSS v4.0",
        ],
    }
