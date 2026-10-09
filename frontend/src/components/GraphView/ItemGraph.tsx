import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { ItemData, ItemEdgeData } from "../../store/useGraphStore";
import { useSettingsStore, type NodeShape } from "../../store/useSettingsStore";
import { splitTitleTwoLines } from "../../utils/text";
import { FLAG_DEFINITIONS, FlagType } from "../NodePanel/FlagEditor";

type Props = {
  items: ItemData[];
  edges: ItemEdgeData[];
  selectedId: string | null;
  selectedIds?: string[];
  hasChildrenIds: Set<string>;
  expandedIds?: Set<string>;
  onToggleExpand?: (id: string) => void;
  focusItemId?: string | null;
  focusNonce?: number;
  highlightNodeId?: string | null;
  onSelect: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  onOpenMergeModal?: (items: ItemData[]) => void;
  onClearMultiSelect?: () => void;
  onNodeContextMenu: (id: string, x: number, y: number) => void;
  onBackgroundContextMenu: (graphX: number, graphY: number, screenX: number, screenY: number) => void;
  onNodeDragEnd: (id: string, graphX: number, graphY: number) => void;
  onGraphPositionsCommit: (positions: Array<{ id: string; x: number; y: number }>) => void;
};

export function getNormalizedResourceKey(item: ItemData): string | null {
  const urlOrPath = item.source_url || item.file_path;
  if (!urlOrPath) return null;
  let key = urlOrPath.trim().toLowerCase();
  if (key.startsWith("http://")) key = "https://" + key.slice(7);
  if (key.includes("arxiv.org/abs/")) key = key.replace("arxiv.org/abs/", "arxiv.org/pdf/");
  if (key.includes("arxiv.org/pdf/") && !key.endsWith(".pdf")) key += ".pdf";
  if (key.endsWith("/")) key = key.slice(0, -1);
  return key;
}

interface SimNode extends ItemData {
  x: number;
  y: number;
}

interface SimLink {
  source: string;
  target: string;
  relationship?: string;
}

const NODE_R = 16;

