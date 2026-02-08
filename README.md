# Speare AI — The Self-Learning Brain for Customer Support

> **4th Hack Nation | RealPage Speare AI Challenge** 
>
> A self-learning AI support layer that continuously reads customer interactions, extracts operational knowledge into a living knowledge base, and guides agents in real time — with human-in-the-loop governance, OWASP compliance scanning, and full provenance traceability.

---

## Table of Contents

- [Speare AI — The Self-Learning Brain for Customer Support](#speare-ai--the-self-learning-brain-for-customer-support)
  - [Table of Contents](#table-of-contents)
  - [What It Does](#what-it-does)
  - [The Self-Learning Loop](#the-self-learning-loop)
  - [Quick Start](#quick-start)
    - [Prerequisites](#prerequisites)
    - [1. Clone \& configure](#1-clone--configure)
    - [2. Start the backend](#2-start-the-backend)
    - [3. Start the frontend](#3-start-the-frontend)
    - [4. Open the app](#4-open-the-app)
  - [Tech Stack](#tech-stack)
  - [Project Structure](#project-structure)
  - [API Reference](#api-reference)
  - [Evaluation Criteria Mapping](#evaluation-criteria-mapping)
  - [Dataset](#dataset)
  - [Demo Walkthrough](#demo-walkthrough)
    - [1. AI Copilot](#1-ai-copilot)
    - [2. Self-Learning Loop](#2-self-learning-loop)
    - [3. QA \& Compliance](#3-qa--compliance)
    - [4. Knowledge Graph](#4-knowledge-graph)
  - [License](#license)

---

## What It Does

Speare AI transforms customer support from a **reactive cost center** into a **living operating system for trust**.

| Feature | What Happens |
|---|---|
| **AI Copilot** | Agent asks a question → RAG retrieves the best KB article, Tier 3 script, or past resolution — with confidence scores and provenance citations |
| **Self-Learning Loop** | Resolved ticket with no KB match → auto-detect gap → LLM generates KB draft → human reviews → approved article is indexed and immediately retrievable |
| **QA & Compliance** | Select any ticket → LLM scores interaction quality using a weighted rubric → OWASP compliance scan runs in parallel (PCI, PII, prompt injection, XSS) |
| **Knowledge Graph** | Interactive force-directed visualization showing how KB articles trace back to tickets, conversations, and scripts |

---

## The Self-Learning Loop

This is the core differentiator — a closed-loop system that gets smarter after every interaction:

```
DETECT  →  Scan resolved Tier 3 tickets for knowledge gaps (no KB match above threshold)
   ↓
GENERATE  →  LLM auto-generates a KB article from ticket + conversation + script
   ↓
REVIEW  →  Human reviewer approves or rejects with notes (human-in-the-loop)
   ↓
PUBLISH  →  Approved articles are embedded into ChromaDB and immediately retrievable
   ↓
IMPROVE  →  Next similar question → Copilot answers with the new KB article
```

**Two trigger paths:**

| Path | How |
|---|---|
| **Batch Scan** | Learning Page → "Scan for Gaps" → runs gap detection across all resolved Tier 3 tickets |
| **Low-Confidence Detection** | Copilot answers with < 50% confidence → "Report as knowledge gap" button → creates Pending learning event |

Both paths feed into the same review → approve/reject → publish flow.

---

## Quick Start

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.12+ |
| Node.js | 18+ |
| OpenAI API Key | GPT-4o access |

### 1. Clone & configure

```bash
git clone https://github.com/bhanuprasanna2001/Speare_Hack_Nation
cd speare-ai
cp .env.example .env
# Edit .env → add your OPENAI_API_KEY
```

### 2. Start the backend

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

> **Note:** First run takes ~90s to embed 4,300+ documents across 3 collections. Subsequent runs use the persisted ChromaDB cache and start in ~2s.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Open the app

Navigate to **http://localhost:3000**

| Page | URL | Purpose |
|---|---|---|
| Dashboard | `/` | Statistics overview |
| AI Copilot | `/copilot` | Ask questions, get RAG-powered answers |
| Knowledge Base | `/knowledge` | Browse KB articles, view provenance graph |
| Self-Learning | `/learning` | Scan for gaps, review & approve KB drafts |
| QA & Compliance | `/qa` | Score interactions, run OWASP compliance checks |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Python 3.12 + FastAPI | Async API server, native AI ecosystem |
| **Vector DB** | ChromaDB (local, persistent) | Semantic search with cosine similarity over 4,300+ docs |
| **LLM** | OpenAI GPT-4o | Knowledge extraction, KB generation, QA scoring |
| **Embeddings** | all-MiniLM-L6-v2 (ChromaDB default) | Local embeddings, no API key needed for retrieval |
| **Frontend** | Next.js 15 + Tailwind CSS v4 | App Router, Turbopack, server-side API rewrites |
| **Graph Viz** | Custom Canvas 2D force simulation | Zero-dependency, HiDPI, interactive drag |

---

## Project Structure

```
speare-ai/
├── backend/
│   ├── requirements.txt          # Python dependencies
│   ├── app/
│   │   ├── main.py               # FastAPI app + all API endpoints (800+ lines)
│   │   ├── config.py             # Settings from .env
│   │   ├── data_loader.py        # Excel workbook → structured data loaders
│   │   ├── vector_store.py       # ChromaDB wrapper (index + search across 3 collections)
│   │   ├── services.py           # RAG, gap detection, KB generation, QA scoring, OWASP
│   │   └── models.py             # Pydantic request/response schemas
│   └── chroma_db/                # Persistent vector index (auto-created on first run)
│
├── frontend/
│   ├── package.json
│   └── src/
│       ├── app/                  # Next.js App Router pages
│       │   ├── page.tsx          # Dashboard
│       │   ├── copilot/          # AI Copilot
│       │   ├── knowledge/        # KB browser + detail views + provenance graph
│       │   ├── learning/         # Self-learning loop: scan, review, approve
│       │   └── qa/               # QA scoring + OWASP compliance
│       ├── components/           # Sidebar, KnowledgeGraph (Canvas 2D), Markdown
│       └── lib/                  # API client, utilities
│
├── data/
│   └── synthetic_it_support_tickets.csv   # Challenge dataset
│
├── Challenge.md                  # Full challenge specification
├── ROADMAP.md                    # Architecture & roadmap reference
├── .env                          # Environment variables (not committed)
└── README.md                     # ← You are here
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Dashboard statistics (articles, tickets, scripts, learning events) |
| `POST` | `/api/copilot/ask` | RAG-powered question answering with confidence + provenance |
| `GET` | `/api/knowledge/articles` | Paginated KB article listing with search |
| `GET` | `/api/knowledge/articles/{id}` | Single KB article detail |
| `GET` | `/api/knowledge/graph` | Knowledge provenance graph (nodes + links) |
| `GET` | `/api/learning/events` | List all learning events (Pending / Approved / Rejected) |
| `POST` | `/api/learning/scan-gaps` | Trigger batch gap detection across resolved Tier 3 tickets |
| `POST` | `/api/learning/generate-draft` | Generate KB article draft from a knowledge gap |
| `POST` | `/api/learning/review` | Approve or reject a learning event (human-in-the-loop) |
| `POST` | `/api/learning/report-gap` | Report a knowledge gap from the Copilot |
| `POST` | `/api/qa/score` | QA interaction scoring + OWASP compliance scan |
| `GET` | `/api/tickets` | Paginated ticket listing |
| `GET` | `/api/tickets/{id}` | Single ticket detail with conversation + script |

---

## Evaluation Criteria Mapping

| Criterion | How We Address It |
|---|---|
| **Learning Capability** | Closed-loop: gap detection → LLM KB generation → human review → vector index update → improved retrieval. Demonstrable before/after in the UI. |
| **Compliance & Safety** | OWASP compliance scanning across 6 categories: PCI data leakage, PII exposure, phone masking, email handling, prompt injection, XSS. Red-flag autozero per rubric. |
| **Accuracy & Consistency** | RAG retrieval grounded in 3,207 KB articles + 714 scripts + 400 tickets. Confidence scores and source provenance on every answer. |
| **Automation & Scalability** | Batch gap scanning across all tickets. Async FastAPI. ChromaDB indexes 4,300+ docs with sub-second retrieval. |
| **Clarity of Demo** | Visual self-learning pipeline. Interactive knowledge graph. QA score rings with compliance evidence. Clear trigger → output flow. |
| **Enterprise Readiness** | Human-in-the-loop governance. Full audit trail (reviewer, timestamp, notes). Provenance lineage on every KB article. |

---

## Dataset

The project uses a synthetic dataset with **4,300+ interconnected documents**:

| Data | Count | Description |
|---|---|---|
| Conversations | 400 | Call/chat transcripts between agents and customers |
| Tickets | 400 | Salesforce-style case records with resolutions |
| Questions | 1,000 | Ground truth Q&A pairs for retrieval evaluation |
| Scripts_Master | 714 | Tier 3 backend SQL fix scripts with placeholders |
| Knowledge_Articles | 3,207 | KB articles (seed + synthetically generated) |
| KB_Lineage | 483 | Provenance: KB article → source ticket/conversation/script |
| Learning_Events | 161 | Simulated gap detection → review workflow events |
| QA_Evaluation_Prompt | 1 | Weighted QA scoring rubric with autozero red flags |

---

## Demo Walkthrough

### 1. AI Copilot
Ask a natural language question → get an answer grounded in KB articles, scripts, or ticket resolutions with confidence scoring and cited sources.

### 2. Self-Learning Loop
Navigate to **Learning** → click **"Scan for Gaps"** → review detected gaps → click **"Generate Draft"** → review the LLM-generated KB article → **Approve** or **Reject** with notes → approved articles are immediately indexed and retrievable by the Copilot.

### 3. QA & Compliance
Navigate to **QA** → select a ticket → run QA scoring → see weighted category scores + OWASP compliance flags with evidence excerpts.

### 4. Knowledge Graph
Navigate to **Knowledge** → explore the interactive force-directed graph. Nodes are color-coded: Blue (KB articles), Purple (Scripts), Green (Tickets), Amber (Conversations). Click any node to see details and provenance.

---

## License

Hackathon project — built for 4th Hack Nation with intensity, caffeine, and purpose.
