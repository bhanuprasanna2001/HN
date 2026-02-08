"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { nodeColor } from "@/lib/utils";
import { Maximize2, Minimize2, X } from "lucide-react";
import type { GraphNode, GraphLink } from "@/lib/api";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  width: number;
  height: number;
  onNodeClick?: (node: GraphNode | null) => void;
}

interface FGNode {
  id: string;
  label: string;
  group: string;
  metadata: Record<string, string>;
  connections: number;
  x?: number;
  y?: number;
}

interface FGLink {
  source: string | FGNode;
  target: string | FGNode;
  relationship: string;
}

export function KnowledgeGraph({ nodes, links, width, height, onNodeClick }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fsWidth, setFsWidth] = useState(width);
  const [fsHeight, setFsHeight] = useState(height);
  const hasZoomed = useRef(false);

  /* Pre-compute connection counts so hub nodes appear larger */
  const graphData = useMemo(() => {
    const counts: Record<string, number> = {};
    links.forEach((l) => {
      counts[l.source] = (counts[l.source] || 0) + 1;
      counts[l.target] = (counts[l.target] || 0) + 1;
    });
    return {
      nodes: nodes.map((n) => ({ ...n, connections: counts[n.id] || 0 }) as FGNode),
      links: links.map((l) => ({ source: l.source, target: l.target, relationship: l.relationship }) as FGLink),
    };
  }, [nodes, links]);

  /* Fullscreen resize */
  useEffect(() => {
    function handleResize() {
      if (fullscreen) {
        setFsWidth(window.innerWidth - 56);
        setFsHeight(window.innerHeight);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fullscreen]);

  /* Re-zoom on fullscreen toggle */
  useEffect(() => {
    if (fullscreen && graphRef.current) {
      setTimeout(() => graphRef.current?.zoomToFit(400, 60), 200);
    }
  }, [fullscreen]);

  /* Escape to exit fullscreen */
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [fullscreen]);

  /* Neighbour lookup */
  const connectedIds = useCallback(
    (id: string | null): Set<string> => {
      if (!id) return new Set();
      const set = new Set<string>([id]);
      for (const l of links) {
        if (l.source === id) set.add(l.target);
        if (l.target === id) set.add(l.source);
      }
      return set;
    },
    [links],
  );

  const activeSet = connectedIds(selectedId);

  function handleNodeClick(node: FGNode) {
    const newId = selectedId === node.id ? null : node.id;
    setSelectedId(newId);
    if (onNodeClick) onNodeClick(newId ? (node as unknown as GraphNode) : null);
  }

  /* ------------------------------------------------------------------ */
  /* Canvas: nodes                                                       */
  /* ------------------------------------------------------------------ */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paintNode = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D) => {
      const conns: number = node.connections || 0;
      const baseR = 6 + Math.min(conns * 1.2, 9);
      const color: string = nodeColor(node.group);
      const isSelected = node.id === selectedId;
      const isConnected = activeSet.has(node.id);
      const dimmed = !!selectedId && !isConnected;

      const r = isSelected ? baseR + 6 : isConnected && selectedId ? baseR + 2 : baseR;
      const cx: number = node.x ?? 0;
      const cy: number = node.y ?? 0;

      /* Glow ring — selected */
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 14);
        g.addColorStop(0, color + "55");
        g.addColorStop(1, color + "00");
        ctx.fillStyle = g;
        ctx.fill();
      }

      /* Subtle glow — connected neighbours */
      if (isConnected && !isSelected && selectedId) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 7);
        g.addColorStop(0, color + "35");
        g.addColorStop(1, color + "00");
        ctx.fillStyle = g;
        ctx.fill();
      }

      /* Node circle */
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = dimmed ? color + "18" : color;
      ctx.fill();
      if (!dimmed) {
        ctx.strokeStyle = color + "45";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* Label — always visible; prominence scales with selection state */
      const maxLen = isSelected ? 26 : 14;
      const raw = node.label || node.id || "";
      const label = raw.length > maxLen ? raw.slice(0, maxLen - 1) + "…" : raw;
      const fs = isSelected ? 10 : 7;
      ctx.font = `${isSelected ? "600 " : ""}${fs}px Inter, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = dimmed
        ? "rgba(37,37,37,0.10)"
        : isSelected
          ? "#252525"
          : isConnected && selectedId
            ? "rgba(37,37,37,0.75)"
            : "rgba(37,37,37,0.50)";
      ctx.fillText(label, cx, cy + r + 3);
    },
    [selectedId, activeSet],
  );

  /* ------------------------------------------------------------------ */
  /* Canvas: links                                                       */
  /* ------------------------------------------------------------------ */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paintLink = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link: any, ctx: CanvasRenderingContext2D) => {
      const srcId = typeof link.source === "object" ? link.source.id : link.source;
      const tgtId = typeof link.target === "object" ? link.target.id : link.target;
      const isActive = !!selectedId && activeSet.has(srcId) && activeSet.has(tgtId);
      const dimmed = !!selectedId && !isActive;

      const src = typeof link.source === "object" ? link.source : null;
      const tgt = typeof link.target === "object" ? link.target : null;
      if (!src || !tgt) return;

      ctx.beginPath();
      ctx.moveTo(src.x ?? 0, src.y ?? 0);
      ctx.lineTo(tgt.x ?? 0, tgt.y ?? 0);
      ctx.strokeStyle = dimmed
        ? "rgba(37,37,37,0.02)"
        : isActive
          ? "rgba(37,37,37,0.35)"
          : "rgba(37,37,37,0.07)";
      ctx.lineWidth = isActive ? 2 : 0.5;
      ctx.stroke();
    },
    [selectedId, activeSet],
  );

  /* ------------------------------------------------------------------ */
  /* Helpers                                                              */
  /* ------------------------------------------------------------------ */
  function toggleFullscreen() {
    setFullscreen((f) => !f);
  }

  function handleEngineStop() {
    if (!hasZoomed.current && graphRef.current) {
      graphRef.current.zoomToFit(400, 60);
      hasZoomed.current = true;
    }
  }

  const displayWidth = fullscreen ? fsWidth : width;
  const displayHeight = fullscreen ? fsHeight : height;

  /* ------------------------------------------------------------------ */
  /* Render                                                               */
  /* ------------------------------------------------------------------ */
  return (
    <>
      {/* Backdrop for fullscreen */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[9998] bg-[var(--color-bg)]/80 backdrop-blur-sm"
          onClick={toggleFullscreen}
        />
      )}

      <div
        ref={containerRef}
        className={
          fullscreen
            ? "fixed inset-0 z-[9999] ml-14 overflow-hidden bg-[var(--color-bg)]"
            : "card relative overflow-hidden"
        }
      >
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={displayWidth}
          height={displayHeight}
          backgroundColor="#FAFAFA"
          nodeCanvasObject={paintNode}
          linkCanvasObject={paintLink}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, 14, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onNodeClick={(node: any) => handleNodeClick(node)}
          onBackgroundClick={() => {
            setSelectedId(null);
            if (onNodeClick) onNodeClick(null);
          }}
          onEngineStop={handleEngineStop}
          d3AlphaDecay={0.008}
          d3VelocityDecay={0.2}
          cooldownTicks={300}
          warmupTicks={150}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/95 px-4 py-2.5 text-[11px] backdrop-blur-sm">
          {[
            { label: "KB Article", color: "#3B82F6" },
            { label: "Script", color: "#8B5CF6" },
            { label: "Ticket", color: "#10B981" },
            { label: "Conversation", color: "#F59E0B" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-medium text-[var(--color-text-muted)]">{label}</span>
            </div>
          ))}
        </div>

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
        >
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        {/* Selected node panel */}
        {selectedId && (
          <div className="absolute right-4 top-14 max-w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/95 p-4 shadow-lg backdrop-blur-sm">
            {(() => {
              const node = nodes.find((n) => n.id === selectedId);
              if (!node) return null;
              const neighbors = links.filter(
                (l) => l.source === selectedId || l.target === selectedId,
              );
              return (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: nodeColor(node.group) }}
                      />
                      <span className="badge bg-[var(--color-surface-elevated)] capitalize text-[var(--color-text-muted)]">
                        {node.group.replace("_", " ")}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(null);
                        if (onNodeClick) onNodeClick(null);
                      }}
                      className="rounded-md p-0.5 text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">
                    {node.label}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--color-text-dim)]">
                    {node.id}
                  </p>
                  {neighbors.length > 0 && (
                    <div className="mt-3 border-t border-[var(--color-border)] pt-2">
                      <p className="font-mono text-[9px] tracking-widest text-[var(--color-text-dim)]">
                        {neighbors.length} CONNECTION
                        {neighbors.length !== 1 ? "S" : ""}
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {neighbors.slice(0, 6).map((l, i) => {
                          const otherId =
                            l.source === selectedId ? l.target : l.source;
                          const other = nodes.find((n) => n.id === otherId);
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 text-[10px]"
                            >
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: nodeColor(other?.group ?? ""),
                                }}
                              />
                              <span className="truncate text-[var(--color-text-muted)]">
                                {other?.label?.slice(0, 30) ?? otherId}
                              </span>
                              <span className="ml-auto shrink-0 font-mono text-[var(--color-text-dim)]">
                                {l.relationship}
                              </span>
                            </div>
                          );
                        })}
                        {neighbors.length > 6 && (
                          <p className="text-[10px] text-[var(--color-text-dim)]">
                            +{neighbors.length - 6} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
