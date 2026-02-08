"use client";

import Link from "next/link";

/**
 * Lightweight markdown renderer. Handles headings, bold, italic, code,
 * links, lists, and line breaks without pulling in a heavy library.
 */
export function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  function flushList() {
    if (listBuffer.length === 0) return;
    elements.push(
      <ol key={`ol-${elements.length}`} className="my-2 list-decimal space-y-1.5 pl-5">
        {listBuffer.map((item, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-[var(--color-text)]">
            <InlineMarkdown text={item} />
          </li>
        ))}
      </ol>,
    );
    listBuffer = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const numbered = line.match(/^\d+\.\s+(.+)/);

    if (numbered) {
      listBuffer.push(numbered[1]);
      continue;
    }

    flushList();

    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="mb-1 mt-4 text-[13px] font-bold text-[var(--color-text)]">
          <InlineMarkdown text={line.slice(4)} />
        </h4>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="mb-1 mt-4 text-sm font-bold text-[var(--color-text)]">
          <InlineMarkdown text={line.slice(3)} />
        </h3>,
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="mb-2 mt-4 text-base font-bold text-[var(--color-text)]">
          <InlineMarkdown text={line.slice(2)} />
        </h2>,
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex gap-2 py-0.5 text-[13px] text-[var(--color-text)]">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-text-muted)]" />
          <InlineMarkdown text={line.slice(2)} />
        </div>,
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-[13px] leading-relaxed text-[var(--color-text)]">
          <InlineMarkdown text={line} />
        </p>,
      );
    }
  }
  flushList();

  return <div>{elements}</div>;
}

function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  // Order: links, bold, italic, code
  const regex = /(\[(.+?)\]\((.+?)\))|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    if (match[2] && match[3]) {
      // Link: [text](url)
      const href = match[3];
      const linkText = match[2];
      if (href.startsWith("/knowledge/") || href.startsWith("/")) {
        parts.push(
          <Link key={match.index} href={href} className="font-medium text-[#3B82F6] underline decoration-[#3B82F6]/30 hover:decoration-[#3B82F6]">
            {linkText}
          </Link>,
        );
      } else {
        parts.push(
          <a key={match.index} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-[#3B82F6] underline decoration-[#3B82F6]/30 hover:decoration-[#3B82F6]">
            {linkText}
          </a>,
        );
      }
    } else if (match[5]) {
      // Bold
      parts.push(<strong key={match.index} className="font-semibold text-[var(--color-text)]">{match[5]}</strong>);
    } else if (match[7]) {
      // Italic
      parts.push(<em key={match.index}>{match[7]}</em>);
    } else if (match[9]) {
      // Code
      parts.push(
        <code key={match.index} className="rounded bg-[var(--color-surface-elevated)] px-1 py-0.5 font-mono text-[12px] text-[var(--color-text)]">
          {match[9]}
        </code>,
      );
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));

  return <>{parts}</>;
}
