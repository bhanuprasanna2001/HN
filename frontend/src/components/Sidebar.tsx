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
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/copilot", label: "Copilot", icon: MessageSquare },
  { href: "/knowledge", label: "Knowledge", icon: Network },
  { href: "/learning", label: "Learning", icon: GraduationCap },
  { href: "/qa", label: "QA & Compliance", icon: ShieldCheck },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--color-border)] px-5">
        <Brain size={20} strokeWidth={1.8} className="text-[var(--color-accent)]" />
        <span className="text-sm font-semibold tracking-tight text-[var(--color-text)]">
          SupportMind
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 pt-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-muted)] hover:bg-neutral-100 hover:text-[var(--color-text)]",
              )}
            >
              <Icon size={16} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--color-border)] px-5 py-3">
        <p className="text-[11px] text-[var(--color-text-muted)]">
          SupportMind AI v1.0
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Self-Learning Support Brain
        </p>
      </div>
    </aside>
  );
}
