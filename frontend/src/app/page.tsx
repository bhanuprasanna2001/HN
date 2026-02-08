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
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { fetchStats, type DashboardStats } from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  delay: string;
}

function StatCard({ label, value, icon, gradient, delay }: StatCardProps) {
  return (
    <div className={cn("card card-interactive p-5", delay)}>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", gradient)}>
        {icon}
      </div>
      <p className="mt-4 text-3xl font-bold text-[var(--color-text)]">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      <p className="mt-1 text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
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
      <div className="card border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Failed to load dashboard: {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {/* Hero */}
      <div className="card gradient-hero mb-8 animate-fade-in p-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--color-primary)]" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)]">
                Self-Learning Intelligence
              </p>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-[var(--color-text)]">
              SupportMind AI Dashboard
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--color-text-muted)]">
              Continuously learning from every resolved ticket. Knowledge gaps are detected,
              articles are auto-generated, and human reviewers govern what gets published.
            </p>
          </div>
          <div className="hidden flex-col items-end gap-2 lg:flex">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] shadow-lg shadow-purple-200">
              <Sparkles size={20} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Knowledge Articles"
          value={stats.total_kb_articles}
          icon={<BookOpen size={18} strokeWidth={1.6} className="text-blue-600" />}
          gradient="gradient-blue"
          delay="animate-fade-in"
        />
        <StatCard
          label="Tier 3 Scripts"
          value={stats.total_scripts}
          icon={<Terminal size={18} strokeWidth={1.6} className="text-purple-600" />}
          gradient="gradient-purple"
          delay="animate-fade-in-delay-1"
        />
        <StatCard
          label="Tickets"
          value={stats.total_tickets}
          icon={<FileText size={18} strokeWidth={1.6} className="text-emerald-600" />}
          gradient="gradient-green"
          delay="animate-fade-in-delay-2"
        />
        <StatCard
          label="Conversations"
          value={stats.total_conversations}
          icon={<MessageSquare size={18} strokeWidth={1.6} className="text-amber-600" />}
          gradient="gradient-amber"
          delay="animate-fade-in-delay-3"
        />
      </div>

      {/* Learning metrics */}
      <h2 className="mb-3 mt-8 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] animate-fade-in">
        Learning Loop Metrics
      </h2>
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Gaps Detected"
          value={stats.total_gaps_detected}
          icon={<Lightbulb size={18} strokeWidth={1.6} className="text-orange-600" />}
          gradient="bg-orange-50"
          delay="animate-fade-in"
        />
        <StatCard
          label="Approved"
          value={stats.gaps_approved}
          icon={<CheckCircle2 size={18} strokeWidth={1.6} className="text-emerald-600" />}
          gradient="gradient-green"
          delay="animate-fade-in-delay-1"
        />
        <StatCard
          label="Rejected"
          value={stats.gaps_rejected}
          icon={<XCircle size={18} strokeWidth={1.6} className="text-red-500" />}
          gradient="bg-red-50"
          delay="animate-fade-in-delay-2"
        />
        <StatCard
          label="Pending Review"
          value={stats.gaps_pending}
          icon={<Clock size={18} strokeWidth={1.6} className="text-amber-600" />}
          gradient="gradient-amber"
          delay="animate-fade-in-delay-3"
        />
      </div>

      {/* Self-learning loop visualization */}
      <div className="card mt-8 animate-fade-in overflow-hidden">
        <div className="border-b border-[var(--color-border)] bg-neutral-50/50 px-6 py-4">
          <h2 className="text-sm font-bold text-[var(--color-text)]">How the Self-Learning Loop Works</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: "Gap Detected", desc: "Resolved Tier 3 ticket with no KB match", color: "bg-orange-500" },
              { num: 2, label: "KB Draft Generated", desc: "LLM creates article from resolution + transcript", color: "bg-blue-500" },
              { num: 3, label: "Human Review", desc: "Reviewer approves or rejects with notes", color: "bg-purple-500" },
              { num: 4, label: "Published & Indexed", desc: "Article embedded into vector DB for retrieval", color: "bg-emerald-500" },
            ].map(({ num, label, desc, color }, i) => (
              <div key={label} className="flex items-center gap-4">
                <div className="flex flex-col items-center text-center">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md", color)}>
                    {num}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[var(--color-text)]">{label}</p>
                  <p className="mt-0.5 max-w-36 text-[10px] leading-tight text-[var(--color-text-muted)]">{desc}</p>
                </div>
                {i < 3 && (
                  <ArrowRight size={16} className="mb-6 text-[var(--color-border)]" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              href="/learning"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-purple-200/50 transition-all hover:shadow-lg"
            >
              <Lightbulb size={14} />
              Review Learning Events
            </Link>
            <Link
              href="/copilot"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-xs font-semibold text-[var(--color-text)] transition-all hover:bg-neutral-50"
            >
              <MessageSquare size={14} />
              Try the Copilot
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
