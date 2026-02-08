# TrustOps OS — Project Roadmap

> **Provenance-first, policy-governed, self-learning support layer.**
> Every answer is cited, every new fix becomes institutional memory through HITL approval,
> and drift/quality are continuously monitored via OpenTelemetry + Grafana.

---

## Dataset Summary

| Tab | Rows | Purpose |
|-----|------|---------|
| Conversations | 400 | Call/chat transcripts with agent + customer turns |
| Tickets | 400 | Salesforce-style case records with resolutions |
| Questions | 1,000 | Ground truth questions with Answer_Type + Target_ID |
| Scripts_Master | 714 | Tier 3 backend scripts with sanitized SQL/procedures |
| Placeholder_Dictionary | 25 | Definitions for placeholders in scripts/articles |
| Knowledge_Articles | 3,207 | Combined KB corpus (seed + synthetic generated) |
| Existing_Knowledge_Articles | 3,046 | Seed-only KB corpus (baseline for RAG) |
| KB_Lineage | 483 | Provenance: KB article → source ticket/conversation/script |
| Learning_Events | 161 | Simulated self-learning workflow events |
| QA_Evaluation_Prompt | 1 | Full QA rubric with weighted scoring + tracking items |

**Key join fields:** `Ticket_Number`, `Conversation_ID`, `Script_ID`, `KB_Article_ID`

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React SPA)                       │
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐ ┌───────────────┐  │
│  │   Ask    │ │ Evidence │ │Learning Queue │ │  Dashboard    │  │
│  │  Page    │ │  Page    │ │    Page       │ │   Page        │  │
│  └────┬─────┘ └────┬─────┘ └──────┬────────┘ └──────┬────────┘  │
│       │             │              │                  │           │
│       └─────────────┴──────────────┴──────────────────┘           │
│                       SSE + REST API                              │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                     BACKEND (FastAPI + LangGraph)                  │
│                                                                    │
│  Runs API: POST /runs → GET /runs/{id}/events (SSE) → GET /runs/{id}
│                                                                    │
│  ┌─────────┐ ┌───────────┐ ┌────────────┐ ┌─────────┐           │
│  │ Triage  │→│ Retrieval │→│  Policy    │→│ Answer  │           │
│  │ Agent   │ │  Agent    │ │  Guard     │ │ Agent   │           │
│  └─────────┘ └───────────┘ │(OWASP-    │ └────┬────┘           │
│                             │ mapped)    │      │                │
│                             └────────────┘      │                │
│                              ┌───────────────────▼──────┐        │
│                              │ Learning Agent            │        │
│                              │ → HITL Gate (interrupt()) │        │
│                              │ → Publish Agent           │        │
│                              └──────────────────────────┘        │
│                                                                    │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  Telemetry: OTel Spans + Prometheus Metrics         │          │
│  └─────────────────────────────────────────────────────┘          │
└──────────┬────────────────────────┬──────────────────────────────┘
           │                        │
    ┌──────▼──────┐          ┌──────▼──────────────────────────┐
    │ Redis Stack │          │ OTel Collector                   │
    │ (Vectors +  │          │   exposes :8889/metrics          │
    │  Cache +    │          │                                  │
    │  Checkpts)  │          │ Prometheus (scrapes Collector    │
    │             │          │   + Backend /metrics)            │
    └─────────────┘          │                                  │
                             │ Grafana (reads from Prometheus)  │
    ┌─────────────┐          │                                  │
    │ Evidently   │          │ Evidently drift metrics ──►      │
    │ (bg job)    │──────────│   Prometheus (scrape/push)       │
    └─────────────┘          └─────────────────────────────────┘