export function ItemGraph({
  items, edges, selectedId, selectedIds = [], hasChildrenIds, expandedIds, onToggleExpand, focusItemId, focusNonce, highlightNodeId,
  onSelect, onToggleSelect, onOpenMergeModal, onClearMultiSelect,
  onNodeContextMenu, onBackgroundContextMenu, onNodeDragEnd, onGraphPositionsCommit,
}: Props) {

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodeByIdRef = useRef<Map<string, SimNode>>(new Map());

  const { shapes, getProgressColor, highlightColor } = useSettingsStore();

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onToggleSelectRef = useRef(onToggleSelect);
  onToggleSelectRef.current = onToggleSelect;
  const onNodeContextMenuRef = useRef(onNodeContextMenu);
  onNodeContextMenuRef.current = onNodeContextMenu;
  const onBackgroundContextMenuRef = useRef(onBackgroundContextMenu);
  onBackgroundContextMenuRef.current = onBackgroundContextMenu;
  const onNodeDragEndRef = useRef(onNodeDragEnd);
  onNodeDragEndRef.current = onNodeDragEnd;
  const expandedIdsRef = useRef(expandedIds);
  expandedIdsRef.current = expandedIds;
  const onToggleExpandRef = useRef(onToggleExpand);
  onToggleExpandRef.current = onToggleExpand;


  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!container || !svgEl) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const svg = d3.select(svgEl);

    if (svg.select("g").empty()) {
      svg.selectAll("*").remove();
      const g = svg.append("g");
      gRef.current = g;
    }

    const g = gRef.current;
    if (!g) return;

    const prevNodes = nodeByIdRef.current;
    const nextNodes = new Map<string, SimNode>(prevNodes);

    const nodes: SimNode[] = items.map((item, index) => {
      const prev = prevNodes.get(item.id);
      const x = item.graph_x ?? prev?.x ?? (width / 2 + ((index % 4) - 1.5) * 120);
      const y = item.graph_y ?? prev?.y ?? (height / 2 + Math.floor(index / 4) * 90);
      const node = { ...item, x, y };
      nextNodes.set(item.id, node);
      return node;
    });

    nodeByIdRef.current = nextNodes;

    const links: SimLink[] = edges.map((edge) => ({
      source: edge.source_item_id,
      target: edge.target_item_id,
      relationship: edge.relationship,
    }));

    const defs = svg.selectAll("defs").data([null]).join("defs");
    defs
      .selectAll("marker#arrow-parent-child")
      .data([null])
      .join("marker")
      .attr("id", "arrow-parent-child")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", NODE_R + 8)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .html('<path d="M0,-5L10,0L0,5" fill="#9ca3af"></path>');

    defs
      .selectAll("marker#arrow-waiting-on")
      .data([null])
      .join("marker")
      .attr("id", "arrow-waiting-on")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", NODE_R + 8)
      .attr("refY", 0)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto")
      .html('<path d="M0,-5L10,0L0,5" fill="#f59e0b"></path>');

    const link = g
      .selectAll<SVGLineElement, SimLink>("line")
      .data(links, (d) => `${d.source}->${d.target}->${d.relationship ?? ""}`)
      .join("line")
      .attr("stroke", (d) => (d.relationship === "waiting_on" ? "#f59e0b" : "#4b5563"))
      .attr("stroke-width", (d) => (d.relationship === "waiting_on" ? 2.5 : 1.5))
      .attr("stroke-dasharray", (d) => (d.relationship === "waiting_on" ? "5,3" : null))
      .attr("marker-end", (d) =>
        d.relationship === "waiting_on"
          ? "url(#arrow-waiting-on)"
          : d.relationship === "parent_child"
          ? "url(#arrow-parent-child)"
          : null
      );

    const renderShapeForNode = (group: d3.Selection<SVGGElement, SimNode, null, undefined>, shape: NodeShape, fill: string, r: number) => {
      group.selectAll(".node-core").remove();
      let elem: d3.Selection<SVGElement, SimNode, null, undefined>;
      switch (shape) {
        case "rounded-rect":
          elem = group.insert("rect", ":first-child").attr("x", -r).attr("y", -r).attr("width", r * 2).attr("height", r * 2).attr("rx", 4) as unknown as d3.Selection<SVGElement, SimNode, null, undefined>;
          break;
        case "rect":
          elem = group.insert("rect", ":first-child").attr("x", -r).attr("y", -r).attr("width", r * 2).attr("height", r * 2) as unknown as d3.Selection<SVGElement, SimNode, null, undefined>;
          break;
        case "hexagon":
          elem = group.insert("polygon", ":first-child").attr("points", `0,${-r*1.1} ${r},${-r*0.55} ${r},${r*0.55} 0,${r*1.1} ${-r},${r*0.55} ${-r},${-r*0.55}`) as unknown as d3.Selection<SVGElement, SimNode, null, undefined>;
          break;
        case "diamond":
          elem = group.insert("polygon", ":first-child").attr("points", `0,${-r*1.25} ${r*1.25},0 0,${r*1.25} ${-r*1.25},0`) as unknown as d3.Selection<SVGElement, SimNode, null, undefined>;
          break;
        case "octagon":
          elem = group.insert("polygon", ":first-child").attr("points", `${-r*0.4},${-r} ${r*0.4},${-r} ${r},${-r*0.4} ${r},${r*0.4} ${r*0.4},${r} ${-r*0.4},${r} ${-r},${r*0.4} ${-r},${-r*0.4}`) as unknown as d3.Selection<SVGElement, SimNode, null, undefined>;
          break;
        case "circle":
        default:
          elem = group.insert("circle", ":first-child").attr("r", r) as unknown as d3.Selection<SVGElement, SimNode, null, undefined>;
          break;
      }
      elem.attr("class", "node-core").attr("stroke", "#374151").attr("stroke-width", 2).attr("fill", fill);
    };

    const node = g
      .selectAll<SVGGElement, SimNode>("g.node")
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const group = enter.append("g").attr("class", "node").style("cursor", "pointer").style("opacity", (d) => d.opacity ?? 1.0);

        group
          .append("circle")
          .attr("class", "node-role-ring")
          .attr("r", NODE_R + 3)
          .attr("fill", "none")
          .attr("stroke-width", 2.5)
          .attr("opacity", 0)
          .style("pointer-events", "none");

        group
          .append("circle")
          .attr("class", "node-selected-ring")
          .attr("r", NODE_R + 6)
          .attr("fill", "none")
          .attr("stroke", "#60a5fa")
          .attr("stroke-width", 2.5)
          .attr("opacity", 0)
          .style("pointer-events", "none");

        group
          .append("circle")
          .attr("class", "node-duplicate-ring")
          .attr("r", NODE_R + 9)
          .attr("fill", "none")
          .attr("stroke", "#f59e0b")
          .attr("stroke-width", 2.5)
          .attr("stroke-dasharray", "4,3")
          .attr("opacity", 0)
          .style("pointer-events", "none");

        group
          .append("circle")
          .attr("class", "node-highlight-ring")
          .attr("r", NODE_R + 12)
          .attr("fill", "none")
          .attr("stroke", highlightColor)
          .attr("stroke-width", 2.5)
          .attr("opacity", 0)
          .style("pointer-events", "none");

        group
          .append("circle")
          .attr("class", "node-blocker-ring")
          .attr("r", NODE_R + 8)
          .attr("fill", "none")
          .attr("stroke", "#f59e0b")
          .attr("stroke-width", 3)
          .attr("stroke-dasharray", "4,2")
          .attr("opacity", 0)
          .style("pointer-events", "none");

        group
          .append("g")
          .attr("class", "node-flags-badges")
          .style("pointer-events", "none");

        group
          .append("circle")
          .attr("class", "node-hit")
          .attr("r", NODE_R + 4)
          .attr("fill", "transparent")
          .style("pointer-events", "all");

        group
          .append("text")
          .attr("class", "node-title")
          .attr("text-anchor", "middle")
          .attr("y", -NODE_R - 6)
          .attr("fill", "#d1d5db")
          .attr("font-size", "11px")
          .style("pointer-events", "none");

        group
          .append("title")
          .attr("class", "node-tooltip");

        const plus = group
          .append("g")
          .attr("class", "node-children-badge")
          .style("pointer-events", "all")
          .style("cursor", "pointer");

        plus
          .append("circle")
          .attr("r", 7.5)
          .attr("fill", "rgba(17, 24, 39, 0.95)")
          .attr("stroke", "#e5e7eb")
          .attr("stroke-width", 1.25);

        plus
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("fill", "#f9fafb")
          .attr("font-size", "12px")
          .attr("font-weight", 700)
          .text("+");

        plus.on("mousedown", (event) => {
          event.stopPropagation();
        });

        plus.on("click", (event, d) => {
          event.stopPropagation();
          event.preventDefault();
          if (onToggleExpandRef.current) {
            onToggleExpandRef.current(d.id);
          }
        });

        group.on("click", (event, d) => {
          if (event.ctrlKey || event.metaKey) {
            if (onToggleSelectRef.current) {
              onToggleSelectRef.current(d.id);
            }
          } else {
            onSelectRef.current(d.id);
          }
        });
        group.on("contextmenu", (event, d) => {
          event.preventDefault();
          event.stopPropagation();
          onNodeContextMenuRef.current(d.id, event.clientX, event.clientY);
        });

        return group;
      });


    node.each(function (d) {
      const grp = d3.select(this) as d3.Selection<SVGGElement, SimNode, null, undefined>;
      const targetShape: NodeShape = shapes[d.type] || "circle";
      const fill = getProgressColor(d.progress);
      const nodeR = d.is_local ? 10 : NODE_R;

      renderShapeForNode(grp, targetShape, fill, nodeR);
      grp.select(".node-role-ring").attr("r", nodeR + 3);
      grp.select(".node-selected-ring").attr("r", nodeR + 6);
      grp.select(".node-duplicate-ring").attr("r", nodeR + 9);
      grp.select(".node-highlight-ring").attr("r", nodeR + 12);
      grp.select(".node-hit").attr("r", nodeR + 4);
    });

    node.each(function (d) {
      const { line1, line2, fullTitle } = splitTitleTwoLines(d.title);
      const textEl = d3.select(this).select<SVGTextElement>(".node-title");
      textEl.selectAll("*").remove();

      const yOffset = line2 ? -NODE_R - 18 : -NODE_R - 6;
      textEl.attr("y", yOffset);

      textEl
        .append("tspan")
        .attr("x", 0)
        .attr("dy", 0)
        .text(line1);

      if (line2) {
        textEl
          .append("tspan")
          .attr("x", 0)
          .attr("dy", "1.15em")
          .text(line2);
      }

      d3.select(this).select<SVGElement>(".node-tooltip").text(fullTitle);
    });

    node.select<SVGCircleElement>(".node-selected-ring").attr("opacity", (d) => (d.id === selectedId ? 1 : 0));
    node.select<SVGCircleElement>(".node-highlight-ring").attr("stroke", highlightColor).attr("opacity", (d) => (d.id === highlightNodeId ? 1 : 0));

    node.each(function (d) {
      const isExpanded = expandedIdsRef.current?.has(d.id) ?? false;
      const hasChildren = hasChildrenIds.has(d.id);
      const badge = d3.select(this).select<SVGGElement>(".node-children-badge");

      badge
        .attr("display", hasChildren ? null : "none")
        .attr("transform", `translate(${NODE_R - 2}, ${NODE_R - 2})`);

      badge.select<SVGTextElement>("text").text(isExpanded ? "−" : "+");
      badge
        .select<SVGCircleElement>("circle")
        .attr("fill", isExpanded ? "#1e3a8a" : "rgba(17, 24, 39, 0.95)")
        .attr("stroke", isExpanded ? "#60a5fa" : "#e5e7eb");
    });

    const updatePositions = () => {
      link
        .attr("x1", (d) => nodeByIdRef.current.get(d.source)?.x ?? 0)
        .attr("y1", (d) => nodeByIdRef.current.get(d.source)?.y ?? 0)
        .attr("x2", (d) => nodeByIdRef.current.get(d.target)?.x ?? 0)
        .attr("y2", (d) => nodeByIdRef.current.get(d.target)?.y ?? 0);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    };

    const commitAllPositions = () => {
      onGraphPositionsCommit(
        Array.from(nodeByIdRef.current.values()).map((entry) => ({
          id: entry.id,
          x: entry.x,
          y: entry.y,
        }))
      );
    };

    node.call(
      d3.drag<SVGGElement, SimNode>()
        .on("drag", (event, d) => {
          d.x = event.x;
          d.y = event.y;
          nodeByIdRef.current.set(d.id, d);
          d3.select<SVGGElement, SimNode>(event.currentTarget as SVGGElement).attr("transform", `translate(${d.x},${d.y})`);
          onNodeDragEndRef.current(d.id, d.x, d.y);
          updatePositions();
        })
        .on("end", (_event, d) => {
          onNodeDragEndRef.current(d.id, d.x, d.y);
          commitAllPositions();
          updatePositions();
        })
    );

    updatePositions();

    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 3]).on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
    svg.call(zoom);
    zoomRef.current = zoom;

    svg.on("contextmenu", (event) => {
      event.preventDefault();
      const transform = d3.zoomTransform(svgEl);
      const graphX = (event.offsetX - transform.x) / transform.k;
      const graphY = (event.offsetY - transform.y) / transform.k;
      onBackgroundContextMenuRef.current(graphX, graphY, event.clientX, event.clientY);
    });

    return () => {
      svg.on(".zoom", null);
      svg.on("contextmenu", null);
    };
  }, [items, edges, hasChildrenIds, highlightNodeId, shapes, getProgressColor, highlightColor]);

  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;

    // Build map of duplicate resource groups
    const duplicateGroupMap = new Map<string, string[]>();
    for (const item of items) {
      const key = getNormalizedResourceKey(item);
      if (key) {
        const arr = duplicateGroupMap.get(key) || [];
        arr.push(item.id);
        duplicateGroupMap.set(key, arr);
      }
    }

    const selectedItemObj = items.find((i) => i.id === selectedId);
    const activeDuplicateKey = selectedItemObj ? getNormalizedResourceKey(selectedItemObj) : null;
    const activeDuplicateIds = new Set(
      activeDuplicateKey && (duplicateGroupMap.get(activeDuplicateKey)?.length || 0) > 1
        ? duplicateGroupMap.get(activeDuplicateKey)
        : []
    );

    const itemMap = new Map(items.map((i) => [i.id, i]));

    g.selectAll<SVGGElement, SimNode>("g.node")
      .style("opacity", (d) => {
        const item = itemMap.get(d.id);
        return item?.opacity ?? d.opacity ?? 1.0;
      });

    g.selectAll<SVGLineElement, SimLink>("line")
      .attr("stroke", (d) => {
        if (d.relationship === "waiting_on") {
          const tgtId = typeof d.target === "object" ? (d.target as any).id : d.target;
          const targetItem = itemMap.get(tgtId);
          return targetItem?.is_resolved ? "#10b981" : "#f59e0b";
        }
        return "#4b5563";
      })
      .attr("stroke-dasharray", (d) => {
        if (d.relationship === "waiting_on") {
          const tgtId = typeof d.target === "object" ? (d.target as any).id : d.target;
          const targetItem = itemMap.get(tgtId);
          return targetItem?.is_resolved ? "3,3" : "5,3";
        }
        return null;
      })
      .style("opacity", (d) => {
        const srcId = typeof d.source === "object" ? (d.source as any).id : d.source;
        const tgtId = typeof d.target === "object" ? (d.target as any).id : d.target;
        const srcOp = itemMap.get(srcId)?.opacity ?? 1.0;
        const tgtOp = itemMap.get(tgtId)?.opacity ?? 1.0;
        return Math.min(srcOp, tgtOp);
      });

    g.selectAll<SVGGElement, SimNode>("g.node").select<SVGCircleElement>(".node-core")
      .attr("fill", (d) => `hsl(${Math.round((d.progress / 100) * 120)}, 70%, 45%)`);

    g.selectAll<SVGGElement, SimNode>("g.node").select<SVGCircleElement>(".node-selected-ring")
      .attr("opacity", (d) => (d.id === selectedId || selectedIds.includes(d.id) ? 1 : 0));

    g.selectAll<SVGGElement, SimNode>("g.node").select<SVGCircleElement>(".node-duplicate-ring")
      .attr("opacity", (d) => (activeDuplicateIds.has(d.id) ? 1 : 0));

    g.selectAll<SVGGElement, SimNode>("g.node").select<SVGCircleElement>(".node-highlight-ring")
      .attr("opacity", (d) => (d.id === highlightNodeId ? 1 : 0));

    g.selectAll<SVGGElement, SimNode>("g.node").each(function (d) {
      const nodeEl = d3.select(this);
      const blockerRing = nodeEl.select<SVGCircleElement>(".node-blocker-ring");

      const currentItem = itemMap.get(d.id) || d;

      const hasUnresolvedBlockers = edges.some(
        (e) =>
          e.source_item_id === d.id &&
          e.relationship === "waiting_on" &&
          items.some((target) => target.id === e.target_item_id && !target.is_resolved)
      ) || items.some(
        (child) =>
          child.parent_item_id === d.id &&
          !child.is_resolved &&
          (child.blocker_reason != null || (child.flags && child.flags.includes("stuck")))
      );

      const isBlockerNode =
        currentItem.blocker_reason != null ||
        (currentItem.flags && currentItem.flags.includes("stuck")) ||
        edges.some((e) => e.target_item_id === d.id && e.relationship === "waiting_on");

      if (hasUnresolvedBlockers) {
        blockerRing.attr("stroke", "#f59e0b").attr("opacity", 1);
      } else if (isBlockerNode) {
        blockerRing
          .attr("stroke", currentItem.is_resolved ? "#10b981" : "#ef4444")
          .attr("opacity", currentItem.is_resolved ? 0.4 : 1);
      } else {
        blockerRing.attr("opacity", 0);
      }
    });

    g.selectAll<SVGGElement, SimNode>("g.node").select<SVGGElement>(".node-children-badge")
      .attr("display", (d) => (hasChildrenIds.has(d.id) ? null : "none"));

    // Render Role Flag Rings & Badges on D3 Nodes
    g.selectAll<SVGGElement, SimNode>("g.node").each(function (d) {
      const nodeEl = d3.select(this);
      const roleRing = nodeEl.select<SVGCircleElement>(".node-role-ring");
      const flagsBadgesGroup = nodeEl.select<SVGGElement>(".node-flags-badges");

      const nodeFlags = d.flags || [];
      const primaryFlagId = nodeFlags.length > 0 ? (nodeFlags[0] as FlagType) : null;
      const primaryDef = primaryFlagId ? FLAG_DEFINITIONS[primaryFlagId] : null;

      if (primaryDef) {
        roleRing
          .attr("stroke", primaryDef.color)
          .attr("stroke-width", primaryFlagId === "prime" ? 3.5 : 2.5)
          .attr("stroke-dasharray", primaryFlagId === "stuck" ? "3,2" : null)
          .attr("opacity", 1);
      } else {
        roleRing.attr("opacity", 0);
      }

      flagsBadgesGroup.selectAll("*").remove();
      if (nodeFlags.length > 0) {
        nodeFlags.forEach((flagId, idx) => {
          const def = FLAG_DEFINITIONS[flagId as FlagType];
          if (!def) return;
          const bgGroup = flagsBadgesGroup
            .append("g")
            .attr("transform", `translate(${NODE_R + 6 + idx * 22}, ${-NODE_R + 2})`);

          bgGroup
            .append("rect")
            .attr("x", -10)
            .attr("y", -8)
            .attr("width", 20)
            .attr("height", 16)
            .attr("rx", 4)
            .attr("fill", def.bg)
            .attr("stroke", def.color)
            .attr("stroke-width", 1);

          bgGroup
            .append("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", "#ffffff")
            .attr("font-size", "9px")
            .attr("font-weight", "bold")
            .text(`${def.emoji}${idx + 1}`);
        });
      }
    });
  }, [selectedId, selectedIds, items, highlightNodeId, hasChildrenIds]);

  useEffect(() => {
    if (!focusItemId) return;
    const svgEl = svgRef.current;
    const container = containerRef.current;
    const zoom = zoomRef.current;
    const node = nodeByIdRef.current.get(focusItemId);
    if (!svgEl || !container || !zoom || !node) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const transform = d3.zoomTransform(svgEl);
    const targetScale = Math.max(0.8, transform.k);
    const tx = width / 2 - node.x * targetScale;
    const ty = height / 2 - node.y * targetScale;

    d3.select(svgEl).transition().duration(350).call(
      zoom.transform,
      d3.zoomIdentity.translate(tx, ty).scale(targetScale)
    );
  }, [focusItemId, focusNonce]);

  const fitView = () => {
    const svgEl = svgRef.current;
    const container = containerRef.current;
    const g = gRef.current;
    const zoom = zoomRef.current;
    if (!svgEl || !container || !g || !zoom) return;

    const gNode = g.node();
    if (!gNode) return;
    const bbox = gNode.getBBox();
    if (bbox.width === 0 || bbox.height === 0) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const scale = Math.min(width / bbox.width, height / bbox.height) * 0.85;
    const tx = width / 2 - bbox.x * scale - bbox.width * scale / 2;
    const ty = height / 2 - bbox.y * scale - bbox.height * scale / 2;

    d3.select(svgEl).transition().duration(500).call(
      zoom.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  };

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative">
      {/* Floating Multi-Select & Merge Toolbar */}
      {selectedIds.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-850/95 border border-purple-500/80 rounded-full px-4 py-1.5 shadow-2xl flex items-center gap-3 backdrop-blur-md z-[50] text-xs text-purple-100 font-medium">
          <span>✨ {selectedIds.length} Nodes Selected</span>
          <button
            onClick={() => {
              const selectedObjs = items.filter((i) => selectedIds.includes(i.id));
              if (onOpenMergeModal) onOpenMergeModal(selectedObjs);
            }}
            className="bg-purple-700 hover:bg-purple-600 text-white font-bold px-3.5 py-1 rounded-full transition-colors flex items-center gap-1 shadow"
          >
            🔀 Merge Selected
          </button>
          <button
            onClick={onClearMultiSelect}
            className="text-gray-400 hover:text-gray-200 text-xs px-1"
            title="Clear selection"
          >
            ✕
          </button>
        </div>
      )}

      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: "#111827", display: "block" }}
        onContextMenu={(e) => e.preventDefault()}
      />

      <div className="absolute bottom-3 left-3 flex gap-1 z-10">
        <button
          onClick={fitView}
          className="bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs px-2.5 py-1 rounded border border-gray-600"
        >
          Fit view
        </button>
      </div>

      {/* Graph Legend Overlay */}
      <div className="absolute bottom-3 right-3 z-20">
        {!showLegend ? (
          <button
            onClick={() => setShowLegend(true)}
            className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 shadow-xl flex items-center gap-1.5 backdrop-blur-md font-medium"
          >
            🗺️ Graph Legend
          </button>
        ) : (
          <div className="bg-slate-950/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md w-72 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-bold text-slate-200">
              <span className="flex items-center gap-1.5">🗺️ Node Role Flags</span>
              <button
                onClick={() => setShowLegend(false)}
                className="text-slate-400 hover:text-white font-bold px-1"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {(Object.keys(FLAG_DEFINITIONS) as FlagType[]).map((key, idx) => {
                const def = FLAG_DEFINITIONS[key];
                return (
                  <div key={key} className="flex items-start gap-2 p-1.5 rounded bg-slate-900/60 border border-slate-800/80">
                    <span
                      className="px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 border"
                      style={{ backgroundColor: def.bg, borderColor: def.color, color: "#fff" }}
                    >
                      {def.emoji}{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 text-[11px]">{def.label}</div>
                      <div className="text-[10px] text-slate-400 leading-tight">{def.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

