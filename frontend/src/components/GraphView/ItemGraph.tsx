import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ItemData, ItemEdgeData } from "../../store/useGraphStore";

type Props = {
  items: ItemData[];
  edges: ItemEdgeData[];
  selectedId: string | null;
  hasChildrenIds: Set<string>;
  focusItemId?: string | null;
  focusNonce?: number;
  highlightNodeId?: string | null;
  onSelect: (id: string) => void;
  onNodeContextMenu: (id: string, x: number, y: number) => void;
  onBackgroundContextMenu: (graphX: number, graphY: number, screenX: number, screenY: number) => void;
  onNodeDragEnd: (id: string, graphX: number, graphY: number) => void;
  onGraphPositionsCommit: (positions: Array<{ id: string; x: number; y: number }>) => void;
};

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
  items, edges, selectedId, hasChildrenIds, focusItemId, focusNonce, highlightNodeId,
  onSelect, onNodeContextMenu, onBackgroundContextMenu, onNodeDragEnd, onGraphPositionsCommit,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodeByIdRef = useRef<Map<string, SimNode>>(new Map());

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onNodeContextMenuRef = useRef(onNodeContextMenu);
  onNodeContextMenuRef.current = onNodeContextMenu;
  const onBackgroundContextMenuRef = useRef(onBackgroundContextMenu);
  onBackgroundContextMenuRef.current = onBackgroundContextMenu;
  const onNodeDragEndRef = useRef(onNodeDragEnd);
  onNodeDragEndRef.current = onNodeDragEnd;

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

    const link = g
      .selectAll<SVGLineElement, SimLink>("line")
      .data(links, (d) => `${d.source}->${d.target}->${d.relationship ?? ""}`)
      .join("line")
      .attr("stroke", "#4b5563")
      .attr("stroke-width", 1.5)
      .attr("marker-end", (d) => (d.relationship === "parent_child" ? "url(#arrow-parent-child)" : null));

    const node = g
      .selectAll<SVGGElement, SimNode>("g.node")
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const group = enter.append("g").attr("class", "node").style("cursor", "pointer");

        group
          .append("circle")
          .attr("class", "node-core")
          .attr("r", NODE_R)
          .attr("stroke", "#374151")
          .attr("stroke-width", 2);

        group
          .append("circle")
          .attr("class", "node-selected-ring")
          .attr("r", NODE_R + 4)
          .attr("fill", "none")
          .attr("stroke", "#60a5fa")
          .attr("stroke-width", 2.5)
          .attr("opacity", 0)
          .style("pointer-events", "none");

        group
          .append("circle")
          .attr("class", "node-highlight-ring")
          .attr("r", NODE_R + 8)
          .attr("fill", "none")
          .attr("stroke", "#eab308")
          .attr("stroke-width", 2.5)
          .attr("opacity", 0)
          .style("pointer-events", "none");

        group
          .append("circle")
          .attr("class", "node-hit")
          .attr("r", NODE_R)
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

        const plus = group.append("g").attr("class", "node-children-badge").style("pointer-events", "none");
        plus.append("circle").attr("r", 7).attr("fill", "rgba(17, 24, 39, 0.9)").attr("stroke", "#e5e7eb").attr("stroke-width", 1.25);
        plus.append("text").attr("text-anchor", "middle").attr("dominant-baseline", "middle").attr("fill", "#f9fafb").attr("font-size", "12px").attr("font-weight", 700).text("+");

        group.on("click", (_event, d) => onSelectRef.current(d.id));
        group.on("contextmenu", (event, d) => {
          event.preventDefault();
          event.stopPropagation();
          onNodeContextMenuRef.current(d.id, event.clientX, event.clientY);
        });

        return group;
      });

    node.select<SVGCircleElement>(".node-core")
      .attr("fill", (d) => `hsl(${Math.round((d.progress / 100) * 120)}, 70%, 45%)`);

    node.select<SVGTextElement>(".node-title").text((d) => d.title);
    node.select<SVGCircleElement>(".node-selected-ring").attr("opacity", (d) => (d.id === selectedId ? 1 : 0));
    node.select<SVGCircleElement>(".node-highlight-ring").attr("opacity", (d) => (d.id === highlightNodeId ? 1 : 0));
    node.select<SVGGElement>(".node-children-badge").attr("display", (d) => (hasChildrenIds.has(d.id) ? null : "none")).attr("transform", `translate(${NODE_R - 4}, ${NODE_R - 4})`);

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
  }, [items, edges, hasChildrenIds, highlightNodeId]);

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;
    g.selectAll<SVGGElement, SimNode>("g.node").select<SVGCircleElement>(".node-core")
      .attr("fill", (d) => `hsl(${Math.round((d.progress / 100) * 120)}, 70%, 45%)`);

    g.selectAll<SVGGElement, SimNode>("g.node").select<SVGCircleElement>(".node-selected-ring")
      .attr("opacity", (d) => (d.id === selectedId ? 1 : 0));

    g.selectAll<SVGGElement, SimNode>("g.node").select<SVGCircleElement>(".node-highlight-ring")
      .attr("opacity", (d) => (d.id === highlightNodeId ? 1 : 0));

    g.selectAll<SVGGElement, SimNode>("g.node").select<SVGGElement>(".node-children-badge")
      .attr("display", (d) => (hasChildrenIds.has(d.id) ? null : "none"));
  }, [selectedId, highlightNodeId, hasChildrenIds]);

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
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: "#111827", display: "block" }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="absolute bottom-3 left-3 flex gap-1">
        <button
          onClick={fitView}
          className="bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs px-2.5 py-1 rounded border border-gray-600"
        >
          Fit view
        </button>
      </div>
    </div>
  );
}
