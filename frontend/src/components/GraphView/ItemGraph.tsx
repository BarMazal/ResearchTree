import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ItemData, ItemEdgeData } from "../../store/useGraphStore";

type Props = {
  items: ItemData[];
  edges: ItemEdgeData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNodeContextMenu: (id: string, x: number, y: number) => void;
  onBackgroundContextMenu: (graphX: number, graphY: number, screenX: number, screenY: number) => void;
  onNodeDragEnd: (id: string, graphX: number, graphY: number) => void;
};

interface SimNode extends ItemData {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface SimLink {
  source: string;
  target: string;
}

const NODE_R = 16;

export function ItemGraph({
  items, edges, selectedId,
  onSelect, onNodeContextMenu, onBackgroundContextMenu, onNodeDragEnd,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, undefined> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

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
    if (!container || !svgEl || items.length === 0) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const g = svg.append("g");
    gRef.current = g;

    const nodes: SimNode[] = items.map((r) => ({
      ...r,
      x: r.graph_x ?? (width / 2 + (Math.random() - 0.5) * 80),
      y: r.graph_y ?? (height / 2 + (Math.random() - 0.5) * 80),
      vx: 0,
      vy: 0,
    }));
    const links: SimLink[] = edges.map((e) => ({
      source: e.source_item_id,
      target: e.target_item_id,
    }));

    const allPlaced = nodes.length > 0 && nodes.every((n) => n.graph_x != null && n.graph_y != null);

    const simulation = d3
      .forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.1))
      .force("collision", d3.forceCollide(NODE_R + 20))
      .alphaDecay(0.3)
      .alphaMin(0.001);

    if (links.length > 0) {
      simulation.force("link", d3.forceLink(links).id((d) => (d as SimNode).id).distance(100));
    }

    if (allPlaced) simulation.stop();

    const link = g
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#4b5563")
      .attr("stroke-width", 1.5);

    const node = g
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer");

    node
      .append("circle")
      .attr("r", NODE_R)
      .attr("fill", (d) => {
        const hue = Math.round((d.progress / 100) * 120);
        return `hsl(${hue}, 70%, 45%)`;
      })
      .attr("stroke", "#374151")
      .attr("stroke-width", 2);

    node
      .append("text")
      .text((d) => d.title)
      .attr("text-anchor", "middle")
      .attr("y", -NODE_R - 6)
      .attr("fill", "#d1d5db")
      .attr("font-size", "11px")
      .style("pointer-events", "none");

    node.on("click", (_event, d) => onSelectRef.current(d.id));

    node.on("contextmenu", (event, d) => {
      event.preventDefault();
      event.stopPropagation();
      onNodeContextMenuRef.current(d.id, event.clientX, event.clientY);
    });

    node.call(
      d3.drag<SVGGElement, SimNode>()
        .on("start", (event, d) => {
          d3.select((event.sourceEvent as MouseEvent).target as SVGGElement).raise();
          simulation.alphaTarget(0.03).restart();
        })
        .on("drag", (event, d) => {
          d.x = event.x;
          d.y = event.y;
          (d as any).__dragged = true;
        })
        .on("end", (event, d) => {
          simulation.alphaTarget(0);
          if ((d as any).__dragged) {
            (d as any).__dragged = false;
            onNodeDragEndRef.current(d.id, d.x, d.y);
          }
        })
    );

    const applyPositions = () => {
      link
        .attr("x1", (d) => ((d.source as unknown as SimNode).x))
        .attr("y1", (d) => ((d.source as unknown as SimNode).y))
        .attr("x2", (d) => ((d.target as unknown as SimNode).x))
        .attr("y2", (d) => ((d.target as unknown as SimNode).y));

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    };

    applyPositions();

    simulation.on("tick", applyPositions);

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

    simRef.current = simulation;

    return () => {
      simulation.stop();
      svg.on(".zoom", null);
      svg.on("contextmenu", null);
    };
  }, [items, edges]);

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;
    g.selectAll<SVGGElement, SimNode>("g").select("circle")
      .attr("fill", (d) => {
        if (d.id === selectedId) return "#3b82f6";
        const hue = Math.round((d.progress / 100) * 120);
        return `hsl(${hue}, 70%, 45%)`;
      })
      .attr("stroke", (d) => (d.id === selectedId ? "#93c5fd" : "#374151"));
  }, [selectedId]);

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
