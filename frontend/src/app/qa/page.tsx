"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react";
import { fetchTickets, scoreQA, type Paginated } from "@/lib/api";
import { cn, truncate } from "@/lib/utils";

interface OWASPFinding {
  category: string;
  severity: string;
  description: string;
  owasp_ref: string;
}

interface QAResult {
  ticket_number: string;
  Evaluation_Mode?: string;
  Interaction_QA?: Record<string, unknown>;
  Case_QA?: Record<string, unknown>;
  Red_Flags?: Record<string, { score: string; evidence?: string }>;
  owasp_checks?: {
    compliant: boolean;
    findings: OWASPFinding[];
    checks_run: string[];
    owasp_frameworks: string[];
  };
  Overall_Weighted_Score?: string;
  Contact_Summary?: string;
  Case_Summary?: string;
  QA_Recommendation?: string;
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-800 border-red-200",
    HIGH: "bg-orange-100 text-orange-800 border-orange-200",
    MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
    LOW: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", styles[severity] ?? styles.LOW)}>
      {severity}
    </span>
  );
}

function QASection({ title, data }: { title: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([k]) => k !== "Final_Weighted_Score");
  const score = data.Final_Weighted_Score as string | undefined;

  return (
    <div className="rounded-md border border-[var(--color-border)] p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[var(--color-text)]">{title}</h4>
        {score && score !== "N/A" && (
          <span className="rounded-full bg-[var(--color-accent)] px-2.5 py-0.5 text-[11px] font-semibold text-white">
            {score}
          </span>
        )}
      </div>
      {entries.length > 0 && (
        <div className="mt-3 space-y-2">
          {entries.map(([key, val]) => {
            const item = val as { score?: string; evidence?: string; tracking_items?: string[] } | string;
            const itemScore = typeof item === "object" ? item?.score : item;
            const evidence = typeof item === "object" ? item?.evidence : "";
            return (
              <div key={key} className="flex items-start gap-2 text-[11px]">
                {itemScore === "Yes" ? (
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                ) : itemScore === "No" ? (
                  <XCircle size={13} className="mt-0.5 shrink-0 text-red-500" />
                ) : (
                  <div className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-neutral-200" />
                )}
                <div>
                  <span className="text-[var(--color-text)]">{key.replace(/_/g, " ")}</span>
                  {evidence && (
                    <p className="mt-0.5 text-[10px] italic text-[var(--color-text-muted)]">
                      {truncate(String(evidence), 150)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function QAPage() {
  const [tickets, setTickets] = useState<Record<string, string>[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [qaResult, setQAResult] = useState<QAResult | null>(null);

  useEffect(() => {
    fetchTickets(page, search, "Closed")
      .then((res: Paginated<Record<string, string>>) => {
        setTickets(res.data);
        setTotal(res.meta.total);
      })
      .catch(() => {});
  }, [page, search]);

  async function handleScore(ticketNumber: string) {
    setSelectedTicket(ticketNumber);
    setScoring(true);
    setQAResult(null);
    try {
      const res = await scoreQA(ticketNumber);
      setQAResult(res.data as unknown as QAResult);
    } catch {
      // Silently handle
    } finally {
      setScoring(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">QA & Compliance</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Score interactions for quality and scan for OWASP compliance violations
        </p>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Ticket selection */}
        <div className="col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Closed Tickets</h2>
            <span className="text-xs text-[var(--color-text-muted)]">({total})</span>
          </div>

          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search tickets…"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-3 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div className="max-h-[calc(100vh-18rem)] space-y-1.5 overflow-y-auto">
            {tickets.map((tk) => (
              <button
                key={tk.Ticket_Number}
                onClick={() => handleScore(tk.Ticket_Number)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-md border p-3 text-left transition-colors",
                  selectedTicket === tk.Ticket_Number
                    ? "border-[var(--color-accent)] bg-neutral-50"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-neutral-50",
                )}
              >
                <FileText size={14} strokeWidth={1.6} className="mt-0.5 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--color-text)]">
                    {truncate(tk.Subject || tk.Ticket_Number, 60)}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                    {tk.Ticket_Number}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* QA Results */}
        <div className="col-span-3">
          {scoring ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <Loader2 size={24} className="animate-spin text-[var(--color-accent)]" />
              <p className="text-xs text-[var(--color-text-muted)]">Scoring interaction & checking compliance…</p>
            </div>
          ) : qaResult ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">
                      QA Score: {qaResult.ticket_number}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      Mode: {qaResult.Evaluation_Mode || "N/A"}
                    </p>
                  </div>
                  {qaResult.Overall_Weighted_Score && qaResult.Overall_Weighted_Score !== "N/A" && (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)]">
                      <span className="text-sm font-bold text-white">{qaResult.Overall_Weighted_Score}</span>
                    </div>
                  )}
                </div>

                {qaResult.QA_Recommendation && (
                  <div className="mt-3 rounded-md bg-neutral-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      Recommendation
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text)]">{qaResult.QA_Recommendation}</p>
                  </div>
                )}

                {qaResult.Contact_Summary && (
                  <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
                    {qaResult.Contact_Summary}
                  </p>
                )}
              </div>

              {/* QA Sections */}
              {qaResult.Interaction_QA && Object.keys(qaResult.Interaction_QA).length > 0 && (
                <QASection title="Interaction QA" data={qaResult.Interaction_QA as Record<string, unknown>} />
              )}
              {qaResult.Case_QA && Object.keys(qaResult.Case_QA).length > 0 && (
                <QASection title="Case QA" data={qaResult.Case_QA as Record<string, unknown>} />
              )}

              {/* Red Flags */}
              {qaResult.Red_Flags && (
                <div className="rounded-md border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={16} className="text-red-600" />
                    <h4 className="text-xs font-semibold text-red-800">Red Flags (Autozero)</h4>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {Object.entries(qaResult.Red_Flags).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 text-[11px]">
                        {val.score === "Yes" ? (
                          <XCircle size={13} className="text-red-600" />
                        ) : (
                          <CheckCircle2 size={13} className="text-emerald-500" />
                        )}
                        <span className={val.score === "Yes" ? "font-medium text-red-800" : "text-red-700"}>
                          {key.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OWASP Compliance */}
              {qaResult.owasp_checks && (
                <div className={cn(
                  "rounded-md border p-4",
                  qaResult.owasp_checks.compliant
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50",
                )}>
                  <div className="flex items-center gap-2">
                    {qaResult.owasp_checks.compliant ? (
                      <ShieldCheck size={16} className="text-emerald-600" />
                    ) : (
                      <ShieldAlert size={16} className="text-red-600" />
                    )}
                    <h4 className={cn(
                      "text-xs font-semibold",
                      qaResult.owasp_checks.compliant ? "text-emerald-800" : "text-red-800",
                    )}>
                      OWASP Compliance {qaResult.owasp_checks.compliant ? "— Passed" : "— Violations Found"}
                    </h4>
                  </div>

                  {/* Frameworks */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {qaResult.owasp_checks.owasp_frameworks.map((fw) => (
                      <span key={fw} className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-medium">
                        {fw}
                      </span>
                    ))}
                  </div>

                  {/* Checks run */}
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      Checks Performed
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {qaResult.owasp_checks.checks_run.map((check) => (
                        <span key={check} className="flex items-center gap-1 text-[11px]">
                          <CheckCircle2 size={11} className="text-emerald-500" />
                          {check}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Findings */}
                  {qaResult.owasp_checks.findings.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600">
                        Findings
                      </p>
                      {qaResult.owasp_checks.findings.map((f, i) => (
                        <div key={i} className="rounded-md bg-white/60 p-2.5">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={12} className="text-red-500" />
                            <span className="text-[11px] font-medium text-red-800">{f.category}</span>
                            <SeverityBadge severity={f.severity} />
                          </div>
                          <p className="mt-1 text-[11px] text-red-700">{f.description}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-red-500">{f.owasp_ref}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <ShieldCheck size={28} strokeWidth={1.2} className="text-[var(--color-text-muted)]" />
              <p className="text-sm text-[var(--color-text-muted)]">Select a ticket to score</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                QA scoring uses the provided rubric + OWASP compliance checks
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
