(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/api.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * API client for communicating with the SupportMind backend.
 * All requests go through Next.js rewrites → FastAPI.
 */ __turbopack_context__.s([
    "askCopilot",
    ()=>askCopilot,
    "fetchKBArticles",
    ()=>fetchKBArticles,
    "fetchKnowledgeGraph",
    ()=>fetchKnowledgeGraph,
    "fetchLearningEvents",
    ()=>fetchLearningEvents,
    "fetchStats",
    ()=>fetchStats,
    "fetchTickets",
    ()=>fetchTickets,
    "generateDraft",
    ()=>generateDraft,
    "reviewEvent",
    ()=>reviewEvent,
    "scoreQA",
    ()=>scoreQA
]);
const BASE = "/api";
async function request(path, options) {
    const res = await fetch("".concat(BASE).concat(path), {
        headers: {
            "Content-Type": "application/json",
            ...options === null || options === void 0 ? void 0 : options.headers
        },
        ...options
    });
    if (!res.ok) {
        const body = await res.json().catch(()=>({}));
        throw new Error(body.detail || "Request failed: ".concat(res.status));
    }
    return res.json();
}
function fetchStats() {
    return request("/stats");
}
function askCopilot(question) {
    return request("/copilot/ask", {
        method: "POST",
        body: JSON.stringify({
            question
        })
    });
}
function fetchKBArticles() {
    let page = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 1, search = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "";
    const params = new URLSearchParams({
        page: String(page),
        search
    });
    return request("/knowledge/articles?".concat(params));
}
function fetchKnowledgeGraph() {
    let limit = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 80;
    return request("/knowledge/graph?limit=".concat(limit));
}
function fetchLearningEvents() {
    let status = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : "", page = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 1;
    const params = new URLSearchParams({
        status,
        page: String(page)
    });
    return request("/learning/events?".concat(params));
}
function generateDraft(ticketNumber) {
    return request("/learning/generate-draft", {
        method: "POST",
        body: JSON.stringify({
            ticket_number: ticketNumber
        })
    });
}
function reviewEvent(eventId, action) {
    let notes = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : "";
    return request("/learning/review", {
        method: "POST",
        body: JSON.stringify({
            event_id: eventId,
            action,
            reviewer_notes: notes
        })
    });
}
function scoreQA(ticketNumber) {
    return request("/qa/score", {
        method: "POST",
        body: JSON.stringify({
            ticket_number: ticketNumber
        })
    });
}
function fetchTickets() {
    let page = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 1, search = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "", status = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : "";
    const params = new URLSearchParams({
        page: String(page),
        search,
        status
    });
    return request("/tickets?".concat(params));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/KnowledgeGraph.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "KnowledgeGraph",
    ()=>KnowledgeGraph
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function KnowledgeGraph(param) {
    let { nodes, links, width, height, onNodeClick } = param;
    _s();
    const canvasRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const animRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    const nodesRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    const linksRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    const hoveredRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [hovered, setHovered] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Initialize simulation data
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "KnowledgeGraph.useEffect": ()=>{
            const nodeMap = new Map();
            const runtimeNodes = nodes.map({
                "KnowledgeGraph.useEffect.runtimeNodes": (n, i)=>{
                    const angle = 2 * Math.PI * i / nodes.length;
                    const radius = Math.min(width, height) * 0.35;
                    const rn = {
                        ...n,
                        x: width / 2 + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
                        y: height / 2 + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
                        vx: 0,
                        vy: 0
                    };
                    nodeMap.set(n.id, rn);
                    return rn;
                }
            }["KnowledgeGraph.useEffect.runtimeNodes"]);
            const runtimeLinks = links.map({
                "KnowledgeGraph.useEffect.runtimeLinks": (l)=>{
                    var _nodeMap_get, _nodeMap_get1;
                    return {
                        source: (_nodeMap_get = nodeMap.get(l.source)) !== null && _nodeMap_get !== void 0 ? _nodeMap_get : l.source,
                        target: (_nodeMap_get1 = nodeMap.get(l.target)) !== null && _nodeMap_get1 !== void 0 ? _nodeMap_get1 : l.target,
                        relationship: l.relationship
                    };
                }
            }["KnowledgeGraph.useEffect.runtimeLinks"]).filter({
                "KnowledgeGraph.useEffect.runtimeLinks": (l)=>typeof l.source !== "string" && typeof l.target !== "string"
            }["KnowledgeGraph.useEffect.runtimeLinks"]);
            nodesRef.current = runtimeNodes;
            linksRef.current = runtimeLinks;
        }
    }["KnowledgeGraph.useEffect"], [
        nodes,
        links,
        width,
        height
    ]);
    // Simple force simulation
    const tick = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "KnowledgeGraph.useCallback[tick]": ()=>{
            const ns = nodesRef.current;
            const ls = linksRef.current;
            const cx = width / 2;
            const cy = height / 2;
            const damping = 0.92;
            // Repulsion between nodes
            for(let i = 0; i < ns.length; i++){
                for(let j = i + 1; j < ns.length; j++){
                    var _ns_i_x, _ns_j_x;
                    const dx = ((_ns_i_x = ns[i].x) !== null && _ns_i_x !== void 0 ? _ns_i_x : 0) - ((_ns_j_x = ns[j].x) !== null && _ns_j_x !== void 0 ? _ns_j_x : 0);
                    var _ns_i_y, _ns_j_y;
                    const dy = ((_ns_i_y = ns[i].y) !== null && _ns_i_y !== void 0 ? _ns_i_y : 0) - ((_ns_j_y = ns[j].y) !== null && _ns_j_y !== void 0 ? _ns_j_y : 0);
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = 800 / (dist * dist);
                    const fx = dx / dist * force;
                    const fy = dy / dist * force;
                    var _ns_i_vx;
                    ns[i].vx = ((_ns_i_vx = ns[i].vx) !== null && _ns_i_vx !== void 0 ? _ns_i_vx : 0) + fx;
                    var _ns_i_vy;
                    ns[i].vy = ((_ns_i_vy = ns[i].vy) !== null && _ns_i_vy !== void 0 ? _ns_i_vy : 0) + fy;
                    var _ns_j_vx;
                    ns[j].vx = ((_ns_j_vx = ns[j].vx) !== null && _ns_j_vx !== void 0 ? _ns_j_vx : 0) - fx;
                    var _ns_j_vy;
                    ns[j].vy = ((_ns_j_vy = ns[j].vy) !== null && _ns_j_vy !== void 0 ? _ns_j_vy : 0) - fy;
                }
            }
            // Attraction along links
            for (const l of ls){
                const s = l.source;
                const t = l.target;
                var _t_x, _s_x;
                const dx = ((_t_x = t.x) !== null && _t_x !== void 0 ? _t_x : 0) - ((_s_x = s.x) !== null && _s_x !== void 0 ? _s_x : 0);
                var _t_y, _s_y;
                const dy = ((_t_y = t.y) !== null && _t_y !== void 0 ? _t_y : 0) - ((_s_y = s.y) !== null && _s_y !== void 0 ? _s_y : 0);
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist - 120) * 0.005;
                const fx = dx / dist * force;
                const fy = dy / dist * force;
                var _s_vx;
                s.vx = ((_s_vx = s.vx) !== null && _s_vx !== void 0 ? _s_vx : 0) + fx;
                var _s_vy;
                s.vy = ((_s_vy = s.vy) !== null && _s_vy !== void 0 ? _s_vy : 0) + fy;
                var _t_vx;
                t.vx = ((_t_vx = t.vx) !== null && _t_vx !== void 0 ? _t_vx : 0) - fx;
                var _t_vy;
                t.vy = ((_t_vy = t.vy) !== null && _t_vy !== void 0 ? _t_vy : 0) - fy;
            }
            // Center gravity + update positions
            for (const n of ns){
                var _n_vx, _n_x;
                n.vx = (((_n_vx = n.vx) !== null && _n_vx !== void 0 ? _n_vx : 0) + (cx - ((_n_x = n.x) !== null && _n_x !== void 0 ? _n_x : 0)) * 0.001) * damping;
                var _n_vy, _n_y;
                n.vy = (((_n_vy = n.vy) !== null && _n_vy !== void 0 ? _n_vy : 0) + (cy - ((_n_y = n.y) !== null && _n_y !== void 0 ? _n_y : 0)) * 0.001) * damping;
                var _n_x1, _n_vx1;
                n.x = ((_n_x1 = n.x) !== null && _n_x1 !== void 0 ? _n_x1 : 0) + ((_n_vx1 = n.vx) !== null && _n_vx1 !== void 0 ? _n_vx1 : 0);
                var _n_y1, _n_vy1;
                n.y = ((_n_y1 = n.y) !== null && _n_y1 !== void 0 ? _n_y1 : 0) + ((_n_vy1 = n.vy) !== null && _n_vy1 !== void 0 ? _n_vy1 : 0);
                // Boundary clamping
                n.x = Math.max(20, Math.min(width - 20, n.x));
                n.y = Math.max(20, Math.min(height - 20, n.y));
            }
        }
    }["KnowledgeGraph.useCallback[tick]"], [
        width,
        height
    ]);
    // Render loop
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "KnowledgeGraph.useEffect": ()=>{
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
                for (const l of linksRef.current){
                    const s = l.source;
                    const t = l.target;
                    ctx.beginPath();
                    var _s_x, _s_y;
                    ctx.moveTo((_s_x = s.x) !== null && _s_x !== void 0 ? _s_x : 0, (_s_y = s.y) !== null && _s_y !== void 0 ? _s_y : 0);
                    var _t_x, _t_y;
                    ctx.lineTo((_t_x = t.x) !== null && _t_x !== void 0 ? _t_x : 0, (_t_y = t.y) !== null && _t_y !== void 0 ? _t_y : 0);
                    ctx.stroke();
                }
                // Draw nodes
                const hov = hoveredRef.current;
                for (const n of nodesRef.current){
                    const r = n === hov ? 8 : 5;
                    const color = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nodeColor"])(n.group);
                    ctx.beginPath();
                    var _n_x, _n_y;
                    ctx.arc((_n_x = n.x) !== null && _n_x !== void 0 ? _n_x : 0, (_n_y = n.y) !== null && _n_y !== void 0 ? _n_y : 0, r, 0, Math.PI * 2);
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
                    var _hov_x, _hov_y;
                    ctx.fillText(hov.label, (_hov_x = hov.x) !== null && _hov_x !== void 0 ? _hov_x : 0, ((_hov_y = hov.y) !== null && _hov_y !== void 0 ? _hov_y : 0) - 12);
                }
                animRef.current = requestAnimationFrame(draw);
            }
            animRef.current = requestAnimationFrame(draw);
            return ({
                "KnowledgeGraph.useEffect": ()=>cancelAnimationFrame(animRef.current)
            })["KnowledgeGraph.useEffect"];
        }
    }["KnowledgeGraph.useEffect"], [
        width,
        height,
        tick
    ]);
    // Mouse interaction
    function handleMouseMove(e) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        let found = null;
        for (const n of nodesRef.current){
            var _n_x;
            const dx = ((_n_x = n.x) !== null && _n_x !== void 0 ? _n_x : 0) - mx;
            var _n_y;
            const dy = ((_n_y = n.y) !== null && _n_y !== void 0 ? _n_y : 0) - my;
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("canvas", {
                ref: canvasRef,
                width: width,
                height: height,
                className: "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]",
                style: {
                    cursor: hovered ? "pointer" : "default"
                },
                onMouseMove: handleMouseMove,
                onClick: handleClick
            }, void 0, false, {
                fileName: "[project]/src/components/KnowledgeGraph.tsx",
                lineNumber: 207,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute bottom-3 left-3 flex gap-4 rounded-md bg-white/90 px-3 py-2 text-[11px] backdrop-blur-sm",
                children: [
                    {
                        label: "KB Article",
                        color: "#3B82F6"
                    },
                    {
                        label: "Script",
                        color: "#8B5CF6"
                    },
                    {
                        label: "Ticket",
                        color: "#10B981"
                    },
                    {
                        label: "Conversation",
                        color: "#F59E0B"
                    }
                ].map((param)=>{
                    let { label, color } = param;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-1.5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "inline-block h-2.5 w-2.5 rounded-full",
                                style: {
                                    backgroundColor: color
                                }
                            }, void 0, false, {
                                fileName: "[project]/src/components/KnowledgeGraph.tsx",
                                lineNumber: 226,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[var(--color-text-muted)]",
                                children: label
                            }, void 0, false, {
                                fileName: "[project]/src/components/KnowledgeGraph.tsx",
                                lineNumber: 227,
                                columnNumber: 13
                            }, this)
                        ]
                    }, label, true, {
                        fileName: "[project]/src/components/KnowledgeGraph.tsx",
                        lineNumber: 225,
                        columnNumber: 11
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/src/components/KnowledgeGraph.tsx",
                lineNumber: 218,
                columnNumber: 7
            }, this),
            hovered && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute right-3 top-3 max-w-64 rounded-md border border-[var(--color-border)] bg-white p-3 shadow-sm",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "inline-block h-2 w-2 rounded-full",
                                style: {
                                    backgroundColor: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nodeColor"])(hovered.group)
                                }
                            }, void 0, false, {
                                fileName: "[project]/src/components/KnowledgeGraph.tsx",
                                lineNumber: 236,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[11px] font-medium capitalize text-[var(--color-text-muted)]",
                                children: hovered.group.replace("_", " ")
                            }, void 0, false, {
                                fileName: "[project]/src/components/KnowledgeGraph.tsx",
                                lineNumber: 237,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/KnowledgeGraph.tsx",
                        lineNumber: 235,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-1 text-xs font-medium text-[var(--color-text)]",
                        children: hovered.label
                    }, void 0, false, {
                        fileName: "[project]/src/components/KnowledgeGraph.tsx",
                        lineNumber: 241,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)]",
                        children: hovered.id
                    }, void 0, false, {
                        fileName: "[project]/src/components/KnowledgeGraph.tsx",
                        lineNumber: 242,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/KnowledgeGraph.tsx",
                lineNumber: 234,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/KnowledgeGraph.tsx",
        lineNumber: 206,
        columnNumber: 5
    }, this);
}
_s(KnowledgeGraph, "J9mJg2NMdnPmt2nIWjKS6tjzElM=");
_c = KnowledgeGraph;
var _c;
__turbopack_context__.k.register(_c, "KnowledgeGraph");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/knowledge/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>KnowledgePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/search.js [app-client] (ecmascript) <export default as Search>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/book-open.js [app-client] (ecmascript) <export default as BookOpen>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$KnowledgeGraph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/KnowledgeGraph.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
function KnowledgePage() {
    _s();
    const [graphData, setGraphData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [articles, setArticles] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [totalArticles, setTotalArticles] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [search, setSearch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [page, setPage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(1);
    const [selectedNode, setSelectedNode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const containerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [graphWidth, setGraphWidth] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(800);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "KnowledgePage.useEffect": ()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fetchKnowledgeGraph"])(100).then(setGraphData).catch({
                "KnowledgePage.useEffect": ()=>{}
            }["KnowledgePage.useEffect"]);
        }
    }["KnowledgePage.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "KnowledgePage.useEffect": ()=>{
            setLoading(true);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fetchKBArticles"])(page, search).then({
                "KnowledgePage.useEffect": (res)=>{
                    setArticles(res.data);
                    setTotalArticles(res.meta.total);
                }
            }["KnowledgePage.useEffect"]).catch({
                "KnowledgePage.useEffect": ()=>{}
            }["KnowledgePage.useEffect"]).finally({
                "KnowledgePage.useEffect": ()=>setLoading(false)
            }["KnowledgePage.useEffect"]);
        }
    }["KnowledgePage.useEffect"], [
        page,
        search
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "KnowledgePage.useEffect": ()=>{
            function measure() {
                if (containerRef.current) {
                    setGraphWidth(containerRef.current.offsetWidth);
                }
            }
            measure();
            window.addEventListener("resize", measure);
            return ({
                "KnowledgePage.useEffect": ()=>window.removeEventListener("resize", measure)
            })["KnowledgePage.useEffect"];
        }
    }["KnowledgePage.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "text-xl font-semibold text-[var(--color-text)]",
                        children: "Knowledge Base"
                    }, void 0, false, {
                        fileName: "[project]/src/app/knowledge/page.tsx",
                        lineNumber: 51,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-1 text-sm text-[var(--color-text-muted)]",
                        children: "Explore the knowledge graph and browse articles with full provenance"
                    }, void 0, false, {
                        fileName: "[project]/src/app/knowledge/page.tsx",
                        lineNumber: 52,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/knowledge/page.tsx",
                lineNumber: 50,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: containerRef,
                className: "mb-8",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "mb-3 text-sm font-semibold text-[var(--color-text)]",
                        children: "Knowledge Graph"
                    }, void 0, false, {
                        fileName: "[project]/src/app/knowledge/page.tsx",
                        lineNumber: 59,
                        columnNumber: 9
                    }, this),
                    graphData && graphData.nodes.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$KnowledgeGraph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["KnowledgeGraph"], {
                        nodes: graphData.nodes,
                        links: graphData.links,
                        width: graphWidth,
                        height: 420,
                        onNodeClick: setSelectedNode
                    }, void 0, false, {
                        fileName: "[project]/src/app/knowledge/page.tsx",
                        lineNumber: 61,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex h-64 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent"
                        }, void 0, false, {
                            fileName: "[project]/src/app/knowledge/page.tsx",
                            lineNumber: 70,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/knowledge/page.tsx",
                        lineNumber: 69,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/knowledge/page.tsx",
                lineNumber: 58,
                columnNumber: 7
            }, this),
            selectedNode && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "inline-block h-3 w-3 rounded-full",
                                        style: {
                                            backgroundColor: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(selectedNode.group === "kb_article" ? "#3B82F6" : selectedNode.group === "script" ? "#8B5CF6" : selectedNode.group === "ticket" ? "#10B981" : "#F59E0B")
                                        }
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/knowledge/page.tsx",
                                        lineNumber: 80,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xs font-medium capitalize text-[var(--color-text-muted)]",
                                        children: selectedNode.group.replace("_", " ")
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/knowledge/page.tsx",
                                        lineNumber: 81,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/knowledge/page.tsx",
                                lineNumber: 79,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setSelectedNode(null),
                                className: "text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                                children: "Close"
                            }, void 0, false, {
                                fileName: "[project]/src/app/knowledge/page.tsx",
                                lineNumber: 85,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/knowledge/page.tsx",
                        lineNumber: 78,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-2 text-sm font-medium text-[var(--color-text)]",
                        children: selectedNode.label
                    }, void 0, false, {
                        fileName: "[project]/src/app/knowledge/page.tsx",
                        lineNumber: 92,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-1 font-mono text-xs text-[var(--color-text-muted)]",
                        children: selectedNode.id
                    }, void 0, false, {
                        fileName: "[project]/src/app/knowledge/page.tsx",
                        lineNumber: 93,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/knowledge/page.tsx",
                lineNumber: 77,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-4 flex items-center gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-sm font-semibold text-[var(--color-text)]",
                                children: [
                                    "Articles (",
                                    totalArticles,
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/knowledge/page.tsx",
                                lineNumber: 100,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "relative ml-auto w-64",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"], {
                                        size: 14,
                                        className: "absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/knowledge/page.tsx",
                                        lineNumber: 104,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        value: search,
                                        onChange: (e)=>{
                                            setSearch(e.target.value);
                                            setPage(1);
                                        },
                                        placeholder: "Search articles…",
                                        className: "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-3 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/knowledge/page.tsx",
                                        lineNumber: 105,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/knowledge/page.tsx",
                                lineNumber: 103,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/knowledge/page.tsx",
                        lineNumber: 99,
                        columnNumber: 9
                    }, this),
                    loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex h-32 items-center justify-center",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent"
                        }, void 0, false, {
                            fileName: "[project]/src/app/knowledge/page.tsx",
                            lineNumber: 116,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/knowledge/page.tsx",
                        lineNumber: 115,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-2",
                        children: articles.map((art)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:bg-neutral-50",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__["BookOpen"], {
                                        size: 16,
                                        strokeWidth: 1.6,
                                        className: "mt-0.5 shrink-0 text-blue-500"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/knowledge/page.tsx",
                                        lineNumber: 125,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "min-w-0 flex-1",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm font-medium text-[var(--color-text)]",
                                                children: art.Title || art.KB_Article_ID
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/knowledge/page.tsx",
                                                lineNumber: 127,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]",
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["truncate"])(art.Body || "", 180)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/knowledge/page.tsx",
                                                lineNumber: 130,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-2 flex items-center gap-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "font-mono text-[10px] text-[var(--color-text-muted)]",
                                                        children: art.KB_Article_ID
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/knowledge/page.tsx",
                                                        lineNumber: 134,
                                                        columnNumber: 21
                                                    }, this),
                                                    art.Module && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]",
                                                        children: art.Module
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/knowledge/page.tsx",
                                                        lineNumber: 138,
                                                        columnNumber: 23
                                                    }, this),
                                                    art.Source_Type && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600",
                                                        children: art.Source_Type
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/knowledge/page.tsx",
                                                        lineNumber: 143,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/knowledge/page.tsx",
                                                lineNumber: 133,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/knowledge/page.tsx",
                                        lineNumber: 126,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, art.KB_Article_ID, true, {
                                fileName: "[project]/src/app/knowledge/page.tsx",
                                lineNumber: 121,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/app/knowledge/page.tsx",
                        lineNumber: 119,
                        columnNumber: 11
                    }, this),
                    totalArticles > 20 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 flex items-center justify-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setPage((p)=>Math.max(1, p - 1)),
                                disabled: page === 1,
                                className: "rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-neutral-50 disabled:opacity-40",
                                children: "Previous"
                            }, void 0, false, {
                                fileName: "[project]/src/app/knowledge/page.tsx",
                                lineNumber: 157,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs text-[var(--color-text-muted)]",
                                children: [
                                    "Page ",
                                    page,
                                    " of ",
                                    Math.ceil(totalArticles / 20)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/knowledge/page.tsx",
                                lineNumber: 164,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setPage((p)=>p + 1),
                                disabled: page >= Math.ceil(totalArticles / 20),
                                className: "rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-neutral-50 disabled:opacity-40",
                                children: "Next"
                            }, void 0, false, {
                                fileName: "[project]/src/app/knowledge/page.tsx",
                                lineNumber: 167,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/knowledge/page.tsx",
                        lineNumber: 156,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/knowledge/page.tsx",
                lineNumber: 98,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_s(KnowledgePage, "GLGqZvvE8MhODC9BgHWwfTF/uk8=");
_c = KnowledgePage;
var _c;
__turbopack_context__.k.register(_c, "KnowledgePage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/node_modules/lucide-react/dist/esm/icons/search.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * @license lucide-react v0.513.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ __turbopack_context__.s([
    "__iconNode",
    ()=>__iconNode,
    "default",
    ()=>Search
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$createLucideIcon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/createLucideIcon.js [app-client] (ecmascript)");
;
const __iconNode = [
    [
        "path",
        {
            d: "m21 21-4.34-4.34",
            key: "14j7rj"
        }
    ],
    [
        "circle",
        {
            cx: "11",
            cy: "11",
            r: "8",
            key: "4ej97u"
        }
    ]
];
const Search = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$createLucideIcon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("search", __iconNode);
;
 //# sourceMappingURL=search.js.map
}),
"[project]/node_modules/lucide-react/dist/esm/icons/search.js [app-client] (ecmascript) <export default as Search>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Search",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/search.js [app-client] (ecmascript)");
}),
"[project]/node_modules/lucide-react/dist/esm/icons/book-open.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * @license lucide-react v0.513.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ __turbopack_context__.s([
    "__iconNode",
    ()=>__iconNode,
    "default",
    ()=>BookOpen
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$createLucideIcon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/createLucideIcon.js [app-client] (ecmascript)");
;
const __iconNode = [
    [
        "path",
        {
            d: "M12 7v14",
            key: "1akyts"
        }
    ],
    [
        "path",
        {
            d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
            key: "ruj8y"
        }
    ]
];
const BookOpen = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$createLucideIcon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])("book-open", __iconNode);
;
 //# sourceMappingURL=book-open.js.map
}),
"[project]/node_modules/lucide-react/dist/esm/icons/book-open.js [app-client] (ecmascript) <export default as BookOpen>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BookOpen",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/book-open.js [app-client] (ecmascript)");
}),
]);

//# sourceMappingURL=_2667cc6e._.js.map