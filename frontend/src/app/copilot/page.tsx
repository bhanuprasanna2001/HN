"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, FileText, ExternalLink, AlertCircle } from "lucide-react";
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
  const typeLabel =
    source.doc_type === "kb_article" ? "KB Article" :
    source.doc_type === "script" ? "Script" : "Ticket";

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
          {typeLabel}
        </span>
        <span className="ml-auto text-[11px] font-mono text-[var(--color-text-muted)]">
          {(source.score * 100).toFixed(0)}% match
        </span>
      </div>
      <p className="mt-1.5 text-xs font-medium text-[var(--color-text)]">
        {source.title || source.id}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        {truncate(source.snippet, 200)}
      </p>
      <p className="mt-1.5 font-mono text-[10px] text-[var(--color-text-muted)]">
        ID: {source.id}
      </p>
    </div>
  );
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", loading: true },
    ]);

    try {
      const response = await askCopilot(question);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: response.answer,
          response,
        };
        return next;
      });
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">AI Copilot</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Ask questions — answers are grounded in KB articles, scripts, and resolved tickets
        </p>
      </div>

      {/* Chat area */}
      <div className="flex h-[calc(100vh-14rem)] flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        {/* Messages */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Bot size={32} strokeWidth={1.2} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
                <p className="text-sm text-[var(--color-text-muted)]">
                  Ask a support question to get started
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  e.g. &quot;How do I advance the property date in PropertySuite Affordable?&quot;
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3", msg.role === "user" && "justify-end")}>
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]">
                  <Bot size={14} className="text-white" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-2xl",
                  msg.role === "user" && "rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm text-white",
                )}
              >
                {msg.loading ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
                    <span className="text-xs text-[var(--color-text-muted)]">Searching knowledge base…</span>
                  </div>
                ) : msg.role === "assistant" ? (
                  <div>
                    {/* Confidence badge */}
                    {msg.response && (
                      <div className="mb-2 flex items-center gap-2">
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          msg.response.confidence >= 0.5
                            ? "bg-emerald-50 text-emerald-700"
                            : msg.response.confidence >= 0.3
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700",
                        )}>
                          {(msg.response.confidence * 100).toFixed(0)}% confidence
                        </span>
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                          {msg.response.answer_type}
                        </span>
                      </div>
                    )}

                    <div className="prose prose-sm max-w-none text-[13px] leading-relaxed text-[var(--color-text)]">
                      {msg.content.split("\n").map((line, j) => (
                        <p key={j} className={line.startsWith("**") ? "font-medium" : ""}>
                          {line}
                        </p>
                      ))}
                    </div>

                    {/* Low confidence — report gap */}
                    {msg.response && msg.response.confidence < 0.5 && (
                      <button
                        onClick={async () => {
                          const q = messages.filter(m => m.role === "user").pop()?.content ?? "";
                          await reportGapFromCopilot(q, msg.response!.confidence);
                          alert("Knowledge gap reported! Check the Learning page to review it.");
                        }}
                        className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100"
                      >
                        <AlertCircle size={13} />
                        Low confidence — Report as knowledge gap
                      </button>
                    )}

                    {/* Source documents */}
                    {msg.response && msg.response.sources.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                          Sources
                        </p>
                        {msg.response.sources.map((src) => (
                          <SourceCard key={src.id} source={src} />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200">
                  <User size={14} className="text-[var(--color-text)]" />
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--color-border)] p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a support question…"
              className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-accent)] text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
