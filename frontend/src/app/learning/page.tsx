"use client";

import { useEffect, useState } from "react";
import {
  Lightbulb,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  GitBranch,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  fetchLearningEvents,
  reviewEvent,
  generateDraft,
  scanForGaps,
  type LearningEvent,
  type KBDraft,
} from "@/lib/api";
import { Markdown } from "@/components/Markdown";
import { cn, statusColor, truncate } from "@/lib/utils";

type FilterStatus = "" | "Pending" | "Approved" | "Rejected";

export default function LearningPage() {
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterStatus>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<KBDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [editedDraftBody, setEditedDraftBody] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetchLearningEvents(filter, page)
      .then((res) => {
        setEvents(res.data);
        setTotal(res.meta.total);
      })
      .catch((e) => setError(e.message || "Failed to load events"))
      .finally(() => setLoading(false));
  }, [filter, page]);

  async function handleGenerateDraft(ticketNumber: string) {
    setDraftLoading(true);
    setDraft(null);
    setDraftError("");
    try {
      const res = await generateDraft(ticketNumber);
      setDraft(res.data);
      setEditedDraftBody(res.data.body);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Failed to generate draft");
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleReview(eventId: string, action: "approve" | "reject") {
    setReviewLoading(eventId);
    setReviewError("");
    try {
      const res = await reviewEvent(eventId, action, reviewNotes);
      setEvents((prev) =>
        prev.map((e) => (e.event_id === eventId ? { ...e, ...res.data } : e)),
      );
      setReviewNotes("");

      // Store approved KB ID in localStorage so the copilot can show a "NEW" badge
      if (action === "approve") {
        const kbId = res.data.proposed_kb_id;
        if (kbId) {
          try {
            const key = "speare-published-kb-ids";
            const existing = JSON.parse(localStorage.getItem(key) || "[]") as string[];
            if (!existing.includes(kbId)) {
              existing.push(kbId);
              localStorage.setItem(key, JSON.stringify(existing));
            }
          } catch { /* ignore localStorage errors */ }
        }
      }
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Review failed — please retry");
    } finally {
      setReviewLoading(null);
    }
  }

  const statusIcon = (status: string) => {
    if (status === "Approved") return <CheckCircle2 size={14} className="text-[var(--color-success)]" />;
    if (status === "Rejected") return <XCircle size={14} className="text-[var(--color-error)]" />;
    return <Clock size={14} className="text-[var(--color-warning)]" />;
  };

  return (
    <>
      <div className="mb-8 animate-fade-in">
        <p className="font-mono text-[10px] tracking-widest text-[var(--color-text-dim)]">SELF-LEARNING LOOP</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text)]">Learning Events</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Review detected knowledge gaps and approve or reject auto-generated KB drafts
        </p>
      </div>

      {/* Pipeline */}
      <div className="card mb-6 overflow-hidden animate-fade-in-delay-1">
        <div className="flex items-center justify-between px-6 py-6">
          {[
            { icon: Lightbulb, label: "Gap Detected", desc: "No KB match" },
            { icon: FileText, label: "Draft Generated", desc: "LLM extracts" },
            { icon: GitBranch, label: "Human Review", desc: "Approve / reject" },
            { icon: CheckCircle2, label: "Published", desc: "Indexed for RAG" },
          ].map(({ icon: Icon, label, desc }, i) => (
            <div key={label} className="flex items-center gap-5">
              <div className="text-center">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface-elevated)]">
                  <Icon size={15} className="text-[var(--color-text)]" />
                </div>
                <p className="mt-2 text-[11px] font-medium text-[var(--color-text)]">{label}</p>
                <p className="text-[9px] text-[var(--color-text-dim)]">{desc}</p>
              </div>
              {i < 3 && <div className="mb-6 h-px w-8 bg-[var(--color-border)]" />}
            </div>
          ))}
        </div>
      </div>

      {/* Scan for Gaps trigger */}
      <div className="card mb-6 flex items-center gap-4 p-4 animate-fade-in-delay-2">
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-text)]">Trigger the Self-Learning Loop</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Scan all resolved Tier 3 tickets for knowledge gaps. New gaps will appear as Pending events for human review.
          </p>
          {scanResult && (
            <p className="mt-2 text-xs font-medium text-[var(--color-success)]">{scanResult}</p>
          )}
        </div>
        <button
          onClick={async () => {
            setScanLoading(true);
            setScanResult(null);
            try {
              const res = await scanForGaps();
              setScanResult(res.message);
              // Reload events
              const evts = await fetchLearningEvents(filter, 1);
              setEvents(evts.data);
              setTotal(evts.meta.total);
              setPage(1);
            } catch (e) { setScanResult(`Scan failed: ${e instanceof Error ? e.message : "Unknown error"}`); }
            finally { setScanLoading(false); }
          }}
          disabled={scanLoading}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--color-text)] px-5 py-2.5 text-xs font-semibold text-[var(--color-bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {scanLoading ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
          Scan for Gaps
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        {(["", "Pending", "Approved", "Rejected"] as FilterStatus[]).map((s) => (
          <button
            key={s || "all"}
            onClick={() => { setFilter(s); setPage(1); }}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              filter === s
                ? "bg-[var(--color-text)] text-[var(--color-bg)]"
                : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)]",
            )}
          >
            {s || "All"} {s === "Pending" && total > 0 ? `(${events.filter(e => e.status === "Pending").length})` : ""}
          </button>
        ))}
        <span className="ml-auto text-xs text-[var(--color-text-muted)]">
          {total} events
        </span>
      </div>

      {/* Events list */}
      {error ? (
        <div className="card border-red-200 p-4 text-sm text-[var(--color-error)]">{error}</div>
      ) : loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : events.length === 0 ? (
        <div className="card flex h-32 items-center justify-center text-sm text-[var(--color-text-muted)]">
          No learning events found{filter ? ` with status "${filter}"` : ""}.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const isExpanded = expandedId === event.event_id;
            return (
                <div
                  key={event.event_id}
                  className="card"
                >
                {/* Event header */}
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : event.event_id);
                    setDraft(null);
                  }}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  {statusIcon(event.status)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      {truncate(event.detected_gap || event.draft_summary, 100)}
                    </p>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                        {event.event_id}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                        Ticket: {event.ticket_number}
                      </span>
                      {(event as unknown as Record<string, unknown>).best_kb_score !== undefined && (
                        <span className="font-mono text-[10px] text-[var(--color-error)]">
                          Best KB match: {(Number((event as unknown as Record<string, unknown>).best_kb_score) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", statusColor(event.status))}>
                    {event.status}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      "text-[var(--color-text-muted)] transition-transform",
                      isExpanded && "rotate-180",
                    )}
                  />
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-[var(--color-border)] p-4">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="font-medium text-[var(--color-text-muted)]">Detected Gap</p>
                        <p className="mt-1 text-[var(--color-text)]">{event.detected_gap}</p>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--color-text-muted)]">Draft Summary</p>
                        <p className="mt-1 text-[var(--color-text)]">{event.draft_summary}</p>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--color-text-muted)]">Proposed KB ID</p>
                        <p className="mt-1 font-mono text-[var(--color-text)]">{event.proposed_kb_id}</p>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--color-text-muted)]">Conversation</p>
                        <p className="mt-1 font-mono text-[var(--color-text)]">{event.conversation_id || "N/A"}</p>
                      </div>
                    </div>

                    {/* Generate draft button */}
                    {event.ticket_number && (
                      <div className="mt-4">
                        <button
                          onClick={() => handleGenerateDraft(event.ticket_number)}
                          disabled={draftLoading}
                          className="flex items-center gap-2 rounded-lg bg-[var(--color-text)] px-3 py-2 text-xs font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {draftLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <FileText size={14} />
                          )}
                          Generate KB Draft
                        </button>
                      </div>
                    )}

                    {draftError && expandedId === event.event_id && (
                      <p className="mt-2 text-xs text-[var(--color-error)]">{draftError}</p>
                    )}

                    {/* Draft preview — editable */}
                    {draft && expandedId === event.event_id && (
                      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-[10px] tracking-widest text-[var(--color-text-dim)]">GENERATED KB DRAFT — EDITABLE</p>
                          <span className="text-[9px] text-[var(--color-text-dim)]">Edit below before approving</span>
                        </div>
                        <p className="mt-2 text-base font-semibold text-[var(--color-text)]">{draft.title}</p>
                        <textarea
                          value={editedDraftBody}
                          onChange={(e) => setEditedDraftBody(e.target.value)}
                          className="mt-3 min-h-48 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-xs leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-text-dim)] focus:outline-none"
                          placeholder="Edit the draft body here..."
                        />

                        {/* Lineage */}
                        {draft.lineage.length > 0 && (
                          <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                            <p className="font-mono text-[9px] tracking-widest text-[var(--color-text-dim)]">
                              PROVENANCE TRAIL
                            </p>
                            {draft.lineage.map((l, i) => (
                              <div key={i} className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                                <GitBranch size={12} className="text-[var(--color-text-dim)]" />
                                <span className="font-mono text-[var(--color-text)]">{l.source_id}</span>
                                <span className="text-[var(--color-text-dim)]">({l.source_type} → {l.relationship})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Review actions */}
                    {event.status === "Pending" && (
                      <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                        <p className="mb-2 text-xs font-medium text-[var(--color-text)]">
                          Review Decision
                        </p>
                        {reviewError && (
                          <p className="mb-2 rounded-md bg-red-50 px-3 py-1.5 text-xs text-[var(--color-error)]">{reviewError}</p>
                        )}
                        <textarea
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder="Reviewer notes (optional)…"
                          className="mb-3 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReview(event.event_id, "approve")}
                            disabled={reviewLoading === event.event_id}
                            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-success)] px-4 py-2 text-xs font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {reviewLoading === event.event_id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            Approve & Publish
                          </button>
                          <button
                            onClick={() => handleReview(event.event_id, "reject")}
                            disabled={reviewLoading === event.event_id}
                            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-2 text-xs font-medium text-[var(--color-error)] transition-opacity hover:opacity-80 disabled:opacity-50"
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Already reviewed */}
                    {event.status !== "Pending" && event.reviewed_at && (
                      <div className="mt-4 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-muted)]">
                        Reviewed by {event.reviewer_role || "Human Reviewer"} on{" "}
                        {new Date(event.reviewed_at).toLocaleString()}
                        {event.review_notes && (
                          <p className="mt-1 italic">&quot;{event.review_notes}&quot;</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-[var(--color-text-muted)]">
            Page {page}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={events.length < 20}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
