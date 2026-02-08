import { clsx, type ClassValue } from "clsx";

/** Merge Tailwind classes safely. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Format a number with locale separators. */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

/** Truncate text to a max length. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/** Capitalise the first letter. */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Colour for a graph node group (matches .cursorrules design system). */
export function nodeColor(group: string): string {
  const colors: Record<string, string> = {
    kb_article: "#3B82F6",
    script: "#8B5CF6",
    ticket: "#10B981",
    conversation: "#F59E0B",
  };
  return colors[group] ?? "#A3A3A3";
}

/** Status badge colour (light theme). */
export function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved") return "bg-green-50 text-green-700 border-green-200";
  if (s === "rejected") return "bg-red-50 text-red-700 border-red-200";
  if (s === "pending") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "closed") return "bg-neutral-100 text-neutral-600 border-neutral-200";
  return "bg-neutral-100 text-neutral-600 border-neutral-200";
}
