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
} from "lucide-react";
import { fetchStats, type DashboardStats } from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
}

function StatCard({ label, value, icon, accent }: StatCardProps) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
          accent ?? "bg-neutral-100 text-[var(--color-text)]",
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-semibold text-[var(--color-text)]">
          {typeof value === "number" ? formatNumber(value) : value}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Failed to load dashboard: {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          SupportMind AI — self-learning intelligence layer overview
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Knowledge Articles"
          value={stats.total_kb_articles}
          icon={<BookOpen size={18} strokeWidth={1.6} />}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Tier 3 Scripts"
          value={stats.total_scripts}
          icon={<Terminal size={18} strokeWidth={1.6} />}
          accent="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="Tickets"
          value={stats.total_tickets}
          icon={<FileText size={18} strokeWidth={1.6} />}
          accent="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Conversations"
          value={stats.total_conversations}
          icon={<MessageSquare size={18} strokeWidth={1.6} />}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Learning metrics */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard
          label="Gaps Detected"
          value={stats.total_gaps_detected}
          icon={<Lightbulb size={18} strokeWidth={1.6} />}
          accent="bg-orange-50 text-orange-600"
        />
        <StatCard
          label="Approved"
          value={stats.gaps_approved}
          icon={<CheckCircle2 size={18} strokeWidth={1.6} />}
          accent="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Rejected"
          value={stats.gaps_rejected}
          icon={<XCircle size={18} strokeWidth={1.6} />}
          accent="bg-red-50 text-red-600"
        />
        <StatCard
          label="Pending Review"
          value={stats.gaps_pending}
          icon={<Clock size={18} strokeWidth={1.6} />}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Self-learning loop explanation */}
      <div className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Self-Learning Loop</h2>
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
          SupportMind continuously monitors resolved Tier 3 tickets. When a resolution
          has no matching knowledge article, a gap is detected and a KB draft is
          auto-generated with full provenance. Human reviewers approve or reject each
          draft — approved articles are immediately indexed for future retrieval,
          closing the learning loop.
        </p>

        <div className="mt-5 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          {["Gap Detected", "KB Draft Generated", "Human Review", "Published & Indexed"].map(
            (step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-semibold text-white">
                  {i + 1}
                </span>
                <span>{step}</span>
                {i < 3 && (
                  <span className="mx-1 text-[var(--color-border)]">→</span>
                )}
              </div>
            ),
          )}
        </div>
      </div>
    </>
  );
}
