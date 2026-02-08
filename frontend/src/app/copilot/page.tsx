"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertCircle } from "lucide-react";
import { askCopilot, reportGapFromCopilot, type CopilotResponse, type SourceDocument } from "@/lib/api";
import { cn, truncate, nodeColor } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  response?: CopilotResponse;
  loading?: boolean;
}

function SourceCard({ source }: { source: SourceDocument }) {
  const color = nodeColor(source.doc_type);
  const typeLabel = source.doc_type === "kb_article" ? "KB" : source.doc_type === "script" ? "Script" : "Ticket";

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{typeLabel}</span>
        <span className="ml-auto font-mono text-[10px] text-[var(--color-text-dim)]">{(source.score * 100).toFixed(0)}%</span>
      </div>
      <p className="mt-1.5 text-xs font-medium text-[var(--color-text)]">{source.title || source.id}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">{truncate(source.snippet, 180)}</p>
      <p className="mt-1 font-mono text-[9px] text-[var(--color-text-dim)]">{source.id}</p>
    </div>
  );
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
    <>
      <div className="mb-6 animate-fade-in">
        <p className="font-mono text-[10px] tracking-widest text-[var(--color-text-dim)]">AI COPILOT</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text)]">Ask SupportMind</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Answers grounded in KB articles, scripts, and resolved tickets</p>
      </div>

      <div className="card flex h-[calc(100vh-13rem)] flex-col overflow-hidden animate-fade-in-delay-1">
        {/* Messages */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Bot size={28} strokeWidth={1.2} className="mx-auto mb-3 text-[var(--color-text-dim)]" />
                <p className="text-sm text-[var(--color-text-muted)]">Ask a support question</p>
                <p className="mt-1 font-mono text-[10px] text-[var(--color-text-dim)]">
                  e.g. &quot;How do I advance the property date?&quot;
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
              <div className={cn("max-w-2xl", msg.role === "user" && "rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text)]")}>
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
                        )}>{(msg.response.confidence * 100).toFixed(0)}% confidence</span>
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
                      <div className="mt-4 space-y-2">
                        <p className="font-mono text-[9px] tracking-widest text-[var(--color-text-dim)]">SOURCES</p>
                        {msg.response.sources.map((src) => <SourceCard key={src.id} source={src} />)}
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

        {/* Input */}
        <div className="border-t border-[var(--color-border)] p-4">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a support question…"
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-text-dim)] focus:outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-text)] text-[var(--color-bg)] transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
