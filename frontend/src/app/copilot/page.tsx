"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertCircle, Trash2, Info, ExternalLink } from "lucide-react";
import Link from "next/link";
import { askCopilot, reportGapFromCopilot, type CopilotResponse, type SourceDocument } from "@/lib/api";
import { cn, truncate, nodeColor } from "@/lib/utils";

const STORAGE_KEY = "speare-copilot-history";

interface Message {
  role: "user" | "assistant";
  content: string;
  response?: CopilotResponse;
  loading?: boolean;
}

function SourceCard({ source }: { source: SourceDocument }) {
  const color = nodeColor(source.doc_type);
  const typeLabel = source.doc_type === "kb_article" ? "KB Article" : source.doc_type === "script" ? "Script" : "Ticket";
  const isKB = source.doc_type === "kb_article";

  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{typeLabel}</span>
        <span className="ml-auto font-mono text-[10px] text-[var(--color-text-dim)]">{(source.score * 100).toFixed(0)}%</span>
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
        className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 transition-colors hover:border-[var(--color-text-dim)]"
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

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
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
    localStorage.removeItem(STORAGE_KEY);
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

      {/* How it works panel */}
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
        </div>
      )}

      {/* Messages area - scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-6 pb-4">
          {messages.length === 0 && (
            <div className="flex h-[50vh] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface)]">
                  <Bot size={24} strokeWidth={1.2} className="text-[var(--color-text-dim)]" />
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">Ask a support question</p>
                <p className="mt-3 font-mono text-[10px] text-[var(--color-text-dim)]">
                  Try: &quot;How do I advance the property date?&quot;
                </p>
                <p className="mt-1 font-mono text-[10px] text-[var(--color-text-dim)]">
                  Try: &quot;What script fixes a voucher processing error?&quot;
                </p>
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
                  <div className="flex items-center gap-2 py-2">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-text)] border-t-transparent" />
                    <span className="font-mono text-[10px] text-[var(--color-text-muted)]">Searching…</span>
                  </div>
                ) : msg.role === "assistant" ? (
                  <div>
                    {msg.response && (
                      <div className="mb-2 flex items-center gap-2">
                        <span className={cn("font-mono text-[10px]",
                          msg.response.confidence >= 0.5 ? "text-[var(--color-success)]" :
                          msg.response.confidence >= 0.3 ? "text-[var(--color-warning)]" : "text-[var(--color-error)]",
                        )}>{(msg.response.confidence * 100).toFixed(0)}%</span>
                        <span className="font-mono text-[10px] text-[var(--color-text-dim)]">{msg.response.answer_type}</span>
                      </div>
                    )}
                    <div className="text-[13px] leading-relaxed text-[var(--color-text)]">
                      {msg.content.split("\n").map((line, j) => (
                        <p key={j} className={cn("mt-1", line.startsWith("**") && "font-semibold")}>{line}</p>
                      ))}
                    </div>
                    {msg.response && msg.response.confidence < 0.5 && (
                      <button
                        onClick={async () => {
                          const q = messages.filter(m => m.role === "user").pop()?.content ?? "";
                          await reportGapFromCopilot(q, msg.response!.confidence);
                          alert("Gap reported — check the Learning page.");
                        }}
                        className="mt-3 flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-1.5 font-mono text-[10px] text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/20"
                      >
                        <AlertCircle size={12} />
                        Report as knowledge gap
                      </button>
                    )}
                    {msg.response && msg.response.sources.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 font-mono text-[9px] tracking-widest text-[var(--color-text-dim)]">SOURCES</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {msg.response.sources.map((src) => (
                            <SourceCard key={src.id} source={src} />
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

      {/* Input - pinned to bottom */}
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
