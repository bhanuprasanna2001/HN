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
  ChevronLeft,
  ChevronRight,
  Info,
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
  return <span className={cn("badge border", styles[severity] ?? styles.LOW)}>{severity}</span>;
}

function ScoreRing({ score }: { score: string }) {
  const num = parseInt(score) || 0;
  const color = num >= 80 ? "#16A34A" : num >= 60 ? "#F59E0B" : "#DC2626";
  const circ = 2 * Math.PI * 24;
  const off = circ - (num / 100) * circ;
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <svg className="absolute" width={56} height={56} viewBox="0 0 56 56">
        <circle cx={28} cy={28} r={24} fill="none" stroke="#F0F0F0" strokeWidth={3} />
        <circle cx={28} cy={28} r={24} fill="none" stroke={color} strokeWidth={3}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
          transform="rotate(-90 28 28)" style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      </svg>
      <span className="text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function QASection({ title, data, accentClass }: { title: string; data: Record<string, unknown>; accentClass: string }) {
  const entries = Object.entries(data).filter(([k]) => k !== "Final_Weighted_Score");
  const score = data.Final_Weighted_Score as string | undefined;
  if (entries.length === 0 && (!score || score === "N/A")) return null;

  const yesCount = entries.filter(([, v]) => (v as { score?: string })?.score === "Yes").length;
  const noCount = entries.filter(([, v]) => (v as { score?: string })?.score === "No").length;

  return (
    <div className="card overflow-hidden">
      <div className={cn("flex items-center justify-between px-5 py-3", accentClass)}>
        <div>
          <h4 className="text-sm font-bold text-[var(--color-text)]">{title}</h4>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            {yesCount} passed · {noCount} failed · {entries.length - yesCount - noCount} N/A
          </p>
        </div>
        {score && score !== "N/A" && <ScoreRing score={score} />}
      </div>
      <div className="grid grid-cols-2 divide-x divide-[var(--color-border)]">
        <div className="divide-y divide-[var(--color-border)]">
          {entries.slice(0, Math.ceil(entries.length / 2)).map(([key, val]) => (
            <CriteriaRow key={key} label={key} val={val} />
          ))}
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {entries.slice(Math.ceil(entries.length / 2)).map(([key, val]) => (
            <CriteriaRow key={key} label={key} val={val} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CriteriaRow({ label, val }: { label: string; val: unknown }) {
  const item = val as { score?: string; evidence?: string } | string;
  const s = typeof item === "object" ? item?.score : String(item);
  const ev = typeof item === "object" ? item?.evidence : "";
  return (
    <div className="flex items-start gap-2.5 px-4 py-2.5">
      {s === "Yes" ? (
        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
      ) : s === "No" ? (
        <XCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
      ) : (
        <div className="mt-0.5 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[8px] text-neutral-500">–</div>
      )}
      <div className="min-w-0 flex-1">
        <span className="text-[12px] font-medium text-[var(--color-text)]">{label.replace(/_/g, " ")}</span>
        {ev && <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-muted)]">{truncate(String(ev), 120)}</p>}
      </div>
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
      .then((res: Paginated<Record<string, string>>) => { setTickets(res.data); setTotal(res.meta.total); })
      .catch(() => {});
  }, [page, search]);

  async function handleScore(ticketNumber: string) {
    setSelectedTicket(ticketNumber);
    setScoring(true);
    setQAResult(null);
    try {
      const res = await scoreQA(ticketNumber);
      setQAResult(res.data as unknown as QAResult);
    } catch { /* handle */ } finally { setScoring(false); }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <>
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">QA & Compliance</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Score interactions for quality using the QA rubric and scan for OWASP compliance violations
        </p>
      </div>

      {/* Ticket selector — horizontal strip at top */}
      <div className="card mb-6 animate-fade-in-delay-1 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="text-sm font-bold text-[var(--color-text)]">Select a Ticket to Score</h2>
          <span className="badge bg-neutral-100 text-[var(--color-text-muted)]">{total} closed</span>
          <div className="relative ml-auto w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search tickets…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-3 text-xs placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto p-3">
          {tickets.map((tk) => (
            <button
              key={tk.Ticket_Number}
              onClick={() => handleScore(tk.Ticket_Number)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all",
                selectedTicket === tk.Ticket_Number
                  ? "border-[var(--color-primary)] bg-purple-50 shadow-sm"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-neutral-50",
              )}
            >
              <FileText size={13} className={cn("shrink-0", selectedTicket === tk.Ticket_Number ? "text-[var(--color-primary)]" : "text-emerald-500")} />
              <div>
                <p className="max-w-48 text-[11px] font-medium text-[var(--color-text)]">{truncate(tk.Subject || tk.Ticket_Number, 35)}</p>
                <p className="font-mono text-[9px] text-[var(--color-text-muted)]">{tk.Ticket_Number}</p>
              </div>
            </button>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-[var(--color-border)] py-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 text-[var(--color-text-muted)] disabled:opacity-30"><ChevronLeft size={14} /></button>
            <span className="text-[11px] text-[var(--color-text-muted)]">Page {page}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1 text-[var(--color-text-muted)] disabled:opacity-30"><ChevronRight size={14} /></button>
          </div>
        )}
      </div>

      {/* Results — full width below */}
      <div className="animate-fade-in-delay-2">
        {scoring ? (
          <div className="card flex h-64 flex-col items-center justify-center gap-3">
            <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
            <p className="text-sm font-medium text-[var(--color-text)]">Analyzing interaction quality…</p>
            <p className="text-xs text-[var(--color-text-muted)]">Running QA rubric + OWASP compliance checks</p>
          </div>
        ) : qaResult ? (
          <div className="space-y-4">
            {/* Score header */}
            <div className="card gradient-hero p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-primary)]">QA Score</p>
                  <h3 className="mt-1 text-xl font-bold text-[var(--color-text)]">{qaResult.ticket_number}</h3>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Mode: {qaResult.Evaluation_Mode || "N/A"}</p>
                </div>
                {qaResult.Overall_Weighted_Score && qaResult.Overall_Weighted_Score !== "N/A" && (
                  <ScoreRing score={qaResult.Overall_Weighted_Score} />
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {qaResult.QA_Recommendation && (
                  <span className={cn("badge font-semibold",
                    qaResult.QA_Recommendation === "Keep doing" ? "bg-emerald-100 text-emerald-700" :
                    qaResult.QA_Recommendation === "Coaching needed" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700",
                  )}>{qaResult.QA_Recommendation}</span>
                )}
              </div>
              {qaResult.Contact_Summary && (
                <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">{qaResult.Contact_Summary}</p>
              )}
            </div>

            {/* Two QA sections side by side */}
            <div className="grid grid-cols-2 gap-4">
              {qaResult.Interaction_QA && (
                <QASection title="Interaction QA" data={qaResult.Interaction_QA as Record<string, unknown>} accentClass="gradient-blue" />
              )}
              {qaResult.Case_QA && (
                <QASection title="Case QA" data={qaResult.Case_QA as Record<string, unknown>} accentClass="gradient-green" />
              )}
            </div>

            {/* Red Flags + OWASP side by side */}
            <div className="grid grid-cols-2 gap-4">
              {qaResult.Red_Flags && (
                <div className="card overflow-hidden">
                  <div className="flex items-center gap-2 bg-red-50 px-5 py-3">
                    <ShieldAlert size={16} className="text-red-600" />
                    <div>
                      <h4 className="text-xs font-bold text-red-800">Red Flags</h4>
                      <p className="text-[10px] text-red-600">If any flag is &quot;Yes&quot;, overall score becomes 0%</p>
                    </div>
                  </div>
                  <div className="divide-y divide-[var(--color-border)]">
                    {Object.entries(qaResult.Red_Flags).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-3 px-5 py-2.5 text-[12px]">
                        {val.score === "Yes" ? (
                          <XCircle size={15} className="shrink-0 text-red-600" />
                        ) : val.score === "No" ? (
                          <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
                        ) : (
                          <div className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[8px]">–</div>
                        )}
                        <span className={cn("font-medium", val.score === "Yes" ? "text-red-700" : "text-[var(--color-text)]")}>
                          {key.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {qaResult.owasp_checks && (
                <div className="card overflow-hidden">
                  <div className={cn("flex items-center gap-2 px-5 py-3", qaResult.owasp_checks.compliant ? "bg-emerald-50" : "bg-red-50")}>
                    {qaResult.owasp_checks.compliant ? <ShieldCheck size={16} className="text-emerald-600" /> : <ShieldAlert size={16} className="text-red-600" />}
                    <div>
                      <h4 className={cn("text-xs font-bold", qaResult.owasp_checks.compliant ? "text-emerald-800" : "text-red-800")}>
                        OWASP Compliance
                      </h4>
                      <div className="flex gap-1.5">
                        {qaResult.owasp_checks.owasp_frameworks.map((fw) => (
                          <span key={fw} className="text-[9px] text-[var(--color-text-muted)]">{fw}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-3">
                    <div className="space-y-1.5">
                      {qaResult.owasp_checks.checks_run.map((check) => (
                        <span key={check} className="flex items-center gap-1.5 text-[11px]">
                          <CheckCircle2 size={12} className="shrink-0 text-emerald-500" />
                          <span className="text-[var(--color-text)]">{check}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {qaResult.owasp_checks.findings.length > 0 && (
                    <div className="border-t border-[var(--color-border)] px-5 py-3 space-y-2">
                      {qaResult.owasp_checks.findings.map((f, i) => (
                        <div key={i} className="rounded-lg border border-red-100 bg-red-50/50 p-2.5">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={12} className="text-red-500" />
                            <span className="text-[11px] font-semibold text-red-800">{f.category}</span>
                            <SeverityBadge severity={f.severity} />
                          </div>
                          <p className="mt-1 text-[11px] text-red-700">{f.description}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-red-400">{f.owasp_ref}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card flex h-48 flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-purple">
              <ShieldCheck size={24} strokeWidth={1.4} className="text-purple-600" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text)]">Select a ticket above to run QA scoring</p>
            <p className="max-w-md text-center text-xs text-[var(--color-text-muted)]">
              Each score evaluates interaction quality + case documentation using the challenge rubric, then runs OWASP compliance checks for PCI, PII, and prompt injection
            </p>
          </div>
        )}
      </div>
    </>
  );
}
