"use client";

import { useEffect, useState, useRef } from "react";
import { Search, BookOpen } from "lucide-react";
import { fetchKnowledgeGraph, fetchKBArticles, type KnowledgeGraphData, type GraphNode } from "@/lib/api";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { cn, truncate } from "@/lib/utils";

export default function KnowledgePage() {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [articles, setArticles] = useState<Record<string, string>[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphWidth, setGraphWidth] = useState(800);

  useEffect(() => {
    fetchKnowledgeGraph(100)
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

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Knowledge Base</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Explore the knowledge graph and browse articles with full provenance
        </p>
      </div>

      {/* Knowledge Graph */}
      <div ref={containerRef} className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Knowledge Graph</h2>
        {graphData && graphData.nodes.length > 0 ? (
          <KnowledgeGraph
            nodes={graphData.nodes}
            links={graphData.links}
            width={graphWidth}
            height={420}
            onNodeClick={setSelectedNode}
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
          </div>
        )}
      </div>

      {/* Selected node detail */}
      {selectedNode && (
        <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: cn(selectedNode.group === "kb_article" ? "#3B82F6" : selectedNode.group === "script" ? "#8B5CF6" : selectedNode.group === "ticket" ? "#10B981" : "#F59E0B") }} />
              <span className="text-xs font-medium capitalize text-[var(--color-text-muted)]">
                {selectedNode.group.replace("_", " ")}
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Close
            </button>
          </div>
          <p className="mt-2 text-sm font-medium text-[var(--color-text)]">{selectedNode.label}</p>
          <p className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">{selectedNode.id}</p>
        </div>
      )}

      {/* Articles list */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Articles ({totalArticles})
          </h2>
          <div className="relative ml-auto w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search articles…"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-3 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-2">
            {articles.map((art) => (
              <div
                key={art.KB_Article_ID}
                className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:bg-neutral-50"
              >
                <BookOpen size={16} strokeWidth={1.6} className="mt-0.5 shrink-0 text-blue-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {art.Title || art.KB_Article_ID}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
                    {truncate(art.Body || "", 180)}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                      {art.KB_Article_ID}
                    </span>
                    {art.Module && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                        {art.Module}
                      </span>
                    )}
                    {art.Source_Type && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">
                        {art.Source_Type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalArticles > 20 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-neutral-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-[var(--color-text-muted)]">
              Page {page} of {Math.ceil(totalArticles / 20)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(totalArticles / 20)}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-neutral-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
