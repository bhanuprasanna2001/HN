"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  FileText,
  MessageSquare,
  Terminal,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { fetchStats, type DashboardStats } from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  delay: string;
}

function StatCard({ label, value, icon, delay }: StatCardProps) {
  return (
    <div className={cn("card p-5", delay)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-surface-elevated)]">
        {icon}
      </div>
      <p className="mt-4 font-mono text-2xl font-bold text-[var(--color-text)]">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      <p className="mt-1 text-[11px] tracking-wide text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="card border-red-200 p-6 text-sm text-[var(--color-error)]">
        Failed to load dashboard: {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-text)] border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-10 animate-fade-in">
        <p className="font-mono text-[11px] tracking-widest text-[var(--color-text-muted)]">SPEARE AI</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text)]">
          Dashboard
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--color-text-muted)]">
          Self-learning intelligence layer — continuously learning from every resolved ticket, governed by human reviewers.
        </p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="KB Articles" value={stats.total_kb_articles} icon={<BookOpen size={15} className="text-[#3B82F6]" />} delay="animate-fade-in" />
        <StatCard label="Tier 3 Scripts" value={stats.total_scripts} icon={<Terminal size={15} className="text-[#8B5CF6]" />} delay="animate-fade-in-delay-1" />
        <StatCard label="Tickets" value={stats.total_tickets} icon={<FileText size={15} className="text-[#10B981]" />} delay="animate-fade-in-delay-2" />
        <StatCard label="Conversations" value={stats.total_conversations} icon={<MessageSquare size={15} className="text-[#F59E0B]" />} delay="animate-fade-in-delay-3" />
      </div>

      {/* Learning metrics */}
      <p className="mb-3 mt-8 font-mono text-[10px] tracking-widest text-[var(--color-text-dim)] animate-fade-in">LEARNING LOOP</p>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Gaps Detected" value={stats.total_gaps_detected} icon={<Lightbulb size={15} className="text-[#F59E0B]" />} delay="animate-fade-in" />
        <StatCard label="Approved" value={stats.gaps_approved} icon={<CheckCircle2 size={15} className="text-[#10B981]" />} delay="animate-fade-in-delay-1" />
        <StatCard label="Rejected" value={stats.gaps_rejected} icon={<XCircle size={15} className="text-[var(--color-error)]" />} delay="animate-fade-in-delay-2" />
        <StatCard label="Pending" value={stats.gaps_pending} icon={<Clock size={15} className="text-[var(--color-text-muted)]" />} delay="animate-fade-in-delay-3" />
      </div>

      {/* Pipeline */}
      <div className="card mt-8 animate-fade-in overflow-hidden">
        <div className="border-b border-[var(--color-border)] px-6 py-4">
          <p className="font-mono text-[10px] tracking-widest text-[var(--color-text-dim)]">HOW IT WORKS</p>
          <h2 className="mt-1 text-sm font-semibold text-[var(--color-text)]">Self-Learning Loop</h2>
        </div>
        <div className="flex items-center justify-between px-6 py-8">
          {[
            { n: "01", label: "Gap Detected", sub: "No KB match for resolved ticket" },
            { n: "02", label: "KB Draft Generated", sub: "LLM extracts knowledge from resolution" },
            { n: "03", label: "Human Review", sub: "Reviewer approves or rejects" },
            { n: "04", label: "Published", sub: "Article indexed for future retrieval" },
          ].map(({ n, label, sub }, i) => (
            <div key={n} className="flex items-center gap-6">
              <div className="text-center">
                <p className="font-mono text-[10px] text-[var(--color-text-dim)]">{n}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--color-text)]">{label}</p>
                <p className="mt-0.5 max-w-32 text-[10px] leading-tight text-[var(--color-text-muted)]">{sub}</p>
              </div>
              {i < 3 && <ArrowRight size={14} className="text-[var(--color-text-dim)]" />}
            </div>
          ))}
        </div>
        <div className="flex gap-3 border-t border-[var(--color-border)] px-6 py-4">
          <Link href="/learning" className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-text)] px-4 py-2 text-[11px] font-semibold text-[var(--color-bg)] transition-opacity hover:opacity-90">
            <Lightbulb size={13} /> Review Events
          </Link>
          <Link href="/copilot" className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-text-dim)]">
            <MessageSquare size={13} /> Try Copilot
          </Link>
        </div>
      </div>
    </>
  );
}
