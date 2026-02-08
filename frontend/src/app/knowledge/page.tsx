"use client";

import { useEffect, useState, useRef } from "react";
import { Search, BookOpen, ChevronDown, X, Tag } from "lucide-react";
import { fetchKnowledgeGraph, fetchKBArticles, type KnowledgeGraphData, type GraphNode } from "@/lib/api";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { cn, truncate, nodeColor } from "@/lib/utils";

export default function KnowledgePage() {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [articles, setArticles] = useState<Record<string, string>[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphWidth, setGraphWidth] = useState(800);

  useEffect(() => {
    fetchKnowledgeGraph(40)
      .then(setGraphData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchKBArticles(page, search)
      .then((res) => {
        setArticles(res.data);
        setTotalArticles(res.meta.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setGraphWidth(containerRef.current.offsetWidth);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const totalPages = Math.ceil(totalArticles / 20);

  return (
    <>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Knowledge Base</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Explore provenance relationships and browse {totalArticles.toLocaleString()} articles
        </p>
      </div>

      {/* Knowledge Graph */}
      <div ref={containerRef} className="mb-8 animate-fade-in-delay-1">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--color-text)]">Knowledge Provenance Graph</h2>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Drag nodes to rearrange · Click for details
          </p>
        </div>
        {graphData && graphData.nodes.length > 0 ? (
          <KnowledgeGraph
            nodes={graphData.nodes}
            links={graphData.links}
            width={graphWidth}
            height={460}
            onNodeClick={setSelectedNode}
          />
        ) : (
          <div className="card flex h-72 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        )}
      </div>

      {/* Selected node detail */}
      {selectedNode && (
        <div className="card mb-6 animate-fade-in p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-3.5 w-3.5 rounded-full shadow-sm" style={{ backgroundColor: nodeColor(selectedNode.group) }} />
              <span className="badge bg-neutral-100 capitalize text-[var(--color-text-muted)]">
                {selectedNode.group.replace("_", " ")}
              </span>
              <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{selectedNode.id}</span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-neutral-100 hover:text-[var(--color-text)]"
            >
              <X size={14} />
            </button>
          </div>
          <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{selectedNode.label}</p>
          {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
            <div className="mt-2 flex gap-2">
              {Object.entries(selectedNode.metadata).filter(([, v]) => v).map(([k, v]) => (
                <span key={k} className="badge bg-purple-50 text-[var(--color-primary)]">
                  {k}: {v}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Articles list */}
      <div className="animate-fade-in-delay-2">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-sm font-bold text-[var(--color-text)]">
            Articles
          </h2>
          <span className="badge bg-neutral-100 text-[var(--color-text-muted)]">
            {totalArticles.toLocaleString()}
          </span>
          <div className="relative ml-auto w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search articles…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-9 pr-3 text-xs text-[var(--color-text)] shadow-sm placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>
        </div>

        {loading ? (
          <div className="card flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-2">
            {articles.map((art) => {
              const isExpanded = expandedArticle === art.KB_Article_ID;
              return (
                <div key={art.KB_Article_ID} className="card card-interactive overflow-hidden">
                  <button
                    onClick={() => setExpandedArticle(isExpanded ? null : art.KB_Article_ID)}
                    className="flex w-full items-start gap-3 p-4 text-left"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-blue">
                      <BookOpen size={14} strokeWidth={1.8} className="text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        {art.Title || art.KB_Article_ID}
                      </p>
                      {!isExpanded && (
                        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
                          {truncate(art.Body || "", 160)}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                          {art.KB_Article_ID}
                        </span>
                        {art.Module && (
                          <span className="badge bg-neutral-100 text-[var(--color-text-muted)]">{art.Module}</span>
                        )}
                        {art.Source_Type && (
                          <span className="badge bg-blue-50 text-blue-600">{art.Source_Type}</span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={cn(
                        "mt-1 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="border-t border-[var(--color-border)] bg-neutral-50/50 px-4 pb-4 pt-3">
                      <div className="max-h-80 overflow-y-auto text-xs leading-relaxed text-[var(--color-text)]">
                        {(art.Body || "No content available.").split("\n").map((line: string, i: number) => (
                          <p key={i} className={cn("mt-1", line.startsWith("#") && "mt-3 font-semibold")}>
                            {line}
                          </p>
                        ))}
                      </div>
                      {art.Tags && (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] pt-3">
                          <Tag size={12} className="text-[var(--color-text-muted)]" />
                          {String(art.Tags).split(",").map((tag: string) => (
                            <span key={tag.trim()} className="badge bg-purple-50 text-[var(--color-primary)]">
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="card px-4 py-2 text-xs font-medium text-[var(--color-text-muted)] disabled:opacity-40"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page + i - 2;
              if (p < 1 || p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors",
                    p === page
                      ? "bg-[var(--color-primary)] text-white shadow-md"
                      : "text-[var(--color-text-muted)] hover:bg-neutral-100",
                  )}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="card px-4 py-2 text-xs font-medium text-[var(--color-text-muted)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