```

---

## Phase 0: Project Scaffolding & Dev Environment
**Time estimate: 1–1.5 hours**
**Goal:** Everyone can `docker-compose up` and see a running skeleton.

### 0.1 Repository Structure
- [ ] Create directory tree: `backend/`, `frontend/`, `pipelines/`, `infra/`, `scripts/`, `docs/`
- [ ] Initialize `backend/` with `pyproject.toml` (FastAPI, uvicorn, redis, langchain, langgraph, langgraph-checkpoint-redis, opentelemetry, pydantic, evidently, openpyxl, sentence-transformers, sse-starlette)
- [ ] Initialize `frontend/` with Vite + React + TypeScript (`npm create vite@latest`)
- [ ] Install frontend deps: tailwindcss, shadcn/ui, zustand, lucide-react, react-router-dom
- [ ] Create `.env.example` with all required environment variables
- [ ] Update `.gitignore` for processed data, .env, docker volumes

### 0.2 Docker Compose (Skeleton)
- [ ] Write `docker-compose.yml` with all 6 services (backend, frontend, redis, otel-collector, prometheus, grafana)
- [ ] Write `docker-compose.dev.yml` overlay for hot-reload
- [ ] Write `backend/Dockerfile` (multi-stage)
- [ ] Write `frontend/Dockerfile` (multi-stage with nginx)
- [ ] Write `infra/otel-collector-config.yaml` (receive OTLP, expose Prometheus exporter on :8889)
- [ ] Write `infra/prometheus.yml` (scrape backend /metrics + Collector :8889/metrics)
- [ ] Verify: `docker-compose up` starts all services without errors

### 0.3 Backend Skeleton
- [ ] Create `backend/app/main.py` — FastAPI app with lifespan, CORS, health endpoint
- [ ] Create `backend/app/core/config.py` — Pydantic BaseSettings
- [ ] Create placeholder route files: `api/runs.py`, `api/learn.py`, `api/metrics.py`
- [ ] Create `backend/app/models/` with base Pydantic schemas
- [ ] Verify: `GET /health` returns 200

### 0.4 Frontend Skeleton
- [ ] Set up Vite + React + TypeScript + Tailwind + shadcn/ui
- [ ] Create 4 page shells: Ask, Evidence, Learning, Dashboard
- [ ] Set up React Router with navigation
- [ ] Configure environment variables (`VITE_API_BASE_URL`, `VITE_GRAFANA_URL`)
- [ ] Verify: Frontend loads with placeholder pages

**Exit criteria:** `docker-compose up` boots all services. Frontend shows 4 pages. Backend returns health check. Redis is connected.

---

## Phase 1: Data Pipeline & Retrieval Spine
**Time estimate: 2–3 hours**
**Goal:** Data ingested, embedded, searchable in Redis. Retrieval accuracy measurable.

### 1.1 pandas + openpyxl Ingest
- [ ] Write `pipelines/ingest.py`:
  - Read `SupportMind__Final_Data.xlsx` with pandas (`pd.read_excel()` + openpyxl engine)
  - Parse each tab into a pandas DataFrame
  - Clean: strip whitespace, parse dates, normalize tags
  - Validate join keys (warn on orphans)
  - Output to `data/processed/`:
    - `kb_corpus.jsonl` (merge Knowledge_Articles + Existing_Knowledge_Articles, deduplicate by KB_Article_ID)
    - `scripts_corpus.jsonl`
    - `tickets.jsonl`
    - `questions_ground_truth.jsonl`
    - `lineage.jsonl`
    - `learning_events.jsonl`
    - `placeholders.json`
- [ ] Log ingest summary: row counts, warnings, elapsed time

### 1.2 Embedding Generation
- [ ] Write `pipelines/embed.py`:
  - Read `kb_corpus.jsonl` and `scripts_corpus.jsonl`
  - For KB articles: embed `title + " " + body` (truncated to model limit)
  - For Scripts: embed `script_title + " " + script_purpose + " " + script_text_sanitized`
  - Use sentence-transformers locally (all-MiniLM-L6-v2, 384 dim) OR OpenAI API
  - Output: `data/processed/kb_embeddings.jsonl`, `data/processed/scripts_embeddings.jsonl`
  - Track progress with tqdm
- [ ] Log: total docs embedded, avg embedding time, model used

### 1.3 Redis Index Creation & Bulk Load
- [ ] Write `pipelines/load_redis.py`:
  - Connect to Redis Stack
  - Create `idx:kb_articles` index with schema (TAG filters + VECTOR field)
  - Create `idx:scripts` index with schema
  - Bulk load using Redis pipelines (batch size 500)
  - Store as RedisJSON documents with embeddings as VECTOR field
- [ ] Verify with `FT.INFO`: document counts match source (3207 KB, 714 Scripts)
- [ ] Write `pipelines/run_all.py` — orchestrate ingest → embed → load

### 1.4 Retrieval Service
- [ ] Write `backend/app/services/redis_retrieval.py`:
  - `async def retrieve_kb(query_embedding, filters, top_k) -> list[RetrievedDocument]`
  - `async def retrieve_scripts(query_embedding, filters, top_k) -> list[RetrievedDocument]`
  - Hybrid search: vector similarity + metadata filters (category, module, status)
  - Return: documents + similarity scores
- [ ] Write `backend/app/services/embedding_service.py`:
  - `async def embed_query(text: str) -> list[float]`
  - Cache embeddings for repeated queries (Redis TTL cache)

### 1.5 Retrieval API Endpoint
- [ ] Implement `GET /api/v1/retrieve`:
  - Input: `query: str, top_k: int, answer_type: Optional[str]`
  - Output: `list[RetrievedDocument]` with scores
- [ ] Implement retrieval accuracy evaluation:
  - Load `questions_ground_truth.jsonl`
  - For each question: retrieve top-k, check if `Target_ID` is in results
  - Compute hit@1, hit@3, hit@5
  - Expose via `GET /api/v1/retrieve/eval`
- [ ] Log baseline retrieval accuracy numbers

**Exit criteria:** All data loaded in Redis. `/retrieve` returns relevant results. Baseline hit@k numbers established. This is the foundation everything else builds on.

---

## Phase 2: LangGraph Agent Workflow & Policy Guards
**Time estimate: 3–4 hours**
**Goal:** End-to-end question → answer pipeline with citations, policy checks, and HITL.

### 2.1 LangGraph State & Graph Definition
- [ ] Define `TrustOpsState` TypedDict in `backend/app/agents/state.py`
- [ ] Create `backend/app/agents/graph.py` — the StateGraph definition with all nodes and edges
- [ ] Define conditional edges:
  - After Triage: if ESCALATE → short-circuit to AnswerAgent with escalation message
  - After PolicyGuard: if failed → refuse with violation details
  - After Answer: if confidence < threshold → route to LearningAgent
  - After HITL: if APPROVED → PublishAgent; if REJECTED → archive

### 2.2 TriageAgent Node
- [ ] Write `backend/app/agents/triage.py`:
  - Input: question text
  - Use LLM with structured output (JSON mode) to classify: KB / SCRIPT / ESCALATE
  - Include confidence score
  - Prompt includes examples from the dataset for few-shot classification
  - If question mentions "script", "backend fix", "data-fix" → lean toward SCRIPT
  - If question is general how-to → lean toward KB
  - If ambiguous or complex multi-step → ESCALATE
- [ ] Test with sample questions from the Questions tab

### 2.3 RetrievalAgent Node
- [ ] Write `backend/app/agents/retrieval.py`:
  - Routes to KB or Script index based on triage_result
  - Calls redis_retrieval service
  - Attaches retrieval scores to state
  - If all scores below threshold → flag as "retrieval miss"
- [ ] Add metadata enrichment: for Script results, attach placeholder definitions

### 2.4 PolicyGuardAgent Node (OWASP-Mapped Control Plane)
- [ ] Write `backend/app/agents/policy_guard.py`:
  - **Pre-guard** (before answer):
    - Input sanitization (strip injection patterns) → **LLM01: Prompt Injection**
    - PII detection in user input → **LLM06: Sensitive Information Disclosure**
    - Check retrieved docs are from Published status only → **LLM05: Supply Chain Vulnerabilities** (+ LLM03 if corpus poisoning framing)
  - **Post-guard** (after answer):
    - Citation requirement: every factual claim must have a citation → **ASI08: Cascading Failures** + **LLM09: Overreliance**
    - Confidence threshold: refuse if below configured minimum
    - Sensitive content check: no PCI data, no credentials → **LLM06**
    - Allowlisted tools check: agent can only use approved tools → **ASI02: Tool Misuse & Exploitation**
    - No self-modification of policies → **ASI03: Identity & Privilege Abuse**
- [ ] Write `backend/app/policies/` with policy definitions as code:
  - `prompt_injection_policy.py` — LLM01 (input sanitization, instruction boundary)
  - `insecure_output_policy.py` — LLM02 (structured output validation)
  - `corpus_integrity_policy.py` — LLM05 + LLM03 (published-only retrieval, corpus trust)
  - `sensitive_info_policy.py` — LLM06 (PII/PCI pattern detection + redaction)
  - `overreliance_policy.py` — LLM09 (citation-required, confidence surfaced)
  - `goal_hijack_policy.py` — ASI01 (fixed system instructions, isolated user input)
  - `tool_misuse_policy.py` — ASI02 (allowlisted tools only)
  - `privilege_policy.py` — ASI03 (no self-modification)
  - `memory_poisoning_policy.py` — ASI06 (conversation context TTL)
  - `cascading_failure_policy.py` — ASI08 (refuse on retrieval miss, graceful degradation)
- [ ] Each violation includes: `{policy_name, owasp_risk_id, description, severity}`
- [ ] Violations surfaced in SSE events + recorded as OTel span events with `owasp.risk_id` attribute

### 2.5 AnswerAgent Node
- [ ] Write `backend/app/agents/answer.py`:
  - Generate answer ONLY from retrieved documents
  - Use structured output (JSON) forcing citation format:
    ```json
    {
      "answer": "...",
      "citations": [{"source_id": "KB-xxx", "excerpt": "...", "relevance": 0.92}],
      "required_inputs": ["<LEASE_ID>", "<DATABASE>"],
      "confidence": 0.87
    }
    ```
  - For SCRIPT answers: include the script steps + required inputs
  - For KB answers: include the article content + navigation steps
  - If cannot answer with evidence → refuse with explanation
- [ ] Enable streaming: yield tokens as they're generated

### 2.6 LearningAgent Node
- [ ] Write `backend/app/agents/learning.py`:
  - Triggered when: retrieval miss, low confidence, or explicit gap detection
  - Drafts a KB article from: closest matching ticket resolution + transcript context
  - Includes lineage: source ticket number, conversation ID, script ID
  - Runs the QA rubric (from QA_Evaluation_Prompt tab) against the draft
  - Creates a LearningEvent record
- [ ] Store draft in Redis as pending review item

### 2.7 HITL Gate (LangGraph Interrupts)
- [ ] Implement LangGraph `interrupt()` inside the HITL node:
  - Call `interrupt({kb_draft, learning_event, evidence})` to pause the graph
  - LangGraph persists full graph state to Redis-backed checkpointer via `langgraph-checkpoint-redis` package (`RedisSaver`)
  - No ad-hoc state serialization — LangGraph owns the pause/resume lifecycle
- [ ] When interrupted:
  - Emit `approval_required` SSE event to the frontend
  - Run status becomes `"awaiting_approval"` in `GET /api/v1/runs/{run_id}`
- [ ] Resume endpoint: `POST /api/v1/runs/{run_id}/approve`
  - Input: `decision` (APPROVE/REJECT/EDIT), `reviewer_notes`, `edited_content`
  - Resumes the graph: `graph.invoke(Command(resume=decision), config={"configurable": {"thread_id": run_id}})`
  - LangGraph picks up execution exactly where `interrupt()` paused
  - Routes to PublishAgent (on approve) or archives (on reject)

### 2.8 PublishAgent Node
- [ ] Write `backend/app/agents/publish.py`:
  - Version the new KB article (auto-increment, timestamp)
  - Generate embedding for the new article body
  - Index into Redis `idx:kb_articles` with `source_type: "generated"`, `status: "Published"`
  - Create KB_Lineage entry linking article → source ticket → conversation → script
  - Emit OTel event: `kb_published`
- [ ] Verify: after publish, the new article appears in retrieval results

### 2.9 Wire Up the Runs API
- [ ] Implement `POST /api/v1/runs`:
  - Accept `{ question, session_id }` → create a run, return `{ run_id, status: "created" }`
  - Launch the LangGraph workflow asynchronously (tied to run_id as thread_id)
- [ ] Implement `GET /api/v1/runs/{run_id}/events` (SSE):
  - Use `sse-starlette`'s `EventSourceResponse`
  - Convert LangGraph `astream_events()` into typed SSE events:
    - `event: triage` → `data: {"result": "KB", "confidence": 0.91}`
    - `event: retrieval` → `data: {"docs": [...], "scores": [...]}`
    - `event: policy` → `data: {"passed": true, "violations": []}`
    - `event: token` → `data: {"content": "..."}`
    - `event: citation` → `data: {"source_id": "KB-xxx", "excerpt": "..."}`
    - `event: approval_required` → `data: {"event_id": "LEARN-xxx"}`
    - `event: done` → `data: {"confidence": 0.87, "trace_id": "..."}`
    - `event: error` → `data: {"message": "...", "code": "POLICY_VIOLATION"}`
- [ ] Implement `GET /api/v1/runs/{run_id}`:
  - Return final structured result (answer + citations + triage + confidence + trace_id)
  - Available after run completes (status: "completed")
- [ ] Implement `POST /api/v1/runs/{run_id}/approve`:
  - HITL decision endpoint (resumes interrupted graph)
- [ ] Implement `POST /api/v1/runs/{run_id}/cancel`:
  - Cancel an in-progress run
- [ ] SSE reliability hardening:
  - Send `event: heartbeat` every 15s on idle streams (prevents proxy/LB disconnects)
  - Buffer SSE events per `run_id` in Redis Stream (short TTL)
  - Include `id:` field on every event so `EventSource` auto-reconnect can send `Last-Event-ID` and replay missed events
  - Expire event buffer 5 min after `done`/`error`
- [ ] Test end-to-end: send a question from Questions tab, verify correct Target_ID in citations

**Exit criteria:** Create run → subscribe to SSE events → see streamed answer with citations. Policy violations blocked with OWASP risk IDs. HITL flow works (interrupt → approve → publish → re-retrieval succeeds). No WebSockets anywhere.

---

## Phase 3: Observability, Drift Detection & Trust Metrics
**Time estimate: 2–3 hours**
**Goal:** Every agent step is traced. Dashboards show trust metrics. Drift is monitored.

### 3.1 OpenTelemetry Instrumentation
- [ ] Write `backend/app/telemetry/setup.py`:
  - Initialize TracerProvider + MeterProvider
  - Configure OTLP exporter (gRPC to OTel Collector)
  - Register FastAPI auto-instrumentation
  - Register Redis auto-instrumentation
- [ ] Register in FastAPI lifespan (startup event)
- [ ] Add custom spans to EVERY LangGraph node:
  - Span name: `trustops.{node_name}` (e.g., `trustops.triage_agent`)
  - Attributes: `session_id`, `triage_result`, `retrieval_count`, `confidence`, `policy_passed`
  - Events: `policy_violation`, `learning_triggered`, `kb_published`

### 3.2 Prometheus Metrics
- [ ] Define custom metrics in `backend/app/telemetry/metrics.py`:
  - `trustops_ask_total` (counter, labels: triage_type)
  - `trustops_retrieval_latency_ms` (histogram)
  - `trustops_retrieval_hit_at_k` (gauge, updated from eval runs)
  - `trustops_citation_coverage` (gauge)
  - `trustops_policy_violations_total` (counter, labels: violation_type)
  - `trustops_confidence_distribution` (histogram)
  - `trustops_answer_latency_ms` (histogram)
  - `trustops_learning_events_total` (counter, labels: status)
  - `trustops_kb_articles_total` (gauge)
  - `trustops_drift_alerts_total` (counter, labels: drift_type)
- [ ] Expose metrics endpoint: `GET /metrics` (Prometheus format)
- [ ] Configure Prometheus to scrape backend every 15s

### 3.3 Grafana Dashboards
- [ ] Create `infra/grafana/dashboards/trust-overview.json`:
  - Ask volume rate, triage distribution pie chart, avg confidence gauge
  - Retrieval hit@k trend line, citation coverage gauge, policy violations counter
  - E2E latency histogram, per-node latency breakdown stacked bar
- [ ] Create `infra/grafana/dashboards/self-learning.json`:
  - Learning events rate, approval rate pie, KB growth line
  - Before/after retrieval accuracy comparison
  - Drift alerts timeline
- [ ] Create `infra/grafana/dashboards/compliance.json`:
  - Policy violations by type, escalation rate, red flag detections
  - QA score distribution histogram
- [ ] Configure Grafana provisioning: auto-load dashboards on startup
- [ ] Set anonymous access on Grafana for easy iframe embedding

### 3.4 Drift Detection (Evidently — Standalone Background Job)
Evidently is NOT part of the OTel pipeline. It runs as a separate background service/job.
- [ ] Write `backend/app/services/drift_service.py`:
  - Collect per-question signals: category, retrieval scores, answer type, confidence
  - Store in a rolling window (Redis list)
  - Run as a background job (FastAPI `BackgroundTask` or APScheduler)
  - Trigger: every 50 questions OR every 15 minutes (whichever first)
  - Compute drift reports using Evidently:
    - Topic drift: question category distribution shift
    - Retrieval score drift: mean similarity score dropping
    - Answer type drift: KB/SCRIPT/ESCALATE ratio changing
    - Confidence drift: mean confidence trending down
  - Compute RAG quality metrics: hit rate@k, precision@k, MRR
  - Output two things:
    1. **Report artifacts**: JSON stored in Redis or `data/reports/`
    2. **Prometheus metrics**: drift scores as gauges, scraped by Prometheus
  - On drift detected: emit OTel span event + increment Prometheus counter
- [ ] Expose drift reports: `GET /api/v1/metrics/drift` (JSON)
- [ ] Surface drift alerts in the Trust Dashboard

### 3.5 Trust Metrics API
- [ ] Implement `GET /api/v1/metrics`:
  - Aggregate metrics: total asks, triage distribution, avg confidence
  - Retrieval accuracy (latest eval run)
  - Citation coverage rate
  - Policy violation summary
  - Learning pipeline stats (pending/approved/rejected)
  - Active drift alerts
- [ ] Return as structured JSON for the frontend Dashboard page

**Exit criteria:** Grafana dashboards show live metrics. Every `/ask` request creates a trace. Drift detection runs and surfaces alerts. `/metrics` returns comprehensive trust summary.

---

## Phase 4: Frontend — Judge-Ready UI
**Time estimate: 2–3 hours**
**Goal:** Polished, demo-ready UI that tells the TrustOps story in 4 screens.

### 4.1 Ask Page (Primary Demo Screen)
- [ ] Search input with "Ask a support question" placeholder
- [ ] Pre-loaded example questions from the Questions tab (click to fill)
- [ ] On submit:
  - Call `POST /api/v1/runs` to create a run → get `run_id`
  - Subscribe to `GET /api/v1/runs/{run_id}/events` via `EventSource` (SSE)
  - Show triage badge (KB / SCRIPT / ESCALATE) with confidence bar (on `triage` event)
  - Stream answer tokens with typewriter effect (on `token` events)
  - Render citations as clickable chips inline (on `citation` events)
  - Show confidence score as a visual indicator (on `done` event)
  - Display trace_id (small, for technical credibility)
- [ ] For SCRIPT answers: render script steps + required inputs table
- [ ] For ESCALATE: show escalation reason + suggested next steps
- [ ] Loading state: animated skeleton with "Triaging..." → "Retrieving..." → "Checking policy..." → "Generating answer..." step indicators
- [ ] Error state: friendly message with retry button

### 4.2 Evidence Page (Retrieval Transparency)
- [ ] Top-k retrieval results displayed as cards:
  - Source type badge (KB / Script)
  - Title + relevance score (visual bar)
  - Expandable body preview
  - Source ID (KB_Article_ID or Script_ID)
- [ ] Source document viewer:
  - Full KB article or Script text
  - For Scripts: highlight placeholders with tooltip definitions
- [ ] Lineage graph (simple):
  - Visual chain: KB Article → Source Ticket → Conversation → Script
  - Pull data from KB_Lineage tab
  - Could be a simple flow diagram or timeline

### 4.3 Learning Queue Page (HITL Approval)
- [ ] Tabs: Pending | Approved | Rejected
- [ ] Pending items:
  - Card per learning event
  - Left panel: original ticket/conversation context
  - Right panel: drafted KB article
  - Bottom: QA rubric score (from QA_Evaluation_Prompt scoring)
  - Actions: Approve (green) / Reject (red) / Edit (blue)
- [ ] Edit modal: inline editor for the drafted KB article
- [ ] On Approve: call `POST /api/v1/runs/{run_id}/approve`, show success toast, item moves to Approved tab
- [ ] On Reject: prompt for reviewer notes, call API, move to Rejected tab
- [ ] History view: timeline of all decisions with timestamps and reviewer names
- [ ] Pre-seed with Learning_Events data (161 events) for a rich demo

### 4.4 Trust Dashboard Page (Observability)
- [ ] Option A (Faster): Embed Grafana panels via iframe
  - 3 dashboard sections matching the Grafana dashboards
  - Full-screen toggle per panel
- [ ] Option B (Richer): Custom charts with a React charting library (recharts or chart.js)
  - Key metrics cards at top: Total Asks, Avg Confidence, Citation Coverage, Active Violations
  - Retrieval accuracy trend (line chart)
  - Triage distribution (donut chart)
  - Policy violations (bar chart by type)
  - Drift alerts (timeline)
  - Learning pipeline funnel: Detected → Drafted → Approved → Published
- [ ] Real-time updates: poll `/api/v1/metrics` every 10s (simple fetch interval)

### 4.5 Global UI Elements
- [ ] Top navigation bar: TrustOps OS logo + 4 page links + dark mode toggle
- [ ] Footer: "Built for RealPage Hackathon 2026" + tech stack badges
- [ ] Global error boundary with recovery
- [ ] Toast notifications for actions (approve, reject, publish)
- [ ] Responsive layout (optimized for 1080p demo screen)
- [ ] Dark mode as default (looks better in demos)

**Exit criteria:** All 4 pages functional and polished. Demo flows smoothly: Ask question → see streaming answer with citations → view evidence → see learning event → approve → see updated dashboard. This is what judges see.

---

## Phase 5: Demo Story & Polish
**Time estimate: 1–2 hours**
**Goal:** The demo is rehearsed, the narrative is tight, and edge cases are handled.

### 5.1 The Killer Demo Moment
- [ ] Set up the CS-38908386 demo flow:
  1. Ask a question about "advance property date" — retrieval FAILS (no KB article yet)
  2. System detects gap, drafts KB-SYN-0001 from the Tier 3 ticket
  3. Reviewer approves the KB article in the Learning Queue
  4. Ask the SAME question again — retrieval SUCCEEDS with the new article
  5. Dashboard shows: KB growth +1, retrieval accuracy improved, learning event approved
- [ ] This is the "system improves from interactions" proof point — the single most important demo moment

### 5.2 Pre-seeded Data for Rich Demo
- [ ] Pre-load all 161 Learning_Events (mix of Approved/Rejected/Pending)
- [ ] Pre-load KB_Lineage data for provenance queries
- [ ] Pre-load QA scores for sample tickets (using QA_Evaluation_Prompt rubric)
- [ ] Pre-seed some Prometheus metric history so dashboards aren't empty
- [ ] Create a `scripts/seed_demo.py` that sets up the demo state

### 5.3 Error Handling & Edge Cases
- [ ] Graceful handling when Redis is down (show cached response or meaningful error)
- [ ] Graceful handling when LLM API is down or rate-limited
- [ ] Handle empty retrieval results (no matching KB or script)
- [ ] Handle policy violations smoothly (show what was blocked and why)
- [ ] Handle SSE EventSource errors (built-in auto-reconnect; handle terminal errors gracefully)

### 5.4 Performance Optimization
- [ ] Verify end-to-end latency is acceptable (< 5s for full answer)
- [ ] If slow: parallelize triage + pre-retrieval, cache frequent embeddings
- [ ] Frontend: ensure streaming feels smooth (no jank, no blank states)

### 5.5 Deployment Verification
- [ ] Full `docker-compose up --build` from clean state works
- [ ] Data pipeline runs successfully: `pipelines/run_all.py`
- [ ] All 4 frontend pages render correctly
- [ ] Grafana dashboards load with data
- [ ] SSE streaming stable over 10-minute demo window

### 5.6 README & Documentation
- [ ] Write `README.md`:
  - One-paragraph project description
  - Architecture diagram (ASCII or link to image)
  - Quick start: `docker-compose up`
  - Tech stack list with justification
  - Demo walkthrough steps
  - Team info
- [ ] Create `.env.example` with all variables documented

**Exit criteria:** The demo runs for 10 minutes without issues. The CS-38908386 learning loop demo works perfectly. README makes the project accessible to anyone.

---

## Phase Dependency Graph

```
Phase 0 (Scaffold)
    │
    ├──► Phase 1 (Data + Retrieval)
    │        │
    │        ├──► Phase 2 (Agents + Policies)
    │        │        │
    │        │        ├──► Phase 3 (Observability)
    │        │        │        │
    │        │        │        └──► Phase 5 (Polish)
    │        │        │
    │        │        └──► Phase 4 (Frontend) ◄── can start UI shells early
    │        │                 │
    │        │                 └──► Phase 5 (Polish)
    │        │
    │        └──► Phase 4.2 (Evidence page needs retrieval data)
    │
    └──► Phase 4 (Frontend shells can be built in parallel with Phase 1)
