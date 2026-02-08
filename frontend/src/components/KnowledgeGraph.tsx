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
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned: boolean;
  linkCount: number;
}

interface RuntimeLink {
  source: RuntimeNode;
  target: RuntimeNode;
  relationship: string;
}

const R = 9;
const LABEL_FONT = "11px Inter, sans-serif";
const REST_LEN = 100;
const REPULSION = 3500;
const ATTRACTION = 0.008;
const GRAVITY = 0.015;
const ALPHA_INIT = 1.0;
const ALPHA_DECAY = 0.006;
const ALPHA_MIN = 0.001;
const V_DECAY = 0.55;

export function KnowledgeGraph({ nodes, links, width, height, onNodeClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const nsRef = useRef<RuntimeNode[]>([]);
  const lsRef = useRef<RuntimeLink[]>([]);
  const alphaRef = useRef(ALPHA_INIT);
  const dragRef = useRef<RuntimeNode | null>(null);
  const hovRef = useRef<RuntimeNode | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);

  // Build data
  useEffect(() => {
    const map = new Map<string, RuntimeNode>();
    const cx = width / 2, cy = height / 2;

    const rns: RuntimeNode[] = nodes.map((n, i) => {
      const a = (2 * Math.PI * i) / Math.max(nodes.length, 1);
      const rad = Math.min(width, height) * 0.3;
      const rn: RuntimeNode = {
        ...n,
        x: cx + rad * Math.cos(a) + (Math.random() - 0.5) * 50,
        y: cy + rad * Math.sin(a) + (Math.random() - 0.5) * 50,
        vx: 0, vy: 0, pinned: false, linkCount: 0,
      };
      map.set(n.id, rn);
      return rn;
    });

    const rls: RuntimeLink[] = [];
    for (const l of links) {
      const s = map.get(l.source), t = map.get(l.target);
      if (s && t) {
        s.linkCount++;
        t.linkCount++;
        rls.push({ source: s, target: t, relationship: l.relationship });
      }
    }

    nsRef.current = rns;
    lsRef.current = rls;
    alphaRef.current = ALPHA_INIT;
  }, [nodes, links, width, height]);

  // Physics tick
  const tick = useCallback(() => {
    const ns = nsRef.current, ls = lsRef.current;
    const alpha = alphaRef.current;
    if (alpha < ALPHA_MIN && !dragRef.current) return;
    const cx = width / 2, cy = height / 2;

    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy || 1;
        const d = Math.sqrt(d2);
        const f = (REPULSION * alpha) / d2;
        dx = (dx / d) * f; dy = (dy / d) * f;
        if (!a.pinned) { a.vx += dx; a.vy += dy; }
        if (!b.pinned) { b.vx -= dx; b.vy -= dy; }
      }
    }

    for (const l of ls) {
      const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - REST_LEN) * ATTRACTION * alpha;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      if (!l.source.pinned) { l.source.vx += fx; l.source.vy += fy; }
      if (!l.target.pinned) { l.target.vx -= fx; l.target.vy -= fy; }
    }

    for (const n of ns) {
      if (n.pinned) { n.vx = 0; n.vy = 0; continue; }
      n.vx += (cx - n.x) * GRAVITY * alpha;
      n.vy += (cy - n.y) * GRAVITY * alpha;
      n.vx *= V_DECAY; n.vy *= V_DECAY;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(40, Math.min(width - 40, n.x));
      n.y = Math.max(40, Math.min(height - 40, n.y));
    }
    alphaRef.current = Math.max(ALPHA_MIN, alpha - ALPHA_DECAY);
  }, [width, height]);

  // Determine which nodes are "neighbors" of hovered
  const isNeighbor = useCallback((node: RuntimeNode): boolean => {
    const h = hovRef.current;
    if (!h || node === h) return false;
    return lsRef.current.some(
      l => (l.source === h && l.target === node) || (l.target === h && l.source === node),
    );
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    function draw() {
      if (!ctx) return;
      tick();
      ctx.clearRect(0, 0, width, height);
      const h = hovRef.current;

      // Links
      for (const l of lsRef.current) {
        const lit = h && (l.source === h || l.target === h);
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.strokeStyle = lit ? "#A29BFE" : "#E0E0E0";
        ctx.lineWidth = lit ? 2 : 0.7;
        ctx.stroke();
      }

      // Nodes
      for (const n of nsRef.current) {
        const isH = n === h;
        const isN = isNeighbor(n);
        const color = nodeColor(n.group);
        const r = isH ? R + 4 : isN ? R + 1 : R;

        // Glow for hovered
        if (isH) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 10, 0, Math.PI * 2);
          const g = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r + 10);
          g.addColorStop(0, color + "50");
          g.addColorStop(1, color + "00");
          ctx.fillStyle = g;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isH || isN ? color : color + "CC";
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Labels: only for hovered node and its direct neighbors
        if (isH || isN) {
          ctx.font = isH ? "bold 12px Inter, sans-serif" : LABEL_FONT;
          ctx.textAlign = "center";
          ctx.fillStyle = "#252525";
          const lbl = n.label.length > 35 ? n.label.slice(0, 34) + "…" : n.label;

          // Text background for readability
          const tw = ctx.measureText(lbl).width;
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(n.x - tw / 2 - 3, n.y - r - 17, tw + 6, 14);
          ctx.fillStyle = "#252525";
          ctx.fillText(lbl, n.x, n.y - r - 6);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [width, height, tick, isNeighbor]);

  function findNode(mx: number, my: number): RuntimeNode | null {
    for (const n of nsRef.current) {
      const dx = n.x - mx, dy = n.y - my;
      if (dx * dx + dy * dy < (R + 6) ** 2) return n;
    }
    return null;
  }

  function pos(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = pos(e);
    if (dragRef.current) {
      dragRef.current.x = x;
      dragRef.current.y = y;
      alphaRef.current = Math.max(alphaRef.current, 0.15);
      return;
    }
    const f = findNode(x, y);
    hovRef.current = f;
    setHovered(f);
  }

  function onDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const f = findNode(pos(e).x, pos(e).y);
    if (f) { dragRef.current = f; f.pinned = true; alphaRef.current = 0.3; }
  }

  function onUp() {
    if (dragRef.current) {
      if (onNodeClick && hovRef.current === dragRef.current) onNodeClick(dragRef.current);
      dragRef.current.pinned = false;
      dragRef.current = null;
    }
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        style={{ width, height, cursor: dragRef.current ? "grabbing" : hovered ? "grab" : "default", borderRadius: 12 }}
        className="card"
        onMouseMove={onMove}
        onMouseDown={onDown}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      />
      <div className="absolute bottom-4 left-4 flex gap-4 rounded-lg bg-white/95 px-4 py-2.5 text-[11px] shadow-sm backdrop-blur-sm">
        {[
          { label: "KB Article", color: "#3B82F6" },
          { label: "Script", color: "#8B5CF6" },
          { label: "Ticket", color: "#10B981" },
          { label: "Conversation", color: "#F59E0B" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: color }} />
            <span className="font-medium text-[var(--color-text-muted)]">{label}</span>
          </div>
        ))}
      </div>
      {hovered && !dragRef.current && (
        <div className="absolute right-4 top-4 card max-w-72 p-4">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: nodeColor(hovered.group) }} />
            <span className="badge bg-neutral-100 text-[var(--color-text-muted)] capitalize">
              {hovered.group.replace("_", " ")}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{hovered.label}</p>
          <p className="mt-1 font-mono text-[10px] text-[var(--color-text-muted)]">{hovered.id}</p>
          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{hovered.metadata?.module || hovered.metadata?.status || ""}</p>
        </div>
      )}
    </div>
  );
}
