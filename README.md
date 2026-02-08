# SupportMind AI

**The Self-Learning Brain for Customer Support**

> Built for the RealPage SupportMind AI Hackathon Challenge — a self-learning intelligence layer that continuously reads customer interactions, extracts operational knowledge, and guides both humans and AI agents in real time.

---

## What It Does

SupportMind AI transforms customer support from a **reactive cost center** into a **living operating system for trust**. It does this through four core capabilities:

| Capability | What Happens |
|---|---|
| **AI Copilot** | Agent asks a question → RAG retrieves the best KB article, Tier 3 script, or past resolution with provenance |
| **Self-Learning Loop** | Resolved ticket with no KB match → auto-detect gap → LLM generates KB draft → human reviews → approved article gets indexed |
| **QA & Compliance** | Select any ticket → LLM scores interaction quality using the challenge rubric → OWASP compliance scan runs in parallel |
| **Knowledge Graph** | Interactive force-directed visualization showing how KB articles trace back to tickets, conversations, and scripts |

## The Self-Learning Loop (How It Works)

This is the core differentiator. Here's the cycle:

```
1. DETECT    →  Scan resolved Tier 3 tickets for knowledge gaps (no KB match above threshold)
2. GENERATE  →  LLM auto-generates a KB article from ticket + conversation + script
3. REVIEW    →  Human reviewer approves or rejects with notes (human-in-the-loop)
4. PUBLISH   →  Approved articles are embedded into ChromaDB and immediately retrievable
5. IMPROVE   →  Next time someone asks a similar question, the Copilot answers with the new KB article
```

### How to Trigger It

There are **two ways** to start the learning loop:

1. **Learning Page → "Scan for Gaps"** — Runs gap detection across all resolved Tier 3 tickets. New gaps appear as Pending events for human review.

2. **Copilot → Low Confidence** — When the Copilot answers with < 50% confidence, a "Report as knowledge gap" button appears. Clicking it creates a Pending learning event.

Both paths lead to the same human-in-the-loop review → approve/reject → publish flow.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend | **Python + FastAPI** | Async, fast, native AI ecosystem |
| Vector DB | **ChromaDB** (local, persistent) | Zero-config semantic search with cosine similarity |
| LLM | **OpenAI GPT-4o** | Knowledge extraction, KB generation, QA scoring |
| Embeddings | **all-MiniLM-L6-v2** (via ChromaDB default) | Local, fast, no API key needed for retrieval |
| Frontend | **Next.js 15 + Tailwind CSS** | App Router, Turbopack, server-side rewrites |
| Graph | **Canvas 2D** (custom force simulation) | Zero-dependency, HiDPI, drag interaction |

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- OpenAI API key

### 1. Clone and set up environment

```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### 2. Start the backend

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

First run takes ~90s to embed 4,300+ documents. Subsequent runs use the cache and start in ~2s.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app + all API endpoints
│   │   ├── config.py          # Settings from .env
│   │   ├── data_loader.py     # Excel → structured data
│   │   ├── vector_store.py    # ChromaDB wrapper (index + search)
│   │   ├── services.py        # RAG, gap detection, KB gen, QA scoring, OWASP
│   │   └── models.py          # Pydantic schemas
│   └── chroma_db/             # Persistent vector index (auto-created)
│
├── frontend/
│   └── src/
│       ├── app/               # Next.js pages (Dashboard, Copilot, Knowledge, Learning, QA)
│       ├── components/        # Sidebar, KnowledgeGraph, Markdown
│       └── lib/               # API client, utilities
│
├── data/
│   └── SupportMind__Final_Data.xlsx   # Challenge dataset (10 sheets)
│
├── .env                       # Environment variables (not committed)
└── .cursorrules               # Build rules and design system
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Dashboard statistics |
| `POST` | `/api/copilot/ask` | RAG-powered question answering |
| `GET` | `/api/knowledge/articles` | Paginated KB article listing |
| `GET` | `/api/knowledge/graph` | Knowledge provenance graph data |
| `GET` | `/api/learning/events` | List learning events (gap detections) |
| `POST` | `/api/learning/generate-draft` | Generate KB article from ticket |
| `POST` | `/api/learning/review` | Approve/reject a learning event |
| `POST` | `/api/learning/scan-gaps` | Trigger gap detection scan |
| `POST` | `/api/learning/report-gap` | Report gap from Copilot |
| `POST` | `/api/qa/score` | QA scoring + OWASP compliance |
| `GET` | `/api/tickets` | Paginated ticket listing |

---

## Evaluation Criteria Mapping

| Criterion | How We Address It |
|---|---|
| **Learning Capability** | Self-learning loop: gap detection → KB generation → human review → vector index update. Demonstrable before/after. |
| **Compliance & Safety** | OWASP compliance scanning (PCI, PII, phone masking, email handling, prompt injection, XSS). Red Flags autozero per rubric. |
| **Accuracy & Consistency** | RAG retrieval grounded in 3,207 KB articles + 714 scripts + 400 tickets. Confidence scores on every answer. |
| **Automation & Scalability** | Batch gap scanning across all tickets. Async FastAPI. ChromaDB handles thousands of docs. |
| **Clarity of Demo** | Visual self-learning pipeline. Knowledge graph showing provenance. QA score rings with evidence. |
| **Enterprise Readiness** | Human-in-the-loop governance. Audit trail (reviewer, timestamp, notes). Role-based review. Provenance lineage on every KB article. |

---

## Design System

- **Background**: `#FAFAFA` with subtle dot pattern
- **Text**: `#252525` (near-black)
- **Primary accent**: `#6C5CE7` (purple)
- **Graph nodes**: Blue (KB), Purple (Scripts), Green (Tickets), Amber (Conversations)
- **Font**: Inter
- **Philosophy**: Elegant, information-dense, whitespace as a feature

---

## Data

The challenge ships with `SupportMind__Final_Data.xlsx` containing 10 interconnected sheets:

- **Conversations** (400) — Chat transcripts between agents and property managers
- **Tickets** (400) — Salesforce-style case records with resolutions
- **Questions** (1,000) — Ground truth Q&A for retrieval evaluation
- **Scripts_Master** (714) — Tier 3 backend SQL fix scripts
- **Knowledge_Articles** (3,207) — KB articles (seed + synthetically generated)
- **KB_Lineage** (483) — Provenance: which ticket/conversation/script created which KB
- **Learning_Events** (161) — Simulated gap detection → review workflow
- **QA_Evaluation_Prompt** — Complete QA rubric with weighted scoring

---

## License

Hackathon project — built with intensity, caffeine, and purpose.
