"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertCircle, Trash2, Info, ExternalLink, ShieldCheck, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { askCopilot, reportGapFromCopilot, type CopilotResponse, type SourceDocument } from "@/lib/api";
import { cn, truncate, nodeColor } from "@/lib/utils";
import { Markdown } from "@/components/Markdown";

const STORAGE_KEY = "speare-copilot-history";
const PUBLISHED_KB_KEY = "speare-published-kb-ids";

interface Message {
  role: "user" | "assistant";
  content: string;
  response?: CopilotResponse;
  loading?: boolean;
}

/* ------------------------------------------------------------------ */
/* Processing stages — shows the RAG pipeline while the API is working */
/* ------------------------------------------------------------------ */
const STAGES = [
  { label: "Analyzing your question…", delay: 0 },
  { label: "Searching 3,200+ KB articles, 714 scripts, 400 tickets…", delay: 800 },
  { label: "Ranking sources by cosine similarity…", delay: 2000 },
  { label: "Generating grounded answer with LLM…", delay: 3500 },
];

function ProcessingStages() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const timers = STAGES.map((s, i) => {
      if (i === 0) return undefined;
      return setTimeout(() => setActiveStage(i), s.delay);
    });
    return () => timers.forEach((t) => t && clearTimeout(t));
  }, []);

  return (
    <div className="space-y-2 py-2">
      {STAGES.map((stage, i) => {
        const done = i < activeStage;
        const active = i === activeStage;
        const pending = i > activeStage;
        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2.5 transition-opacity duration-300",
              pending && "opacity-30",
            )}
          >
            {done ? (
              <CheckCircle2 size={13} className="shrink-0 text-[var(--color-success)]" />
            ) : active ? (
              <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--color-text)] border-t-transparent" />
            ) : (
              <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--color-border)]" />
            )}
            <span className={cn(
              "font-mono text-[10px]",
              done ? "text-[var(--color-success)]" : active ? "text-[var(--color-text)]" : "text-[var(--color-text-dim)]",
            )}>
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Source card — links to KB article page, shows NEW badge if recently */
/* published through the self-learning loop                            */
/* ------------------------------------------------------------------ */
function SourceCard({ source, publishedIds }: { source: SourceDocument; publishedIds: Set<string> }) {
  const color = nodeColor(source.doc_type);
  const typeLabel = source.doc_type === "kb_article" ? "KB Article" : source.doc_type === "script" ? "Script" : "Ticket";
  const isKB = source.doc_type === "kb_article";
  const isNew = publishedIds.has(source.id);

  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{typeLabel}</span>
        {isNew && (
          <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 font-mono text-[8px] font-bold text-[var(--color-success)]">
            <Sparkles size={8} /> NEW
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-[var(--color-text-dim)]">{((source.score ?? 0) * 100).toFixed(0)}%</span>
      </div>
      <p className="mt-1.5 text-xs font-medium text-[var(--color-text)]">{source.title || source.id}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">{truncate(source.snippet, 180)}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="font-mono text-[9px] text-[var(--color-text-dim)]">{source.id}</span>
        {isKB && <ExternalLink size={9} className="ml-auto text-[var(--color-text-dim)]" />}
      </div>
    </>
  );

  if (isKB) {
    return (
      <Link
        href={`/knowledge/${encodeURIComponent(source.id)}`}
        className={cn(
          "block rounded-lg border p-3 transition-colors hover:border-[var(--color-text-dim)]",
          isNew ? "border-[var(--color-success)]/40 bg-green-50/50" : "border-[var(--color-border)] bg-[var(--color-surface-elevated)]",
        )}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
      {inner}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */
export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [gapReported, setGapReported] = useState<number | null>(null);
  const [reportingGap, setReportingGap] = useState<number | null>(null);
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);

  // Load published KB IDs from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PUBLISHED_KB_KEY);
      if (raw) setPublishedIds(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);

  // Load chat history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        setMessages(parsed.filter(m => !m.loading));
      }
    } catch { /* ignore */ }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (messages.length > 0 && !messages.some(m => m.loading)) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
    }
  }, [messages]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function clearHistory() {
    setMessages([]);
    setGapReported(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  function fillQuestion(q: string) {
    setInput(q);
  }

  async function handleSend() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((p) => [...p, { role: "user", content: q }]);
    setLoading(true);
    setMessages((p) => [...p, { role: "assistant", content: "", loading: true }]);

    try {
      const res = await askCopilot(q);
      setMessages((p) => { const n = [...p]; n[n.length - 1] = { role: "assistant", content: res.answer, response: res }; return n; });
    } catch (e) {
      setMessages((p) => { const n = [...p]; n[n.length - 1] = { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Unknown"}` }; return n; });
    } finally { setLoading(false); }
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      {/* Header */}
      <div className="shrink-0 animate-fade-in pb-4">
        <p className="font-mono text-[10px] tracking-widest text-[var(--color-text-dim)]">AI COPILOT</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text)]">Ask Speare</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Answers grounded in KB articles, scripts, and resolved tickets</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInfo(v => !v)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
              <Info size={14} />
            </button>
            {messages.length > 0 && (
              <button onClick={clearHistory} className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* How it works + guardrails panel */}
      {showInfo && (
        <div className="card mb-4 shrink-0 animate-fade-in p-5">
          <p className="font-mono text-[10px] tracking-widest text-[var(--color-text-dim)]">HOW THE COPILOT WORKS</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            The Copilot is a <strong className="text-[var(--color-text)]">RAG-powered support assistant</strong> for agents.
            It does <em>not</em> create tickets — it helps agents who already have a ticket find the right answer.
          </p>
          <div className="mt-3 space-y-2 text-[12px] text-[var(--color-text-muted)]">
            <p><span className="font-mono text-[var(--color-text)]">1.</span> Agent receives a customer ticket (from Salesforce, Zendesk, etc.)</p>
            <p><span className="font-mono text-[var(--color-text)]">2.</span> Agent pastes the question here — Copilot searches 3,200+ KB articles, 714 scripts, 400 resolved tickets</p>
            <p><span className="font-mono text-[var(--color-text)]">3.</span> If confidence is low (&lt;50%), agent can <strong className="text-[var(--color-text)]">report it as a knowledge gap</strong> — triggers the self-learning loop</p>
            <p><span className="font-mono text-[var(--color-text)]">4.</span> That gap flows to the Learning page — human reviewer approves a new KB article — next time, Copilot answers correctly</p>
          </div>
          <p className="mt-3 text-[11px] text-[var(--color-text-dim)]">
            Chat history is saved locally in your browser.
          </p>
          <div className="mt-4 border-t border-[var(--color-border)] pt-3">
            <p className="font-mono text-[10px] tracking-widest text-[var(--color-text-dim)]">GUARDRAILS ACTIVE</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              {[
                { label: "Prompt injection detection", ref: "LLM01" },
                { label: "Output sanitization", ref: "LLM02" },
                { label: "PII/PCI data masking", ref: "PCI-DSS" },
                { label: "Grounded answers only (RAG)", ref: "RAG" },
                { label: "Confidence thresholding", ref: "35% min" },
                { label: "Human gap review loop", ref: "HITL" },
              ].map(({ label, ref }) => (
                <div key={ref} className="flex items-center gap-1.5">
                  <ShieldCheck size={10} className="shrink-0 text-[var(--color-success)]" />
                  <span className="text-[var(--color-text-muted)]">{label}</span>
                  <span className="ml-auto font-mono text-[9px] text-[var(--color-text-dim)]">{ref}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-6 pb-4">
          {/* Empty state with demo suggestions */}
          {messages.length === 0 && (
            <div className="flex h-[50vh] items-center justify-center">
              <div className="w-full max-w-lg text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface-elevated)]">
                  <Bot size={24} strokeWidth={1.2} className="text-[var(--color-text-dim)]" />
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">Ask a support question to get started</p>

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => fillQuestion("How do I advance the property date?")}
                    className="rounded-lg border border-[var(--color-border)] p-3 text-left transition-colors hover:border-[var(--color-text-dim)]"
                  >
                    <p className="text-[10px] font-medium text-[var(--color-success)]">HIGH CONFIDENCE</p>
                    <p className="mt-1 text-xs text-[var(--color-text)]">How do I advance the property date?</p>
                    <p className="mt-1 text-[10px] text-[var(--color-text-dim)]">Well-covered in KB</p>
                  </button>
                  <button
                    onClick={() => fillQuestion("How do I handle a batch payment reconciliation failure in HAP?")}
                    className="rounded-lg border border-[var(--color-border)] p-3 text-left transition-colors hover:border-[var(--color-text-dim)]"
                  >
                    <p className="text-[10px] font-medium text-[var(--color-warning)]">SELF-LEARNING DEMO</p>
                    <p className="mt-1 text-xs text-[var(--color-text)]">How do I handle a batch payment reconciliation failure in HAP?</p>
                    <p className="mt-1 text-[10px] text-[var(--color-text-dim)]">Likely low confidence — try the learning loop</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3", msg.role === "user" && "justify-end")}>
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-text)]">
                  <Bot size={13} className="text-[var(--color-bg)]" />
                </div>
              )}
              <div className={cn("max-w-2xl", msg.role === "user" && "rounded-2xl bg-[var(--color-surface-elevated)] px-4 py-2.5 text-sm text-[var(--color-text)]")}>
                {msg.loading ? (
                  <ProcessingStages />
                ) : msg.role === "assistant" ? (
                  <div>
                    {msg.response && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-mono text-[10px] font-semibold",
                            msg.response.confidence >= 0.5 ? "text-[var(--color-success)]" :
                            msg.response.confidence >= 0.3 ? "text-[var(--color-warning)]" : "text-[var(--color-error)]",
                          )}>{(msg.response.confidence * 100).toFixed(0)}% confidence</span>
                          <span className="font-mono text-[10px] text-[var(--color-text-dim)]">{msg.response.answer_type}</span>
                        </div>
                        {msg.response.confidence_details && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[var(--color-surface-elevated)] px-2.5 py-1.5 font-mono text-[9px] text-[var(--color-text-dim)]">
                            <span>Cosine similarity</span>
                            <span>Threshold: {(msg.response.confidence_details.threshold * 100).toFixed(0)}%</span>
                            <span>Top match: {(msg.response.confidence_details.top_match_score * 100).toFixed(0)}%</span>
                            <span>{msg.response.confidence_details.sources_searched} sources evaluated</span>
                            {msg.response.confidence_details.is_below_threshold && (
                              <span className="text-[var(--color-error)]">Below threshold — knowledge gap likely</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Render answer with proper Markdown */}
                    <Markdown content={msg.content} />

                    {/* Gap report + demo hint */}
                    {msg.response && msg.response.confidence < 0.5 && (
                      <div className="mt-4">
                        {gapReported === i ? (
                          <div className="rounded-lg bg-green-50 p-3">
                            <div className="flex items-center gap-1.5 font-mono text-[10px] font-medium text-[var(--color-success)]">
                              <CheckCircle2 size={12} />
                              Gap reported successfully
                            </div>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                              Next step: Go to the <Link href="/learning" className="font-medium text-[var(--color-text)] underline">Learning page</Link> to
                              review and approve the KB draft. Then return here and re-ask the same question — the confidence will improve.
                            </p>
                          </div>
                        ) : (
                          <div>
                            <button
                              disabled={reportingGap === i}
                              onClick={async () => {
                                setReportingGap(i);
                                try {
                                  const q = messages.filter(m => m.role === "user").pop()?.content ?? "";
                                  await reportGapFromCopilot(q, msg.response?.confidence ?? 0);
                                  setGapReported(i);
                                } catch {
                                  /* Show inline error if needed */
                                } finally {
                                  setReportingGap(null);
                                }
                              }}
                              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-1.5 font-mono text-[10px] text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/20 disabled:opacity-50"
                            >
                              {reportingGap === i ? (
                                <div className="h-3 w-3 animate-spin rounded-full border border-[var(--color-warning)] border-t-transparent" />
                              ) : (
                                <AlertCircle size={12} />
                              )}
                              Report as knowledge gap
                            </button>
                            <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-text-dim)]">
                              Demo tip: Report this gap, then go to Learning to generate and approve a KB draft. Return and re-ask — confidence will improve.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sources */}
                    {msg.response && msg.response.sources.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 font-mono text-[9px] tracking-widest text-[var(--color-text-dim)]">SOURCES</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {msg.response.sources.map((src) => (
                            <SourceCard key={src.id} source={src} publishedIds={publishedIds} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : <span>{msg.content}</span>}
              </div>
              {msg.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
                  <User size={13} className="text-[var(--color-text-muted)]" />
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--color-border)] pt-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a support question…"
            className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-text-dim)] focus:outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-text)] text-[var(--color-bg)] transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