```

**Parallelization strategy:**
- Phase 0 is sequential (must be done first)
- Phase 1 and Phase 4 (shells only) can run in parallel
- Phase 2 and Phase 3 can partially overlap (start OTel setup while building agents)
- Phase 4 (data-connected pages) depends on Phase 2 backend APIs
- Phase 5 is the final sequential pass

---

## Evaluation Criteria Mapping

| Criterion | Where We Deliver |
|-----------|-----------------|
| **Learning Capability** | LearningAgent + HITL Gate + PublishAgent (Phase 2.6–2.8); Demo moment CS-38908386 (Phase 5.1) |
| **Compliance & Safety** | PolicyGuardAgent with OWASP mapping (Phase 2.4); QA rubric scoring (Phase 2.6); Red flag detection |
| **Accuracy & Consistency** | Citation-required AnswerAgent (Phase 2.5); Ground truth eval with hit@k (Phase 1.5); Structured output |
| **Automation & Scalability** | pandas ingest + PySpark batch analytics / root cause mining (Phase 1); Redis vector search (Phase 1.4); Docker/K8s deploy (Phase 0.2) |
| **Clarity of Demo** | 4-screen UI (Phase 4); CS-38908386 learning loop demo (Phase 5.1); Streaming UX (Phase 4.1) |
| **Enterprise Readiness** | OTel + Prometheus + Grafana observability (Phase 3); Drift detection (Phase 3.4); HITL governance (Phase 2.7); Docker + K8s (Phase 0.2) |

---

## Tech Stack Quick Reference

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend API | FastAPI + uvicorn | Async, typed, auto-docs, OTel support |
| Agent Orchestration | LangGraph | StateGraph + HITL interrupts + streaming |
| LLM | GPT-4o-mini (or Gemini) | Fast, structured output, cost-effective |
| Embeddings | sentence-transformers / OpenAI | Local or API, flexible |
| Vector Store | Redis Stack (RediSearch) | Vector search + hybrid filters + caching + queues — one service |
| Data Ingest | pandas + openpyxl | Reliable Excel parsing, no JVM overhead |
| Batch Analytics | PySpark | Root cause mining, clustering, scalability story |
| Drift Detection | Evidently (bg job) | Open-source, RAG eval metrics, outputs to Prometheus |
| Tracing + Metrics | OpenTelemetry | Vendor-neutral, standard, FastAPI instrumented |
| Metrics Store | Prometheus | Industry standard, Grafana integration |
| Dashboards | Grafana | Pre-built, embeddable, beautiful |
| Frontend | React + Vite + TypeScript | Fast build, type-safe, modern |
| Styling | Tailwind CSS + shadcn/ui | Professional look with minimal effort |
| State Management | Zustand | Lightweight, no boilerplate |
| Real-time Streaming | SSE (EventSource API) | Server → client streaming, auto-reconnect, standard HTTP |
| Containerization | Docker + Docker Compose | One-command full stack |
| Orchestration | Kubernetes (minimal) | "Runs anywhere" credibility |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| LLM API latency/downtime | Demo fails | Cache common answers; have fallback responses; pre-seed demo data |
| Redis vector search quality | Poor retrieval | Tune embeddings + hybrid search; use ground truth eval to iterate |
| SSE browser limits | Max 6 connections per domain | One EventSource per run; close on done/error; use HTTP/2 in prod |
| Scope creep | Miss deadline | Strict phase gates; cut Phase 5 polish before cutting core features |
| HITL interrupt complexity | Graph breaks | Test with simple approve/reject first; add edit later |
| Grafana iframe CORS | Dashboard broken | Configure Grafana anonymous auth + allowed origins; fallback to custom charts |
| Docker build time | Slow iteration | Use multi-stage builds; cache layers; run frontend dev server outside Docker |

---

## One-Liner for Judges

> **"TrustOps OS is a provenance-first, policy-governed, self-learning support layer: every answer is cited, every new fix becomes institutional memory through HITL approval, and drift/quality are continuously monitored via OpenTelemetry + Grafana."**
