/**
 * API client for Speare AI backend.
 * All requests go through Next.js rewrites → FastAPI.
 */

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export interface ActivityLogEntry {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
  meta: Record<string, unknown>;
}

export interface DashboardStats {
  total_tickets: number;
  total_conversations: number;
  total_kb_articles: number;
  kb_articles_indexed: number;
  total_scripts: number;
  total_gaps_detected: number;
  gaps_approved: number;
  gaps_rejected: number;
  gaps_pending: number;
  avg_resolution_tier: number;
  self_learning_additions: number;
  activity_log: ActivityLogEntry[];
  qa_weights: {
    interaction: Record<string, number>;
    case: Record<string, number>;
  };
}

export function fetchStats(): Promise<DashboardStats> {
  return request("/stats");
}

/* ------------------------------------------------------------------ */
/* Copilot                                                             */
/* ------------------------------------------------------------------ */

export interface SourceDocument {
  id: string;
  doc_type: string;
  title: string;
  snippet: string;
  score: number;
  metadata: Record<string, string>;
}

export interface ConfidenceDetails {
  method: string;
  threshold: number;
  top_match_score: number;
  sources_searched: number;
  is_below_threshold: boolean;
}

export interface GuardrailCheck {
  passed: boolean;
  checks: { name: string; passed: boolean; detail: string }[];
}

export interface CopilotResponse {
  answer: string;
  confidence: number;
  sources: SourceDocument[];
  answer_type: string;
  confidence_details?: ConfidenceDetails;
  guardrails_input?: GuardrailCheck;
  guardrails_output?: GuardrailCheck;
}

/** SSE pipeline step from /copilot/ask-stream */
export interface PipelineStep {
  step: string;
  label: string;
  status: "running" | "done" | "error";
  data: Record<string, unknown>;
}

