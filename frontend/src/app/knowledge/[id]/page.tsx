"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Tag, GitBranch } from "lucide-react";
import { fetchKBArticle, type KBArticleDetail } from "@/lib/api";
import { Markdown } from "@/components/Markdown";
import { nodeColor } from "@/lib/utils";

export default function ArticlePage() {
  const params = useParams();
  const id = params.id as string;
  const [article, setArticle] = useState<KBArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchKBArticle(id)
      .then((res) => setArticle(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="animate-fade-in">
        <Link href="/knowledge" className="mb-6 inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ArrowLeft size={14} /> Back to Knowledge Base
        </Link>
        <div className="card border-red-200 p-6 text-sm text-[var(--color-error)]">
          {error || "Article not found"}
        </div>
      </div>
    );
  }

  const tags = article.Tags ? String(article.Tags).split(",").map((t) => t.trim()).filter(Boolean) : [];

  return (
    <div className="animate-fade-in">
      {/* Back link */}
      <Link
        href="/knowledge"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeft size={14} /> Back to Knowledge Base
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <BookOpen size={18} className="text-[#3B82F6]" />
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest text-[var(--color-text-dim)]">KB ARTICLE</p>
            <p className="font-mono text-[11px] text-[var(--color-text-muted)]">{article.KB_Article_ID}</p>
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-[var(--color-text)]">
          {article.Title || article.KB_Article_ID}
        </h1>

        {/* Metadata badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {article.Module && (
            <span className="badge bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]">
              {article.Module}
            </span>
          )}
          {article.Category && (
            <span className="badge bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]">
              {article.Category}
            </span>
          )}
          {article.Source_Type && (
            <span className="badge bg-blue-50 text-[#3B82F6]">
              {article.Source_Type}
            </span>
          )}
        </div>
      </div>

      {/* Article body */}
      <div className="card p-6 animate-fade-in-delay-1">
        <div className="prose-sm max-w-none">
          <Markdown content={article.Body || "No content available."} />
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mt-4 card p-4 animate-fade-in-delay-2">
          <div className="flex flex-wrap items-center gap-2">
            <Tag size={14} className="text-[var(--color-text-muted)]" />
            {tags.map((tag) => (
              <span key={tag} className="badge bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Provenance / Lineage */}
      {article.lineage && article.lineage.length > 0 && (
        <div className="mt-4 card p-5 animate-fade-in-delay-3">
          <p className="font-mono text-[10px] tracking-widest text-[var(--color-text-dim)]">PROVENANCE</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Sources that contributed to this article
          </p>
          <div className="mt-3 space-y-2">
            {article.lineage.map((l, i) => {
              const groupKey = l.source_type === "Conversation" ? "conversation" : l.source_type === "Script" ? "script" : "ticket";
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] p-3">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: nodeColor(groupKey) }} />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-[var(--color-text)]">{l.source_id}</span>
                    <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">{l.source_type}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-dim)]">
                    <GitBranch size={10} />
                    {l.relationship}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
