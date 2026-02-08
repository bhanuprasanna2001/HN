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

const NAV = [
  { href: "/", icon: LayoutDashboard, tip: "Dashboard" },
  { href: "/copilot", icon: MessageSquare, tip: "Copilot" },
  { href: "/knowledge", icon: Network, tip: "Knowledge" },
  { href: "/learning", icon: GraduationCap, tip: "Learning" },
  { href: "/qa", icon: ShieldCheck, tip: "QA" },
] as const;

export function Sidebar() {
  const path = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-14 flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Logo */}
      <div className="flex h-14 items-center justify-center">
        <Brain size={18} strokeWidth={2} className="text-[var(--color-text)]" />
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col items-center gap-1 pt-2">
        {NAV.map(({ href, icon: Icon, tip }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={tip}
              className={cn(
                "group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150",
                active
                  ? "bg-[var(--color-text)] text-[var(--color-bg)]"
                  : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]",
              )}
            >
              <Icon size={16} strokeWidth={1.8} />
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-[var(--color-text)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-bg)] opacity-0 transition-opacity group-hover:opacity-100">
                {tip}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom dot */}
      <div className="mb-4 h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" title="System Online" />
    </aside>
  );
}
