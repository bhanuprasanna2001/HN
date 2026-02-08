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

  useEffect(() => {
    setLoading(true);
    fetchLearningEvents(filter, page)
      .then((res) => {
        setEvents(res.data);
        setTotal(res.meta.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, page]);

  async function handleGenerateDraft(ticketNumber: string) {
    setDraftLoading(true);
    setDraft(null);
    try {
      const res = await generateDraft(ticketNumber);
      setDraft(res.data);
    } catch {
      // Silently handle
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleReview(eventId: string, action: "approve" | "reject") {
    setReviewLoading(eventId);
    try {
      const res = await reviewEvent(eventId, action, reviewNotes);
      setEvents((prev) =>
        prev.map((e) => (e.event_id === eventId ? { ...e, ...res.data } : e)),
      );
      setReviewNotes("");
    } catch {
      // Silently handle
    } finally {
      setReviewLoading(null);
    }
  }

  const statusIcon = (status: string) => {
    if (status === "Approved") return <CheckCircle2 size={14} className="text-emerald-600" />;
    if (status === "Rejected") return <XCircle size={14} className="text-red-600" />;
    return <Clock size={14} className="text-amber-600" />;
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Self-Learning Loop</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Review detected knowledge gaps and approve or reject auto-generated KB drafts
        </p>
      </div>

      {/* Pipeline visualization */}
      <div className="mb-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          {[
            { icon: Lightbulb, label: "Gap Detected", desc: "Tier 3 ticket resolved, no KB match" },
            { icon: FileText, label: "Draft Generated", desc: "LLM creates KB article from resolution" },
            { icon: GitBranch, label: "Human Review", desc: "Reviewer approves or rejects with notes" },
            { icon: CheckCircle2, label: "Published", desc: "Article indexed for future retrieval" },
          ].map(({ icon: Icon, label, desc }, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)]">
                  <Icon size={16} className="text-white" />
                </div>
                <p className="mt-2 text-xs font-medium text-[var(--color-text)]">{label}</p>
                <p className="mt-0.5 max-w-32 text-center text-[10px] text-[var(--color-text-muted)]">{desc}</p>
              </div>
              {i < 3 && (
                <div className="mb-8 h-px w-12 bg-[var(--color-border)]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scan for Gaps trigger */}
      <div className="card mb-6 flex items-center gap-4 border-purple-200 bg-purple-50/50 p-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-text)]">Trigger the Self-Learning Loop</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Scan all resolved Tier 3 tickets for knowledge gaps. New gaps will appear as Pending events for human review.
          </p>
          {scanResult && (
            <p className="mt-2 text-xs font-medium text-emerald-700">{scanResult}</p>
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
            } catch { setScanResult("Scan failed"); }
            finally { setScanLoading(false); }
          }}
          disabled={scanLoading}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-purple-200/50 transition-all hover:shadow-lg disabled:opacity-50"
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
                ? "bg-[var(--color-accent)] text-white"
                : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-neutral-50",
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
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const isExpanded = expandedId === event.event_id;
            return (
              <div
                key={event.event_id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
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
                          className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
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

                    {/* Draft preview */}
                    {draft && expandedId === event.event_id && (
                      <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
                        <p className="text-xs font-semibold text-blue-800">Generated KB Draft</p>
                        <p className="mt-2 text-base font-semibold text-[var(--color-text)]">{draft.title}</p>
                        <div className="mt-3 max-h-64 overflow-y-auto rounded-md bg-white p-4">
                          <Markdown content={draft.body} />
                        </div>

                        {/* Lineage */}
                        {draft.lineage.length > 0 && (
                          <div className="mt-3 border-t border-blue-200 pt-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
                              Provenance Trail
                            </p>
                            {draft.lineage.map((l, i) => (
                              <div key={i} className="mt-1 flex items-center gap-2 text-[11px] text-blue-700">
                                <GitBranch size={12} />
                                <span className="font-mono">{l.source_id}</span>
                                <span className="text-blue-400">({l.source_type} → {l.relationship})</span>
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
                            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
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
                            className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
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
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-neutral-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-[var(--color-text-muted)]">
            Page {page}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={events.length < 20}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-neutral-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
