"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Network,
  GraduationCap,
  ShieldCheck,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, desc: "Overview & metrics" },
  { href: "/copilot", label: "Copilot", icon: MessageSquare, desc: "AI-powered answers" },
  { href: "/knowledge", label: "Knowledge", icon: Network, desc: "Graph & articles" },
  { href: "/learning", label: "Learning", icon: GraduationCap, desc: "Self-learning loop" },
  { href: "/qa", label: "QA & Compliance", icon: ShieldCheck, desc: "OWASP scoring" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col bg-[var(--color-surface)] shadow-[1px_0_0_var(--color-border)]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]">
          <Brain size={16} strokeWidth={2} className="text-white" />
        </div>
        <div>
          <span className="text-sm font-bold tracking-tight text-[var(--color-text)]">
            SupportMind
          </span>
          <span className="ml-1 text-[10px] font-medium text-[var(--color-primary)]">AI</span>
        </div>
      </div>

      {/* Section label */}
      <div className="px-5 pb-2 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          Navigate
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon, desc }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
                active
                  ? "bg-[var(--color-primary)] text-white shadow-md shadow-purple-200/50"
                  : "text-[var(--color-text-muted)] hover:bg-neutral-50 hover:text-[var(--color-text)]",
              )}
            >
              <Icon size={17} strokeWidth={1.8} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-tight">{label}</p>
                <p className={cn(
                  "text-[10px] leading-tight",
                  active ? "text-white/70" : "text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity",
                )}>{desc}</p>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mx-3 mb-3 rounded-lg border border-purple-100 bg-purple-50/50 px-4 py-3">
        <p className="text-[11px] font-semibold text-[var(--color-primary)]">
          Self-Learning Brain
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
          Continuously improving from every interaction
        </p>
      </div>
    </aside>
  );
}
