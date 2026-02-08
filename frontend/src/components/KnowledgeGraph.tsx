"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { nodeColor } from "@/lib/utils";
import type { GraphNode, GraphLink } from "@/lib/api";

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  width: number;
  height: number;
  onNodeClick?: (node: GraphNode) => void;
}

interface RuntimeNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface RuntimeLink {
  source: RuntimeNode | string;
  target: RuntimeNode | string;
  relationship: string;
}

/**
 * Interactive force-directed knowledge graph rendered on Canvas.
 * No external graph library — pure canvas for maximum performance.
 */
export function KnowledgeGraph({ nodes, links, width, height, onNodeClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<RuntimeNode[]>([]);
  const linksRef = useRef<RuntimeLink[]>([]);
  const hoveredRef = useRef<RuntimeNode | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);

  // Initialize simulation data
  useEffect(() => {
    const nodeMap = new Map<string, RuntimeNode>();
    const runtimeNodes: RuntimeNode[] = nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const radius = Math.min(width, height) * 0.35;
      const rn: RuntimeNode = {
        ...n,
        x: width / 2 + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
        y: height / 2 + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
      };
      nodeMap.set(n.id, rn);
      return rn;
    });

    const runtimeLinks: RuntimeLink[] = links
      .map((l) => ({
        source: nodeMap.get(l.source) ?? l.source,
        target: nodeMap.get(l.target) ?? l.target,
        relationship: l.relationship,
      }))
      .filter((l) => typeof l.source !== "string" && typeof l.target !== "string");

    nodesRef.current = runtimeNodes;
    linksRef.current = runtimeLinks;
  }, [nodes, links, width, height]);

  // Simple force simulation
  const tick = useCallback(() => {
    const ns = nodesRef.current;
    const ls = linksRef.current;
    const cx = width / 2;
    const cy = height / 2;
    const damping = 0.92;

    // Repulsion between nodes
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = (ns[i].x ?? 0) - (ns[j].x ?? 0);
        const dy = (ns[i].y ?? 0) - (ns[j].y ?? 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 800 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        ns[i].vx = (ns[i].vx ?? 0) + fx;
        ns[i].vy = (ns[i].vy ?? 0) + fy;
        ns[j].vx = (ns[j].vx ?? 0) - fx;
        ns[j].vy = (ns[j].vy ?? 0) - fy;
      }
    }

    // Attraction along links
    for (const l of ls) {
      const s = l.source as RuntimeNode;
      const t = l.target as RuntimeNode;
      const dx = (t.x ?? 0) - (s.x ?? 0);
      const dy = (t.y ?? 0) - (s.y ?? 0);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 120) * 0.005;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx = (s.vx ?? 0) + fx;
      s.vy = (s.vy ?? 0) + fy;
      t.vx = (t.vx ?? 0) - fx;
      t.vy = (t.vy ?? 0) - fy;
    }

    // Center gravity + update positions
    for (const n of ns) {
      n.vx = ((n.vx ?? 0) + (cx - (n.x ?? 0)) * 0.001) * damping;
      n.vy = ((n.vy ?? 0) + (cy - (n.y ?? 0)) * 0.001) * damping;
      n.x = (n.x ?? 0) + (n.vx ?? 0);
      n.y = (n.y ?? 0) + (n.vy ?? 0);
      // Boundary clamping
      n.x = Math.max(20, Math.min(width - 20, n.x));
      n.y = Math.max(20, Math.min(height - 20, n.y));
    }
  }, [width, height]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      if (!ctx) return;
      tick();

      ctx.clearRect(0, 0, width, height);

      // Draw links
      ctx.strokeStyle = "#E5E5E5";
      ctx.lineWidth = 1;
      for (const l of linksRef.current) {
        const s = l.source as RuntimeNode;
        const t = l.target as RuntimeNode;
        ctx.beginPath();
        ctx.moveTo(s.x ?? 0, s.y ?? 0);
        ctx.lineTo(t.x ?? 0, t.y ?? 0);
        ctx.stroke();
      }

      // Draw nodes
      const hov = hoveredRef.current;
      for (const n of nodesRef.current) {
        const r = n === hov ? 8 : 5;
        const color = nodeColor(n.group);
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (n === hov) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Draw label for hovered node
      if (hov) {
        ctx.font = "11px Inter, sans-serif";
        ctx.fillStyle = "#252525";
        ctx.textAlign = "center";
        ctx.fillText(hov.label, hov.x ?? 0, (hov.y ?? 0) - 12);
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [width, height, tick]);

  // Mouse interaction
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found: RuntimeNode | null = null;
    for (const n of nodesRef.current) {
      const dx = (n.x ?? 0) - mx;
      const dy = (n.y ?? 0) - my;
      if (dx * dx + dy * dy < 100) {
        found = n;
        break;
      }
    }
    hoveredRef.current = found;
    setHovered(found);
  }

  function handleClick() {
    if (hoveredRef.current && onNodeClick) {
      onNodeClick(hoveredRef.current);
    }
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
        style={{ cursor: hovered ? "pointer" : "default" }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex gap-4 rounded-md bg-white/90 px-3 py-2 text-[11px] backdrop-blur-sm">
        {[
          { label: "KB Article", color: "#3B82F6" },
          { label: "Script", color: "#8B5CF6" },
          { label: "Ticket", color: "#10B981" },
          { label: "Conversation", color: "#F59E0B" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[var(--color-text-muted)]">{label}</span>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute right-3 top-3 max-w-64 rounded-md border border-[var(--color-border)] bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: nodeColor(hovered.group) }} />
            <span className="text-[11px] font-medium capitalize text-[var(--color-text-muted)]">
              {hovered.group.replace("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-[var(--color-text)]">{hovered.label}</p>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">{hovered.id}</p>
        </div>
      )}
    </div>
  );
}
