"use client";

/**
 * Lightweight markdown renderer. Handles headings, bold, italic, code,
 * lists, and line breaks without pulling in a heavy library.
 */
export function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  function flushList() {
    if (listBuffer.length === 0) return;
    elements.push(
      <ol key={`ol-${elements.length}`} className="my-2 list-decimal space-y-1 pl-5">
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
          {line.slice(4)}
        </h4>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="mb-1 mt-4 text-sm font-bold text-[var(--color-text)]">
          {line.slice(3)}
        </h3>,
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="mb-2 mt-4 text-base font-bold text-[var(--color-text)]">
          {line.slice(2)}
        </h2>,
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex gap-2 py-0.5 text-[13px] text-[var(--color-text)]">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
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
  // Process **bold**, *italic*, `code`, and plain text
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index} className="font-semibold">{match[2]}</strong>);
    } else if (match[4]) {
      parts.push(<em key={match.index}>{match[4]}</em>);
    } else if (match[6]) {
      parts.push(
        <code key={match.index} className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[12px] text-[var(--color-primary)]">
          {match[6]}
        </code>,
      );
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));

  return <>{parts}</>;
}
