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
}

interface RuntimeLink {
  source: RuntimeNode;
  target: RuntimeNode;
  relationship: string;
}

const NODE_RADIUS = 7;
const LABEL_FONT = "10px Inter, sans-serif";
const LINK_REST_LENGTH = 140;
const REPULSION = 2000;
const ATTRACTION = 0.003;
const CENTER_GRAVITY = 0.01;
const INITIAL_ALPHA = 1.0;
const ALPHA_DECAY = 0.0025;
const MIN_ALPHA = 0.001;
const VELOCITY_DECAY = 0.6;

/**
 * Force-directed knowledge graph with alpha decay (simulation settles),
 * drag interaction, labels, and glow effects.
 */
export function KnowledgeGraph({ nodes, links, width, height, onNodeClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<RuntimeNode[]>([]);
  const linksRef = useRef<RuntimeLink[]>([]);
  const alphaRef = useRef(INITIAL_ALPHA);
  const dragRef = useRef<RuntimeNode | null>(null);
  const hoveredRef = useRef<RuntimeNode | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);

  // Build simulation data
  useEffect(() => {
    const nodeMap = new Map<string, RuntimeNode>();
    const cx = width / 2;
    const cy = height / 2;

    const runtimeNodes: RuntimeNode[] = nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
      const r = Math.min(width, height) * 0.32;
      const rn: RuntimeNode = {
        ...n,
        x: cx + r * Math.cos(angle) + (Math.random() - 0.5) * 60,
        y: cy + r * Math.sin(angle) + (Math.random() - 0.5) * 60,
        vx: 0,
        vy: 0,
        pinned: false,
      };
      nodeMap.set(n.id, rn);
      return rn;
    });

    const runtimeLinks: RuntimeLink[] = [];
    for (const l of links) {
      const s = nodeMap.get(l.source);
      const t = nodeMap.get(l.target);
      if (s && t) runtimeLinks.push({ source: s, target: t, relationship: l.relationship });
    }

    nodesRef.current = runtimeNodes;
    linksRef.current = runtimeLinks;
    alphaRef.current = INITIAL_ALPHA;
  }, [nodes, links, width, height]);

  const tick = useCallback(() => {
    const ns = nodesRef.current;
    const ls = linksRef.current;
    const alpha = alphaRef.current;
    if (alpha < MIN_ALPHA && !dragRef.current) return;

    const cx = width / 2;
    const cy = height / 2;

    // Repulsion (charge)
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (REPULSION * alpha) / (dist * dist);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        if (!a.pinned) { a.vx += dx; a.vy += dy; }
        if (!b.pinned) { b.vx -= dx; b.vy -= dy; }
      }
    }

    // Link attraction
    for (const l of ls) {
      const dx = l.target.x - l.source.x;
      const dy = l.target.y - l.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - LINK_REST_LENGTH) * ATTRACTION * alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!l.source.pinned) { l.source.vx += fx; l.source.vy += fy; }
      if (!l.target.pinned) { l.target.vx -= fx; l.target.vy -= fy; }
    }

    // Integrate
    for (const n of ns) {
      if (n.pinned) { n.vx = 0; n.vy = 0; continue; }
      n.vx += (cx - n.x) * CENTER_GRAVITY * alpha;
      n.vy += (cy - n.y) * CENTER_GRAVITY * alpha;
      n.vx *= VELOCITY_DECAY;
      n.vy *= VELOCITY_DECAY;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(30, Math.min(width - 30, n.x));
      n.y = Math.max(30, Math.min(height - 30, n.y));
    }

    alphaRef.current = Math.max(MIN_ALPHA, alpha - ALPHA_DECAY);
  }, [width, height]);

  // Render
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

      const hov = hoveredRef.current;

      // Links
      for (const l of linksRef.current) {
        const isHov = hov && (l.source === hov || l.target === hov);
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.strokeStyle = isHov ? "#A29BFE" : "#E0E0E0";
        ctx.lineWidth = isHov ? 1.5 : 0.8;
        ctx.stroke();
      }

      // Nodes
      for (const n of nodesRef.current) {
        const isHov = n === hov;
        const color = nodeColor(n.group);
        const r = isHov ? NODE_RADIUS + 3 : NODE_RADIUS;

        // Glow
        if (isHov) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r + 6);
          grad.addColorStop(0, color + "40");
          grad.addColorStop(1, color + "00");
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.font = LABEL_FONT;
        ctx.textAlign = "center";
        ctx.fillStyle = isHov ? "#252525" : "#737373";
        const label = n.label.length > 28 ? n.label.slice(0, 27) + "…" : n.label;
        ctx.fillText(label, n.x, n.y - r - 5);
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [width, height, tick]);

  function findNode(mx: number, my: number): RuntimeNode | null {
    for (const n of nodesRef.current) {
      const dx = n.x - mx;
      const dy = n.y - my;
      if (dx * dx + dy * dy < (NODE_RADIUS + 4) ** 2) return n;
    }
    return null;
  }

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = getCanvasPos(e);
    if (dragRef.current) {
      dragRef.current.x = x;
      dragRef.current.y = y;
      alphaRef.current = Math.max(alphaRef.current, 0.1);
      return;
    }
    const found = findNode(x, y);
    hoveredRef.current = found;
    setHovered(found);
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = getCanvasPos(e);
    const found = findNode(x, y);
    if (found) {
      dragRef.current = found;
      found.pinned = true;
      alphaRef.current = 0.3;
    }
  }

  function handleMouseUp() {
    if (dragRef.current) {
      if (onNodeClick && hoveredRef.current === dragRef.current) {
        onNodeClick(dragRef.current);
      }
      dragRef.current.pinned = false;
      dragRef.current = null;
    }
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        style={{ width, height, cursor: hovered ? "grab" : "default", borderRadius: 12 }}
        className="card"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Legend */}
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

      {/* Hover card */}
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
        </div>
      )}
    </div>
  );
}
