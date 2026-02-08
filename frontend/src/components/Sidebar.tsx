"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Network,
  GraduationCap,
  ShieldCheck,
  Zap,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/copilot", icon: MessageSquare, label: "Copilot" },
  { href: "/knowledge", icon: Network, label: "Knowledge" },
  { href: "/learning", icon: GraduationCap, label: "Learning" },
  { href: "/qa", icon: ShieldCheck, label: "QA" },
] as const;

export function Sidebar() {
  const path = usePathname();
  const [expanded, setExpanded] = useState(false);

  // Sync main content margin
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (main) main.style.marginLeft = expanded ? "200px" : "56px";
  }, [expanded]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-200",
        expanded ? "w-[200px]" : "w-14",
      )}
    >
      {/* Logo + toggle */}
      <div className={cn("flex h-14 items-center border-b border-[var(--color-border)]", expanded ? "justify-between px-4" : "justify-center")}>
        <div className="flex items-center gap-2.5">
          <Zap size={16} strokeWidth={2.2} className="shrink-0 text-[var(--color-text)]" />
          {expanded && (
            <span className="text-sm font-bold tracking-tight text-[var(--color-text)]">Speare AI</span>
          )}
        </div>
        {expanded && (
          <button onClick={() => setExpanded(false)} className="text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mx-auto mt-2 flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
        >
          <PanelLeft size={14} />
        </button>
      )}

      {/* Nav */}
      <nav className={cn("flex flex-1 flex-col gap-0.5 pt-2", expanded ? "px-2" : "items-center px-1")}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={expanded ? undefined : label}
              className={cn(
                "group relative flex items-center rounded-lg transition-all duration-150",
                expanded ? "gap-2.5 px-3 py-2" : "h-9 w-9 justify-center",
                active
                  ? "bg-[var(--color-text)] text-[var(--color-bg)]"
                  : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]",
              )}
            >
              <Icon size={16} strokeWidth={1.8} className="shrink-0" />
              {expanded && <span className="text-[13px] font-medium">{label}</span>}
              {/* Tooltip when collapsed */}
              {!expanded && (
                <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-[var(--color-text)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-bg)] opacity-0 transition-opacity group-hover:opacity-100">
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn("border-t border-[var(--color-border)] py-3", expanded ? "px-4" : "flex justify-center")}>
        {expanded ? (
          <div>
            <p className="text-[11px] font-semibold text-[var(--color-text)]">Speare AI</p>
            <p className="text-[10px] text-[var(--color-text-dim)]">Self-learning support brain</p>
          </div>
        ) : (
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" title="Online" />
        )}
      </div>
    </aside>
  );
}