export function askCopilot(question: string): Promise<CopilotResponse> {
  return request("/copilot/ask", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

/**
 * Stream copilot answers via SSE. Calls `onStep` for each pipeline event.
 * Returns the final complete step data (full CopilotResponse).
 */
export async function askCopilotStream(
  question: string,
  onStep: (step: PipelineStep) => void,
  signal?: AbortSignal,
): Promise<CopilotResponse | null> {
  const res = await fetch(`${BASE}/copilot/ask-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Stream failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let finalResponse: CopilotResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") continue;

      try {
        const step = JSON.parse(payload) as PipelineStep;
        onStep(step);

        // The "complete" step contains the full response
        if (step.step === "complete" && step.data) {
          finalResponse = step.data as unknown as CopilotResponse;
        }
      } catch {
        // skip malformed events
      }
    }
  }

  return finalResponse;
}

export interface ConfidenceCheck {
  question: string;
  confidence: number;
  top_source: {
    id: string;
    title: string;
    doc_type: string;
    score: number;
  } | null;
  is_below_threshold: boolean;
  threshold: number;
}

export function checkConfidence(question: string): Promise<ConfidenceCheck> {
  return request("/copilot/confidence-check", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

/* ------------------------------------------------------------------ */
/* Knowledge                                                           */
/* ------------------------------------------------------------------ */

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; page_size: number; status_counts?: Record<string, number> };
}

export function fetchKBArticles(
  page = 1,
  search = "",
): Promise<Paginated<Record<string, string>>> {
  const params = new URLSearchParams({ page: String(page), search });
  return request(`/knowledge/articles?${params}`);
}

export interface GraphNode {
  id: string;
  label: string;
  group: string;
  metadata: Record<string, string>;
}

export interface GraphLink {
  source: string;
  target: string;
  relationship: string;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function fetchKnowledgeGraph(limit = 80): Promise<KnowledgeGraphData> {
  return request(`/knowledge/graph?limit=${limit}`);
}

export interface KBArticleDetail {
  KB_Article_ID: string;
  Title: string;
  Body: string;
  Module?: string;
  Category?: string;
  Tags?: string;
  Source_Type?: string;
  lineage: { source_id: string; source_type: string; relationship: string }[];
}

export function fetchKBArticle(
  id: string,
): Promise<{ data: KBArticleDetail }> {
  return request(`/knowledge/articles/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ */
/* Learning                                                            */
/* ------------------------------------------------------------------ */

export interface LearningEvent {
  event_id: string;
  ticket_number: string;
  conversation_id: string;
  detected_gap: string;
  proposed_kb_id: string;
  draft_summary: string;
  status: string;
  reviewer_role: string;
  timestamp: string;
  review_notes?: string;
  reviewed_at?: string;
  best_kb_score?: number;
  best_kb_match?: string;
  source_question?: string;
  reported_confidence?: number;
  draft?: KBDraft;
}

export function fetchLearningEvents(
  status = "",
  page = 1,
): Promise<Paginated<LearningEvent>> {
  const params = new URLSearchParams({ status, page: String(page) });
  return request(`/learning/events?${params}`);
}

export interface KBDraft {
  title: string;
  body: string;
  tags: string;
  source_ticket: string;
  source_conversation: string;
  source_script: string;
  lineage: { source_type: string; source_id: string; relationship: string }[];
  quality_score?: number;
  quality_notes?: string;
}

export interface DraftResponse {
  data: KBDraft;
  ticket: Record<string, string> | null;
  conversation: Record<string, string> | null;
  script: Record<string, string> | null;
}

export interface GenerateDraftRequest {
  ticket_number?: string;
  event_id?: string;
  question?: string;
}

export function generateDraft(payload: GenerateDraftRequest): Promise<DraftResponse> {
  return request("/learning/generate-draft", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ConfidenceImprovement {
  before: number;
  after: number;
  delta: number;
  explanation: string;
}

export interface ReviewResponse {
  data: LearningEvent;
  message: string;
  confidence_improvement: ConfidenceImprovement | null;
  article_id: string | null;
  kb_total_after: number;
}

export function reviewEvent(
  eventId: string,
  action: "approve" | "reject",
  notes = "",
  editedTitle = "",
  editedBody = "",
): Promise<ReviewResponse> {
  return request("/learning/review", {
    method: "POST",
    body: JSON.stringify({
      event_id: eventId,
      action,
      reviewer_notes: notes,
      edited_title: editedTitle,
      edited_body: editedBody,
    }),
  });
}

export function scanForGaps(): Promise<{
  data: {
    gaps_scanned: number;
    new_gaps_found: number;
    total_events: number;
    new_events: LearningEvent[];
  };
  message: string;
}> {
  return request("/learning/scan-gaps", { method: "POST" });
}

export function reportGapFromCopilot(
  question: string,
  confidence: number,
): Promise<{ data: LearningEvent; message: string }> {
  return request("/learning/report-gap", {
    method: "POST",
    body: JSON.stringify({ question, confidence }),
  });
}

export function fetchLearningEvent(
  eventId: string,
): Promise<{ data: LearningEvent & { ticket: Record<string, string>; conversation: Record<string, string>; script: Record<string, string> } }> {
  return request(`/learning/events/${encodeURIComponent(eventId)}`);
}

/* ------------------------------------------------------------------ */
/* QA / Compliance                                                     */
/* ------------------------------------------------------------------ */

export function scoreQA(
  ticketNumber: string,
): Promise<{ data: Record<string, unknown> }> {
  return request("/qa/score", {
    method: "POST",
    body: JSON.stringify({ ticket_number: ticketNumber }),
  });
}

/* ------------------------------------------------------------------ */
/* Tickets                                                             */
/* ------------------------------------------------------------------ */

export function fetchTickets(
  page = 1,
  search = "",
  status = "",
): Promise<Paginated<Record<string, string>>> {
  const params = new URLSearchParams({ page: String(page), search, status });
  return request(`/tickets?${params}`);
}
