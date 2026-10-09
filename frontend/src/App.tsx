import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api } from "./api/client";
import {
  useGraphStore,
  type ItemData,
  type ItemEdgeData,
} from "./store/useGraphStore";
import { SearchBar } from "./components/Sidebar/SearchBar";
import { truncateTitle } from "./utils/text";
import { ItemGraph, getNormalizedResourceKey } from "./components/GraphView/ItemGraph";
import { GraphSplitter } from "./components/GraphView/GraphSplitter";
import { ReadPane } from "./components/NodePanel/ReadPane";
import { ResourceDetail } from "./components/NodePanel/ResourceDetail";
import { FLAG_DEFINITIONS, type FlagType } from "./components/NodePanel/FlagEditor";
import { BookmarkList } from "./components/NodePanel/BookmarkList";
import { TitleDialog } from "./components/NodePanel/TitleDialog";
import { AddItemDialog } from "./components/NodePanel/AddItemDialog";
import { ScratchPad } from "./components/NodePanel/ScratchPad";
import { LatexView } from "./components/NodePanel/LatexView";
import { NotebookView } from "./components/NodePanel/NotebookView";
import { RichNoteView } from "./components/NodePanel/RichNoteView";
import { MergeModal } from "./components/MergeModal/MergeModal";
import { PDFContainer } from "./components/PDFViewer/PDFContainer";
import { APDF } from "./components/PDFViewer/APDF";
import { ContextMenu, type MenuAction } from "./components/PDFViewer/ContextMenu";
import { SpawnDialog } from "./components/PDFViewer/SpawnDialog";
import { PopoutWindow } from "./components/PopoutWindow";
import { DraggableFloatingPane } from "./components/DraggableFloatingPane";
import { SettingsDialog } from "./components/SettingsDialog";
import { CollectionSelector } from "./components/Collection/CollectionSelector";
import { AnalyticsDashboard } from "./components/Analytics/AnalyticsDashboard";

type NodeContextMenu = {
  itemId: string;
  x: number;
  y: number;
};

function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const graphAreaRef = useRef<HTMLDivElement>(null);

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeModalItems, setMergeModalItems] = useState<ItemData[]>([]);
  const [mergePrimaryId, setMergePrimaryId] = useState<string | undefined>(undefined);

  const {
    items,
    itemEdges,
    selectedItemId,
    selectedItemIds,
    setItems,
    setItemEdges,
    selectItem,
    toggleSelectItem,
    setSelectedItemIds,
    clearMultiSelect,
    updateItem,
    addItem,
  } = useGraphStore();






  const [status, setStatus] = useState("connecting...");

  const [showSidebar, setShowSidebar] = useState(true);
  const [showGraph, setShowGraph] = useState(true);
  const [showReader, setShowReader] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [graphWidth, setGraphWidth] = useState(380);

  type FloatMode = "docked" | "floating" | "popout";
  const [floatSidebar, setFloatSidebar] = useState<FloatMode>("docked");
  const [floatGraph, setFloatGraph] = useState<FloatMode>("docked");
  const [floatReader, setFloatReader] = useState<FloatMode>("docked");
  const [floatDetails, setFloatDetails] = useState<FloatMode>("docked");

  const [savedLayout, setSavedLayout] = useState<{
    showSidebar: boolean;
    showGraph: boolean;
    showReader: boolean;
    showDetails: boolean;
    floatSidebar: FloatMode;
    floatGraph: FloatMode;
    floatReader: FloatMode;
    floatDetails: FloatMode;
  } | null>(null);

  const showOnlyPane = useCallback(
    (pane: "sidebar" | "graph" | "reader" | "details") => {
      setSavedLayout((prev) => {
        if (prev === null) {
          return {
            showSidebar,
            showGraph,
            showReader,
            showDetails,
            floatSidebar,
            floatGraph,
            floatReader,
            floatDetails,
          };
        }
        return prev;
      });
      setShowSidebar(pane === "sidebar");
      setShowGraph(pane === "graph");
      setShowReader(pane === "reader");
      setShowDetails(pane === "details");
      setFloatSidebar("docked");
      setFloatGraph("docked");
      setFloatReader("docked");
      setFloatDetails("docked");
    },
    [
      showSidebar,
      showGraph,
      showReader,
      showDetails,
      floatSidebar,
      floatGraph,
      floatReader,
      floatDetails,
    ]
  );

  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  const restoreLayout = useCallback(() => {
    if (savedLayout !== null) {
      setShowSidebar(savedLayout.showSidebar);
      setShowGraph(savedLayout.showGraph);
      setShowReader(savedLayout.showReader);
      setShowDetails(savedLayout.showDetails);
      setFloatSidebar(savedLayout.floatSidebar);
      setFloatGraph(savedLayout.floatGraph);
      setFloatReader(savedLayout.floatReader);
      setFloatDetails(savedLayout.floatDetails);
      setSavedLayout(null);
    }
  }, [savedLayout]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<"view" | "add" | null>(null);

  const [viewerMode, setViewerMode] = useState<"native" | "pdfjs" | "apdfjs">("apdfjs");

  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfHighlightText, setPdfHighlightText] = useState<string | null>(null);
  const [bookmarkRefreshNonce, setBookmarkRefreshNonce] = useState(0);

  const [detailExpanded, setDetailExpanded] = useState(true);
  const [detailDock, setDetailDock] = useState<"bottom" | "right">(() => {
    const saved = localStorage.getItem("detail-dock");
    return (saved === "right" || saved === "bottom") ? saved : "bottom";
  });
  const [detailHeight, setDetailHeight] = useState(() => {
    const saved = localStorage.getItem("detail-height");
    return saved ? parseInt(saved, 10) : 256;
  });
  const [detailWidth, setDetailWidth] = useState(() => {
    const saved = localStorage.getItem("detail-width");
    return saved ? parseInt(saved, 10) : 380;
  });

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addInitialType, setAddInitialType] = useState("pdf");
  const [addInitialTitle, setAddInitialTitle] = useState("");
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [addSpawnSource, setAddSpawnSource] = useState<{
    itemId: string;
    page: number;
    quote: string;
  } | null>(null);
  const [titleDialog, setTitleDialog] = useState(false);

  const [addDialogPosition, setAddDialogPosition] = useState<{ graphX: number; graphY: number } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    text: string;
    page: number;
  } | null>(null);

  const [nodeMenu, setNodeMenu] = useState<NodeContextMenu | null>(null);
  const [nodeSubmenu, setNodeSubmenu] = useState<"spawn" | "flags" | "opacity" | null>(null);
  const nodeMenuRef = useRef<HTMLDivElement>(null);
  const nodeSubmenuCloseTimerRef = useRef<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("expandedIds");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [hasInitializedExpanded, setHasInitializedExpanded] = useState(false);
  const [pendingOrganizeRootId, setPendingOrganizeRootId] = useState<string | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<{ itemId: string; descendantCount: number } | null>(null);
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ itemId: string | null; nonce: number }>({
    itemId: null,
    nonce: 0,
  });

  const [spawnAction, setSpawnAction] = useState<MenuAction | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [it, ed] = await Promise.all([
        api.get<ItemData[]>("/items"),
        api.get<ItemEdgeData[]>("/item-edges"),
      ]);
      setItems(it);
      setItemEdges(ed);
      setStatus("ok");
    } catch {
      setStatus("offline");
    }
  }, [setItems, setItemEdges]);

  useEffect(() => {
    api.get<{ status: string }>("/health")
      .then((d) => setStatus(d.status))
      .catch(() => setStatus("offline"));
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (status === "ok" && items.length > 0) return;
    const retryId = window.setInterval(() => {
      loadData();
    }, 1500);
    return () => window.clearInterval(retryId);
  }, [status, items.length, loadData]);

  useEffect(() => {
    try {
      localStorage.setItem("expandedIds", JSON.stringify(Array.from(expandedIds)));
    } catch (e) {
      console.error("Failed to save expandedIds state:", e);
    }
  }, [expandedIds]);

  useEffect(() => {
    localStorage.setItem("detail-dock", detailDock);
  }, [detailDock]);

  useEffect(() => {
    localStorage.setItem("detail-height", String(detailHeight));
  }, [detailHeight]);

  useEffect(() => {
    localStorage.setItem("detail-width", String(detailWidth));
  }, [detailWidth]);

  const selectedItem = items.find((r) => r.id === selectedItemId) ?? null;
  const hasReader = selectedItem && (selectedItem.file_path || selectedItem.source_url);
  const prevSelectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedItemId && selectedItemId !== prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedItemId;
      if (selectedItem && (selectedItem.file_path || selectedItem.source_url)) {
        setShowReader(true);
      }
    } else if (!selectedItemId) {
      prevSelectedIdRef.current = null;
    }
  }, [selectedItemId, selectedItem]);

  const isPdfTarget = (item: ItemData | null) => {
    if (!item) return false;
    if (item.file_path) return true;
    if (item.type === "pdf") return true;
    const url = item.source_url?.toLowerCase();
    if (!url) return false;
    return url.endsWith(".pdf") || url.includes("arxiv.org/pdf/") || url.includes("arxiv.org/abs/");
  };

  const hasPdf = isPdfTarget(selectedItem);
  const pdfUrl = hasPdf && selectedItem ? `/api/items/${selectedItem.id}/file` : null;
  const usePdfjs = hasPdf && viewerMode === "pdfjs";
  const useAPdfjs = hasPdf && viewerMode === "apdfjs";
  const isScratchPad = selectedItem?.type === "scratch-pad";
  const isLatex = selectedItem?.type === "latex";
  const isNotebook = selectedItem?.type === "notebook";
  const isRichNote = selectedItem != null && !hasPdf && !isScratchPad && !isLatex && !isNotebook;

  const idSet = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const graphEdges = useMemo(() => {
    const existing = new Set(itemEdges.map((e) => `${e.source_item_id}->${e.target_item_id}`));
    const synthetic: ItemEdgeData[] = [];

    for (const item of items) {
      if (!item.parent_item_id || !idSet.has(item.parent_item_id)) continue;
      const key = `${item.parent_item_id}->${item.id}`;
      if (existing.has(key)) continue;
      synthetic.push({
        id: `parent-${item.parent_item_id}-${item.id}`,
        source_item_id: item.parent_item_id,
        target_item_id: item.id,
        relationship: "parent_child",
        label: null,
      });
    }

    return [...itemEdges, ...synthetic];
  }, [itemEdges, items, idSet]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, ItemData[]>();
    const parentsOfItem = new Map<string, Set<string>>();

    const addParentRelation = (childId: string, parentId: string) => {
      if (childId === parentId) return;
      let pSet = parentsOfItem.get(childId);
      if (!pSet) {
        pSet = new Set<string>();
        parentsOfItem.set(childId, pSet);
      }
      pSet.add(parentId);
    };

    // 1. Direct parent_item_id
    for (const item of items) {
      if (item.parent_item_id && idSet.has(item.parent_item_id)) {
        addParentRelation(item.id, item.parent_item_id);
      }
    }

    // 2. Edge relationships (parent_child, spawned_from, child)
    for (const edge of itemEdges) {
      const rel = edge.relationship?.toLowerCase();
      if (
        (rel === "parent_child" || rel === "spawned_from" || rel === "child") &&
        idSet.has(edge.source_item_id) &&
        idSet.has(edge.target_item_id) &&
        edge.source_item_id !== edge.target_item_id
      ) {
        addParentRelation(edge.target_item_id, edge.source_item_id);
      }
    }

    // 3. Populate children map for each parent
    for (const item of items) {
      const parents = parentsOfItem.get(item.id);
      if (!parents || parents.size === 0) {
        const arr = map.get(null) ?? [];
        arr.push(item);
        map.set(null, arr);
      } else {
        for (const parentId of parents) {
          const arr = map.get(parentId) ?? [];
          arr.push(item);
          map.set(parentId, arr);
        }
      }
    }

    for (const arr of map.values()) {
      arr.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
    }
    return map;
  }, [items, itemEdges, idSet]);


  useEffect(() => {
    if (items.length === 0) return;
    if (!hasInitializedExpanded) {
      const saved = localStorage.getItem("expandedIds");
      if (!saved) {
        const allParents = new Set<string>();
        for (const [parentId, children] of childrenByParent.entries()) {
          if (parentId && children.length > 0) allParents.add(parentId);
        }
        setExpandedIds(allParents);
      }
      setHasInitializedExpanded(true);
    }
  }, [items.length, childrenByParent, hasInitializedExpanded]);

  useEffect(() => {
    if (items.length === 0) return;
    setExpandedIds((prev) => {
      const next = new Set<string>();
      let changed = false;
      for (const id of prev) {
        if (idSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [idSet, items.length]);

  const hasChildrenIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [parentId, children] of childrenByParent.entries()) {
      if (parentId && children.length > 0) ids.add(parentId);
    }
    return ids;
  }, [childrenByParent]);

  const getDescendantIds = useCallback((rootId: string) => {
    const ids: string[] = [];
    const stack = [...(childrenByParent.get(rootId) ?? [])];
    while (stack.length > 0) {
      const next = stack.pop()!;
      ids.push(next.id);
      const children = childrenByParent.get(next.id) ?? [];
      for (const child of children) stack.push(child);
    }
    return ids;
  }, [childrenByParent]);

  const visibleItemIds = useMemo(() => {
    const visible = new Set<string>();
    const stack = [...(childrenByParent.get(null) ?? [])];

    while (stack.length > 0) {
      const next = stack.pop()!;
      visible.add(next.id);
      if (!expandedIds.has(next.id)) continue;
      const children = childrenByParent.get(next.id) ?? [];
      for (const child of children) stack.push(child);
    }

    return visible;
  }, [childrenByParent, expandedIds]);

  const visibleItems = useMemo(
    () => items.filter((item) => visibleItemIds.has(item.id)),
    [items, visibleItemIds]
  );

  const visibleGraphEdges = useMemo(
    () => graphEdges.filter((edge) => visibleItemIds.has(edge.source_item_id) && visibleItemIds.has(edge.target_item_id)),
    [graphEdges, visibleItemIds]
  );

  const findItemPosition = useCallback((itemId: string) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return null;
    return {
      x: item.graph_x ?? null,
      y: item.graph_y ?? null,
    };
  }, [items]);

  const organizeVisibleGraph = useCallback(async (rootItemId?: string | null) => {
    const nodeWidth = 180;
    const layerGap = 120;
    const siblingGap = 60;

    if (rootItemId && visibleItemIds.has(rootItemId)) {
      const rootItem = items.find((item) => item.id === rootItemId) ?? null;
      if (!rootItem) return;

      const anchor = findItemPosition(rootItem.id) ?? { x: rootItem.graph_x ?? 0, y: rootItem.graph_y ?? 0 };
      const subtreeChildren = new Map<string, string[]>();

      const collectChildren = (itemId: string) => {
        const childIds = (childrenByParent.get(itemId) ?? [])
          .filter((child) => visibleItemIds.has(child.id))
          .map((child) => child.id);
        subtreeChildren.set(itemId, childIds);
        for (const childId of childIds) {
          collectChildren(childId);
        }
      };

      collectChildren(rootItem.id);

      const widths = new Map<string, number>();
      const measure = (itemId: string): number => {
        const childIds = subtreeChildren.get(itemId) ?? [];
        if (childIds.length === 0) {
          widths.set(itemId, nodeWidth);
          return nodeWidth;
        }

        const totalWidth = childIds.reduce((total, childId) => total + measure(childId), 0) + siblingGap * (childIds.length - 1);
        const width = Math.max(nodeWidth, totalWidth);
        widths.set(itemId, width);
        return width;
      };

      measure(rootItem.id);

      const placements: Array<{ id: string; x: number; y: number }> = [];
      const directChildren = subtreeChildren.get(rootItem.id) ?? [];
      const anchorX = anchor.x ?? 0;
      const anchorY = anchor.y ?? 0;
      let left = anchorX - ((directChildren.reduce((total, childId) => total + (widths.get(childId) ?? nodeWidth), 0) + siblingGap * Math.max(0, directChildren.length - 1)) / 2);

      const placeSubtree = (itemId: string, xLeft: number, depth: number) => {
        const childIds = subtreeChildren.get(itemId) ?? [];
        const width = widths.get(itemId) ?? nodeWidth;
        placements.push({ id: itemId, x: xLeft + width / 2, y: anchorY + depth * layerGap });

        let childLeft = xLeft;
        for (const childId of childIds) {
          const childWidth = widths.get(childId) ?? nodeWidth;
          placeSubtree(childId, childLeft, depth + 1);
          childLeft += childWidth + siblingGap;
        }
      };

      for (const childId of directChildren) {
        const childWidth = widths.get(childId) ?? nodeWidth;
        placeSubtree(childId, left, 1);
        left += childWidth + siblingGap;
      }

      await Promise.all(placements.map((placement) => api.put(`/items/${placement.id}`, {
        graph_x: placement.x,
        graph_y: placement.y,
      })));
      await loadData();
      return;
    }

    const visibleChildrenByParent = new Map<string | null, string[]>();
    for (const item of visibleItems) {
      const parentId = item.parent_item_id && visibleItemIds.has(item.parent_item_id) ? item.parent_item_id : null;
      const arr = visibleChildrenByParent.get(parentId) ?? [];
      arr.push(item.id);
      visibleChildrenByParent.set(parentId, arr);
    }

    const subtreeWidth = new Map<string, number>();
    const measure = (itemId: string): number => {
      const childIds = visibleChildrenByParent.get(itemId) ?? [];
      if (childIds.length === 0) {
        subtreeWidth.set(itemId, nodeWidth);
        return nodeWidth;
      }
      const width = childIds.reduce((total, childId) => total + measure(childId), 0) + siblingGap * (childIds.length - 1);
      subtreeWidth.set(itemId, Math.max(nodeWidth, width));
      return subtreeWidth.get(itemId)!;
    };

    const roots = rootItemId && visibleItemIds.has(rootItemId)
      ? [rootItemId]
      : (visibleChildrenByParent.get(null) ?? []);

    if (roots.length === 0) return;

    for (const rootId of roots) {
      measure(rootId);
    }

    const placements: Array<{ id: string; x: number; y: number }> = [];
    let currentX = 0;

    const placeNode = (itemId: string, left: number, depth: number) => {
      const childIds = visibleChildrenByParent.get(itemId) ?? [];
      const width = subtreeWidth.get(itemId) ?? nodeWidth;
      const centerX = left + width / 2;
      const y = depth * layerGap + 80;
      placements.push({ id: itemId, x: centerX, y });

      if (childIds.length === 0) return;

      let childLeft = left;
      for (const childId of childIds) {
        const childWidth = subtreeWidth.get(childId) ?? nodeWidth;
        placeNode(childId, childLeft, depth + 1);
        childLeft += childWidth + siblingGap;
      }
    };

    for (const rootId of roots) {
      const width = subtreeWidth.get(rootId) ?? nodeWidth;
      placeNode(rootId, currentX, 0);
      currentX += width + 140;
    }

    const updates = placements.map((placement) => api.put(`/items/${placement.id}`, {
      graph_x: placement.x,
      graph_y: placement.y,
    }));
    await Promise.all(updates);
    await loadData();
  }, [loadData, visibleItemIds, visibleItems]);

  const clearNodeSubmenuCloseTimer = useCallback(() => {
    if (nodeSubmenuCloseTimerRef.current == null) return;
    window.clearTimeout(nodeSubmenuCloseTimerRef.current);
    nodeSubmenuCloseTimerRef.current = null;
  }, []);

  const handleOrganizeRequest = useCallback(async (itemId: string) => {
    setNodeMenu(null);
    setNodeSubmenu(null);
    clearNodeSubmenuCloseTimer();
    await organizeVisibleGraph(itemId);
  }, [clearNodeSubmenuCloseTimer, organizeVisibleGraph]);

  const scheduleNodeSubmenuClose = useCallback(() => {
    clearNodeSubmenuCloseTimer();
    nodeSubmenuCloseTimerRef.current = window.setTimeout(() => {
      setNodeSubmenu(null);
      nodeSubmenuCloseTimerRef.current = null;
    }, 140);
  }, [clearNodeSubmenuCloseTimer]);

  useEffect(() => {
    return () => clearNodeSubmenuCloseTimer();
  }, [clearNodeSubmenuCloseTimer]);

  useEffect(() => {
    if (!pendingOrganizeRootId) return;
    if (!visibleItemIds.has(pendingOrganizeRootId)) return;
    void organizeVisibleGraph(pendingOrganizeRootId).finally(() => {
      setPendingOrganizeRootId(null);
    });
  }, [pendingOrganizeRootId, visibleItemIds, organizeVisibleGraph]);

  const parentsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [parentId, children] of childrenByParent.entries()) {
      if (parentId) {
        for (const child of children) {
          let set = map.get(child.id);
          if (!set) {
            set = new Set<string>();
            map.set(child.id, set);
          }
          set.add(parentId);
        }
      }
    }
    return map;
  }, [childrenByParent]);

  const expandAncestors = useCallback((itemId: string, set: Set<string>) => {
    const queue = [itemId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const pIds = parentsMap.get(currentId);
      if (pIds) {
        for (const pId of pIds) {
          set.add(pId);
          queue.push(pId);
        }
      }
    }
  }, [parentsMap]);


  const expandItem = useCallback((itemId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      expandAncestors(itemId, next);
      return next;
    });
  }, [expandAncestors]);

  const collapseItem = useCallback((itemId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  const toggleItemExpansion = useCallback((itemId: string, e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
        expandAncestors(itemId, next);
      }
      return next;
    });
  }, [expandAncestors]);

  const expandAllFromItem = useCallback((itemId: string) => {
    const descendants = getDescendantIds(itemId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      expandAncestors(itemId, next);
      for (const descendantId of descendants) {
        next.add(descendantId);
      }
      return next;
    });
  }, [expandAncestors, getDescendantIds]);

  const revealItemInTree = useCallback((itemId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      expandAncestors(itemId, next);
      return next;
    });
  }, [expandAncestors]);

  const revealMultipleItems = useCallback((itemIds: string[]) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const id of itemIds) {
        expandAncestors(id, next);
      }
      return next;
    });
  }, [expandAncestors]);

  const handleOpenMergeModal = useCallback((itemsToMerge: ItemData[], primaryId?: string) => {
    revealMultipleItems(itemsToMerge.map((i) => i.id));
    setMergeModalItems(itemsToMerge);
    setMergePrimaryId(primaryId);
    setIsMergeModalOpen(true);
  }, [revealMultipleItems]);


  const selectAndReveal = useCallback((itemId: string | null) => {
    if (itemId) {
      revealItemInTree(itemId);
      const targetObj = items.find((i) => i.id === itemId);
      if (targetObj) {
        const key = getNormalizedResourceKey(targetObj);
        if (key) {
          const duplicates = items.filter((i) => getNormalizedResourceKey(i) === key);
          if (duplicates.length > 1) {
            revealMultipleItems(duplicates.map((d) => d.id));
          }
        }
      }
    }
    selectItem(itemId);
  }, [revealItemInTree, revealMultipleItems, selectItem, items]);




  const confirmDeleteItem = useCallback(async (itemId: string, mode: "single" | "subtree") => {
    const deletedIds = new Set<string>([itemId]);
    if (mode === "subtree") {
      for (const descendantId of getDescendantIds(itemId)) deletedIds.add(descendantId);
    }

    await api.delete(`/items/${itemId}?mode=${mode}`);
    if (selectedItemId && deletedIds.has(selectedItemId)) {
      selectItem(null);
    }
    setDeletePrompt(null);
    setNodeMenu(null);
    setNodeSubmenu(null);
    clearNodeSubmenuCloseTimer();
    await loadData();
  }, [clearNodeSubmenuCloseTimer, getDescendantIds, loadData, selectItem, selectedItemId]);

  const requestDeleteItem = useCallback(async (itemId: string) => {
    const descendants = getDescendantIds(itemId);
    setNodeMenu(null);
    setNodeSubmenu(null);
    clearNodeSubmenuCloseTimer();
    setDeletePrompt({ itemId, descendantCount: descendants.length });
  }, [clearNodeSubmenuCloseTimer, getDescendantIds]);

  const openAddDialog = useCallback((opts?: { parentId?: string | null; initialType?: string; initialTitle?: string }) => {
    setAddParentId(opts?.parentId ?? null);
    setAddInitialType(opts?.initialType ?? "pdf");
    setAddInitialTitle(opts?.initialTitle ?? "");
    setShowAddDialog(true);
    setMenuOpen(false);
    setActiveMenu(null);
  }, []);

  const closeAddDialog = useCallback(() => {
    setShowAddDialog(false);
    setAddDialogPosition(null);
    setAddParentId(null);
    setAddInitialType("pdf");
    setAddInitialTitle("");
    setAddSpawnSource(null);
  }, []);

  const handleTextSelect = useCallback((text: string, page: number, x: number, y: number) => {
    setContextMenu({ x, y, text, page });
  }, []);

  const handleContextAction = useCallback((action: MenuAction) => {
    if (action.type === "spawn_branch") {
      if (selectedItemId) {
        setAddSpawnSource({
          itemId: selectedItemId,
          page: contextMenu?.page ?? 1,
          quote: contextMenu?.text ?? "",
        });
      }
      openAddDialog({
        parentId: selectedItemId,
        initialType: "note",
        initialTitle: contextMenu?.text ?? "",
      });
      setContextMenu(null);
    } else {
      setSpawnAction(action);
    }
  }, [openAddDialog, selectedItemId, contextMenu]);

  const handleAPdfSelectionAction = useCallback((action: MenuAction, selectedText: string, page: number) => {
    if (action.type === "spawn_branch") {
      if (selectedItemId) {
        setAddSpawnSource({
          itemId: selectedItemId,
          page: page,
          quote: selectedText,
        });
      }
      openAddDialog({
        parentId: selectedItemId,
        initialType: "note",
        initialTitle: selectedText,
      });
    } else {
      setContextMenu({ x: 120, y: 120, text: selectedText, page });
      setSpawnAction(action);
    }
  }, [openAddDialog, selectedItemId]);

  const handleNodeContextMenu = useCallback((itemId: string, x: number, y: number) => {
    if (nodeSubmenuCloseTimerRef.current != null) {
      window.clearTimeout(nodeSubmenuCloseTimerRef.current);
      nodeSubmenuCloseTimerRef.current = null;
    }
    setNodeMenu({ itemId, x, y });
    setNodeSubmenu(null);
  }, []);

  const openSpawnWaitingOn = useCallback((itemId: string) => {
    setNodeMenu(null);
    setNodeSubmenu(null);
    clearNodeSubmenuCloseTimer();
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setContextMenu({
      x: window.innerWidth / 2 - 190,
      y: window.innerHeight / 2 - 150,
      text: item.title,
      page: 1,
    });
    setSelectedItemIds([itemId]);
    useGraphStore.getState().selectItem(itemId);
    setSpawnAction({ type: "spawn_waiting_on" });
  }, [items]);

  const handleSpawn = useCallback(
    async (data: { title: string; type: string; summary?: string; parent_item_id?: string | null; is_local?: boolean; flags?: string[]; blocker_reason?: string }) => {
      if (!spawnAction || !contextMenu) return;
      const { text, page } = contextMenu;

      try {
        switch (spawnAction.type) {
          case "spawn_waiting_on": {
            const item = await api.post<ItemData>("/items", {
              title: data.title,
              type: "note",
              parent_item_id: selectedItem?.id,
              summary: text,
              is_local: data.is_local ?? false,
              is_resolved: false,
              blocker_reason: data.blocker_reason ?? null,
              flags: data.flags && data.flags.length > 0 ? data.flags : ["stuck"],
            });
            addItem(item);
            selectAndReveal(item.id);
            if (selectedItem) {
              await api.post("/item-edges", {
                source_item_id: selectedItem.id,
                target_item_id: item.id,
                relationship: "waiting_on",
              });
              await api.post("/bookmarks", {
                item_id: selectedItem.id,
                page,
                quote: text,
                note: `Waiting on: ${data.title}`,
                spawned_item_id: item.id,
              });
              setBookmarkRefreshNonce((n) => n + 1);
            }
            break;
          }
          case "bookmark": {
            await api.post("/bookmarks", {
              item_id: selectedItem?.id,
              page,
              quote: text,
              note: data.title.startsWith("Bookmark") ? "" : data.title,
            });
            setBookmarkRefreshNonce((n) => n + 1);
            break;
          }
          case "spawn_llm_summary": {
            if (!selectedItem) break;
            const item = await api.post<ItemData>("/llm/spawn-summary", {
              parent_item_id: selectedItem.id,
              selected_text: text,
              page,
              custom_title: data.title.startsWith("Bookmark") ? undefined : data.title,
              is_local: data.is_local ?? false,
              flags: data.flags ?? [],
            });
            addItem(item);
            selectAndReveal(item.id);
            setBookmarkRefreshNonce((n) => n + 1);
            break;
          }
          case "spawn_notebook": {
            const item = await api.post<ItemData>("/llm/notebooks/create", {
              title: data.title.startsWith("Bookmark") ? `Notebook: ${text.slice(0, 30)}` : data.title,
              parent_item_id: selectedItem?.id,
              initial_text: text,
              is_local: data.is_local ?? false,
              flags: data.flags ?? [],
            });
            addItem(item);
            selectAndReveal(item.id);
            break;
          }
          case "spawn_branch": {
            const item = await api.post<ItemData>("/items", {
              title: data.title,
              type: "note",
              parent_item_id: selectedItem?.id,
              summary: text,
              is_local: data.is_local ?? false,
              flags: data.flags ?? [],
            });
            addItem(item);
            selectAndReveal(item.id);
            await api.post("/item-edges", {
              source_item_id: selectedItem?.id,
              target_item_id: item.id,
              relationship: "spawned_from",
            });
            break;
          }
          case "mark_progress": {
            if (!selectedItem) break;
            const pct = pdfTotalPages > 0 ? Math.round((page / pdfTotalPages) * 100) : 50;
            await api.put(`/items/${selectedItem.id}`, { progress: pct });
            updateItem(selectedItem.id, { progress: pct });
            break;
          }
        }
        loadData();
      } catch (e) {
        console.error("Spawn failed:", e);
      }
    },
    [spawnAction, contextMenu, selectedItem, pdfTotalPages, addItem, updateItem, loadData]
  );

  const handleTitleChange = useCallback(async (newTitle: string) => {
    if (!nodeMenu) return;
    if (newTitle === "__ai_suggest__") {
      return;
    }
    await api.put(`/items/${nodeMenu.itemId}`, { title: newTitle });
    updateItem(nodeMenu.itemId, { title: newTitle });
    setTitleDialog(false);
    setNodeMenu(null);
  }, [nodeMenu, updateItem]);

  const handleToggleNodeFlag = useCallback(
    async (itemId: string, flagId: FlagType) => {
      const targetItem = items.find((i) => i.id === itemId);
      if (!targetItem) return;
      const currentFlags = targetItem.flags || [];
      let nextFlags: string[];
      if (currentFlags.includes(flagId)) {
        nextFlags = currentFlags.filter((f) => f !== flagId);
      } else {
        nextFlags = [...currentFlags, flagId];
      }
      const updatedDate = new Date().toISOString();
      updateItem(itemId, { flags: nextFlags, last_accessed_at: updatedDate });
      try {
        await api.put<ItemData>(`/items/${itemId}`, { flags: nextFlags });
      } catch (err) {
        console.error("Failed to update item flag:", err);
      }
    },
    [items, updateItem]
  );

  const handleBackgroundContextMenu = useCallback((graphX: number, graphY: number, _screenX: number, _screenY: number) => {
    setAddDialogPosition({ graphX, graphY });
    setAddParentId(null);
    setAddInitialType("pdf");
    setShowAddDialog(true);
  }, []);

  const handleNodeDragEnd = useCallback(async (itemId: string, graphX: number, graphY: number) => {
    updateItem(itemId, { graph_x: graphX, graph_y: graphY });
    try {
      await api.put(`/items/${itemId}`, { graph_x: graphX, graph_y: graphY });
    } catch {
      // position save is best-effort
    }
  }, [updateItem]);

  const handleGraphPositionsCommit = useCallback(async (positions: Array<{ id: string; x: number; y: number }>) => {
    for (const position of positions) {
      updateItem(position.id, { graph_x: position.x, graph_y: position.y });
    }
    try {
      await Promise.all(
        positions.map((position) => api.put(`/items/${position.id}`, {
          graph_x: position.x,
          graph_y: position.y,
        }))
      );
    } catch {
      // best-effort persistence
    }
  }, [updateItem]);

  const handleAddItem = useCallback(async (data: { title: string; type: string; file_path?: string; source_url?: string; is_local?: boolean; flags?: string[] }) => {
    const spawnSource = addSpawnSource;
    const parentItem = addParentId ? items.find((i) => i.id === addParentId) : null;

    try {
      if (data.type === "llm-summary" && addParentId) {
        setStatus("saving...");
        const newSummaryItem = await api.post<ItemData>("/llm/spawn-summary", {
          parent_item_id: addParentId,
          selected_text: parentItem?.summary || parentItem?.title,
          custom_title: data.title || `Summary: ${truncateTitle(parentItem?.title || "")}`,
          is_local: data.is_local ?? false,
          flags: data.flags ?? [],
        });
        addItem(newSummaryItem);
        selectAndReveal(newSummaryItem.id);
        closeAddDialog();
        await loadData();
        return;
      }

      if (data.type === "notebook") {
        setStatus("saving...");
        const notebookItem = await api.post<ItemData>("/llm/notebooks/create", {
          title: data.title || `Notebook: ${truncateTitle(parentItem?.title || "Untitled")}`,
          parent_item_id: addParentId,
          initial_text: parentItem?.summary || parentItem?.title,
          is_local: data.is_local ?? false,
          flags: data.flags ?? [],
        });
        addItem(notebookItem);
        selectAndReveal(notebookItem.id);
        closeAddDialog();
        await loadData();
        return;
      }

      const payload: Record<string, unknown> = {
        ...data,
        parent_item_id: addParentId,
        is_local: data.is_local ?? false,
        flags: data.flags ?? [],
      };

      if (addDialogPosition && addParentId == null) {
        payload.graph_x = addDialogPosition.graphX;
        payload.graph_y = addDialogPosition.graphY;
      } else if (addParentId) {
        const parent = findItemPosition(addParentId);
        if (parent) {
          payload.graph_x = (parent.x ?? 0) + 140;
          payload.graph_y = (parent.y ?? 0) + 110;
        }
      } else if (selectedItem) {
        const selectedPos = findItemPosition(selectedItem.id);
        if (selectedPos) {
          payload.graph_x = (selectedPos.x ?? 0) + 100;
          payload.graph_y = (selectedPos.y ?? 0) + 100;
        }
      }

      const item = await api.post<ItemData>("/items", payload);
      addItem(item);

      if (spawnSource) {
        try {
          await api.post("/bookmarks", {
            item_id: spawnSource.itemId,
            page: spawnSource.page,
            quote: spawnSource.quote,
            note: `Spawned child: ${item.title}`,
            spawned_item_id: item.id,
          });
          setBookmarkRefreshNonce((n) => n + 1);
        } catch (err) {
          console.error("Failed to create origin bookmark:", err);
        }
      }

      selectAndReveal(item.id);
      closeAddDialog();
      await loadData();
    } catch (e) {
      console.error("Failed to add item:", e);
      setStatus("error");
    }
  }, [addItem, selectAndReveal, items, addParentId, addDialogPosition, closeAddDialog, findItemPosition, selectedItem, addSpawnSource, loadData, setStatus]);

  const focusItemInGraph = useCallback((itemId: string) => {
    selectAndReveal(itemId);
    setShowGraph(true);
    setFocusRequest({ itemId, nonce: Date.now() });
    setNodeMenu(null);
    setNodeSubmenu(null);
    clearNodeSubmenuCloseTimer();
  }, [clearNodeSubmenuCloseTimer, selectAndReveal]);

  const flashHighlight = useCallback((nodeId: string) => {
    setHighlightNodeId(nodeId);
    setFocusRequest({ itemId: nodeId, nonce: Date.now() });
    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightNodeId((current) => current === nodeId ? null : current);
      highlightTimeoutRef.current = null;
    }, 3000);
  }, []);

  // Child → Father: select father, scroll to bookmark page, highlight child in graph without selecting it
  const handleSelectParent = useCallback((parentId: string, page: number | null, childId?: string) => {
    selectAndReveal(parentId);
    if (page) {
      setPdfPage(page);
    }
    if (childId) {
      flashHighlight(childId);
    }
  }, [selectAndReveal, flashHighlight]);

  // Father bookmark click: scroll father's PDF to page, highlight+pan to child WITHOUT selecting it
  const handleSelectBookmark = useCallback((page: number | null, spawnedItemId: string | null, quote: string | null) => {
    if (page) {
      setPdfPage(page);
    }
    setPdfHighlightText(quote ?? null);
    if (spawnedItemId) {
      flashHighlight(spawnedItemId);
    }
  }, [flashHighlight]);




  const openSpawnChild = useCallback((itemId: string) => {
    setNodeMenu(null);
    setNodeSubmenu(null);
    openAddDialog({ parentId: itemId });
  }, [openAddDialog]);

  const openSpawnSibling = useCallback((itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    setNodeMenu(null);
    setNodeSubmenu(null);
    openAddDialog({ parentId: item?.parent_item_id ?? null });
  }, [items, openAddDialog]);

  const handleSpawnNodeLLMSummary = useCallback(async (itemId: string) => {
    setNodeMenu(null);
    setNodeSubmenu(null);
    clearNodeSubmenuCloseTimer();

    const targetItem = items.find((i) => i.id === itemId);
    if (!targetItem) return;

    try {
      setStatus("saving...");
      const newSummaryItem = await api.post<ItemData>("/llm/spawn-summary", {
        parent_item_id: targetItem.id,
        selected_text: targetItem.summary || targetItem.title,
        custom_title: `Summary: ${truncateTitle(targetItem.title)}`,
      });
      addItem(newSummaryItem);
      selectAndReveal(newSummaryItem.id);
      await loadData();
    } catch (e) {
      console.error("Failed to spawn LLM summary for node:", e);
      setStatus("error");
    }
  }, [items, addItem, selectAndReveal, loadData, setStatus, clearNodeSubmenuCloseTimer]);

  const handleSpawnNodeNotebook = useCallback(async (itemId: string) => {
    setNodeMenu(null);
    setNodeSubmenu(null);
    clearNodeSubmenuCloseTimer();

    const targetItem = items.find((i) => i.id === itemId);
    if (!targetItem) return;

    try {
      setStatus("saving...");
      const notebookItem = await api.post<ItemData>("/llm/notebooks/create", {
        title: `Notebook: ${truncateTitle(targetItem.title)}`,
        parent_item_id: targetItem.id,
        initial_text: targetItem.summary || targetItem.title,
      });
      addItem(notebookItem);
      selectAndReveal(notebookItem.id);
      await loadData();
    } catch (e) {
      console.error("Failed to spawn Notebook for node:", e);
      setStatus("error");
    }
  }, [items, addItem, selectAndReveal, loadData, setStatus, clearNodeSubmenuCloseTimer]);

  const maxSidebarWidth = rootRef.current ? Math.max(240, rootRef.current.clientWidth - 320) : 520;
  const maxGraphWidth = graphAreaRef.current ? Math.max(260, graphAreaRef.current.clientWidth - 240) : 1200;

  const renderTree = (parentId: string | null, depth: number) => {
    const children = childrenByParent.get(parentId) ?? [];
    return children.map((item) => {
      const itemChildren = childrenByParent.get(item.id) ?? [];
      const hasChildren = itemChildren.length > 0;
      const isExpanded = expandedIds.has(item.id);

      return (
        <div key={item.id}>
          <div className="flex items-center gap-1 transition-opacity duration-200" style={{ paddingLeft: `${4 + depth * 16}px`, opacity: item.opacity ?? 1.0 }}>
            {hasChildren ? (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  toggleItemExpansion(item.id);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                className="w-5 h-5 text-[11px] font-bold text-gray-400 hover:text-white hover:bg-gray-700 rounded flex items-center justify-center shrink-0 cursor-pointer select-none"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? "−" : "+"}
              </button>
            ) : (
              <span className="w-5 h-5 shrink-0" />
            )}

            <button
              onClick={() => selectAndReveal(item.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (hasChildren) {
                  toggleItemExpansion(item.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                selectAndReveal(item.id);
                handleNodeContextMenu(item.id, e.clientX, e.clientY);
              }}
              className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded text-sm hover:bg-gray-700 ${
                selectedItemId === item.id ? "bg-blue-800 text-blue-100 font-semibold" : "text-gray-300"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: `hsl(${Math.round((item.progress / 100) * 120)}, 80%, 55%)` }}
              />
              <span className="text-[10px] text-gray-500 w-10 shrink-0 uppercase">{item.type}</span>
              <span className="truncate flex-1" title={item.title}>{truncateTitle(item.title)}</span>
              {hasChildren && (
                <span
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleItemExpansion(item.id);
                  }}
                  className="text-[10px] text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-1.5 py-0.5 rounded-full shrink-0 cursor-pointer"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {itemChildren.length}
                </span>
              )}
            </button>
          </div>
          {isExpanded && renderTree(item.id, depth + 1)}
        </div>
      );
    });
  };

  const renderSidebarContent = () => (
    <>
      <div className="p-3 border-b border-gray-700">
        <SearchBar onSelect={(id) => selectAndReveal(id)} />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2 px-2">
          Items
        </h3>
        <div className="flex flex-col gap-0.5">
          {items.length === 0 && (
            <p className="text-gray-500 text-sm px-2">No items yet</p>
          )}
          {renderTree(null, 0)}
        </div>
      </div>
    </>
  );

  const renderGraphContent = () => (
    <div
      className="w-full h-full min-h-[300px]"
      onContextMenu={items.length === 0 ? (e) => {
        e.preventDefault();
        handleBackgroundContextMenu(e.nativeEvent.offsetX, e.nativeEvent.offsetY, e.clientX, e.clientY);
      } : undefined}
    >
      {items.length > 0 ? (
        <ItemGraph
          items={visibleItems}
          edges={visibleGraphEdges}
          selectedId={selectedItemId}
          selectedIds={selectedItemIds}
          hasChildrenIds={hasChildrenIds}
          expandedIds={expandedIds}
          onToggleExpand={toggleItemExpansion}
          focusItemId={focusRequest.itemId}
          focusNonce={focusRequest.nonce}
          highlightNodeId={highlightNodeId}
          onSelect={selectAndReveal}
          onToggleSelect={toggleSelectItem}
          onOpenMergeModal={handleOpenMergeModal}
          onClearMultiSelect={clearMultiSelect}
          onNodeContextMenu={handleNodeContextMenu}
          onBackgroundContextMenu={handleBackgroundContextMenu}
          onNodeDragEnd={handleNodeDragEnd}
          onGraphPositionsCommit={handleGraphPositionsCommit}
        />

      ) : (
        <div className="flex items-center justify-center h-full text-gray-600 text-xs">
          No items yet - right-click to add one
        </div>
      )}
    </div>
  );

  const activeUnresolvedBlockers = useMemo(() => {
    if (!selectedItem) return [];
    const waitingTargetIds = new Set(
      itemEdges.filter((e) => e.source_item_id === selectedItem.id && e.relationship === "waiting_on").map((e) => e.target_item_id)
    );
    return items.filter(
      (i) => (waitingTargetIds.has(i.id) || i.parent_item_id === selectedItem.id) && !i.is_resolved && (i.blocker_reason != null || (i.flags && i.flags.includes("stuck")))
    );
  }, [selectedItem, items, itemEdges]);

  const renderReaderContent = () => (
    <div className="flex-1 min-h-0 flex flex-col min-w-0 relative h-full">
      {activeUnresolvedBlockers.length > 0 && (
        <div className="bg-amber-950 border-b-2 border-amber-500 px-4 py-1.5 flex items-center justify-between text-xs text-amber-200 shrink-0 shadow-md z-10">
          <div className="flex items-center gap-2 truncate">
            <span className="text-sm">⚠️</span>
            <span className="font-extrabold uppercase tracking-wide">
              {activeUnresolvedBlockers.length} Prerequisite Blocker{activeUnresolvedBlockers.length > 1 ? "s" : ""}:
            </span>
            <span className="italic truncate text-slate-200">
              {activeUnresolvedBlockers.map((b) => b.title).join(", ")}
            </span>
          </div>
          <button
            onClick={() => selectAndReveal(activeUnresolvedBlockers[0].id)}
            className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold text-[11px] shrink-0 transition-colors"
          >
            Review Blocker ➔
          </button>
        </div>
      )}
      {isScratchPad && selectedItem ? (
        <ScratchPad
          resource={selectedItem}
          onUpdate={updateItem}
        />
      ) : isLatex && selectedItem ? (
        <LatexView resource={selectedItem} />
      ) : isNotebook && selectedItem ? (
        <NotebookView
          resource={selectedItem}
          onUpdate={updateItem}
        />
      ) : useAPdfjs && selectedItem ? (
        <APDF
          fileUrl={pdfUrl}
          currentPage={pdfPage}
          onPageChange={setPdfPage}
          onTotalPages={setPdfTotalPages}
          onSelectionAction={handleAPdfSelectionAction}
          highlightText={pdfHighlightText}
        />
      ) : usePdfjs && selectedItem ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <PDFContainer
            fileUrl={pdfUrl}
            currentPage={pdfPage}
            onPageChange={setPdfPage}
            onTotalPages={setPdfTotalPages}
            onTextSelect={handleTextSelect}
          />
        </div>
      ) : hasReader && selectedItem ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <ReadPane
            fileUrl={pdfUrl}
            sourceUrl={selectedItem.source_url}
            title={selectedItem.title}
          />
        </div>
      ) : isRichNote && selectedItem ? (
        <RichNoteView resource={selectedItem} onUpdate={updateItem} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-600">
          {items.length === 0
            ? "Use Menu -> Add to add your first item"
            : "Select an item from the sidebar or graph"}
        </div>
      )}
    </div>
  );

  const renderDetailsContent = () => (
    selectedItem ? (
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <ResourceDetail
          resource={selectedItem}
          onUpdate={updateItem}
          onClose={() => selectItem(null)}
          onSelectParent={handleSelectParent}
          onSpawnLLMSummary={handleSpawnNodeLLMSummary}
        />
        <div className="px-4 pb-4">
          <BookmarkList
            itemId={selectedItem.id}
            refreshNonce={bookmarkRefreshNonce}
            onSelectSpawned={selectAndReveal}
            onSelectBookmark={handleSelectBookmark}
          />
        </div>
      </div>
    ) : (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-4">
        Select an item to view details
      </div>
    )
  );

  const isGraphDockedInMain = showGraph && floatGraph === "docked";
  const isReaderDockedInMain = showReader && floatReader === "docked";
  const isDetailsDockedInMain = showDetails && floatDetails === "docked";

  return (
    <div ref={rootRef} className="flex h-full w-full bg-gray-900 text-gray-100 overflow-hidden">
      {showSidebar && floatSidebar === "docked" && (
        <aside className="border-r border-gray-700 flex flex-col shrink-0" style={{ width: sidebarWidth }}>
          <header className="p-3 border-b border-gray-700 flex items-center justify-between shrink-0">
            <div>
              <h1 className="text-base font-semibold">Research Tree</h1>
              <span className={`text-xs ${status === "ok" ? "text-green-400" : "text-red-400"}`}>
                API {status}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFloatSidebar((f) => (f === "docked" ? "floating" : f === "floating" ? "popout" : "docked"))}
                className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded"
                title="Toggle Docked / Floating / Desktop Popout"
              >
                {floatSidebar === "docked" ? "Float" : floatSidebar === "floating" ? "Popout ↗" : "Dock"}
              </button>
              <button
                onClick={savedLayout !== null ? restoreLayout : () => showOnlyPane("sidebar")}
                className={`px-2 py-0.5 text-xs border border-gray-700 rounded ${savedLayout !== null ? "text-blue-400 hover:text-blue-200 border-blue-600" : "text-gray-400 hover:text-gray-200"}`}
                title={savedLayout !== null ? "Restore saved layout" : "Show only this pane"}
              >
                {savedLayout !== null ? "Restore" : "Only"}
              </button>
              <button
                onClick={() => setShowSidebar(false)}
                className="px-2 py-0.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded"
                title="Hide items pane"
              >
                ✕
              </button>
            </div>
          </header>
          {renderSidebarContent()}
        </aside>
      )}

      {showSidebar && floatSidebar === "docked" && (
        <GraphSplitter
          onWidthChange={setSidebarWidth}
          minWidth={220}
          maxWidth={maxSidebarWidth}
          className="w-1.5 bg-gray-800 hover:bg-blue-500 cursor-col-resize shrink-0"
          getWidthFromClientX={(clientX) => {
            const left = rootRef.current?.getBoundingClientRect().left ?? 0;
            return clientX - left;
          }}
        />
      )}

      {(!showSidebar || floatSidebar !== "docked") && (
        <button
          onClick={() => { setShowSidebar(true); setFloatSidebar("docked"); }}
          className="absolute left-0 top-1/2 z-20 bg-gray-800 hover:bg-gray-700 px-1 py-8 rounded-r text-gray-400 border border-l-0 border-gray-700"
          title="Show items pane"
        >
          &raquo;
        </button>
      )}

      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="border-b border-gray-700 px-4 py-1.5 text-xs text-gray-400 flex items-center gap-3 shrink-0">
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => {
                const next = !menuOpen;
                setMenuOpen(next);
                setActiveMenu(null);
              }}
              className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium"
            >
              Menu
            </button>

            <CollectionSelector onCollectionSwitched={loadData} selectedItemId={selectedItemId} />

            <button
              onClick={() => setShowAnalyticsModal(true)}
              className="bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
            >
              📊 Profile Analytics
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onMouseDown={() => { setMenuOpen(false); setActiveMenu(null); }} />
                <div
                  className="absolute left-0 top-full mt-1 z-40 min-w-40 bg-gray-800 border border-gray-600 rounded shadow-xl py-1"
                  onMouseLeave={() => setActiveMenu(null)}
                >
                  <div className="relative" onMouseEnter={() => setActiveMenu("view")}>
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      View &rsaquo;
                    </button>
                    {activeMenu === "view" && (
                      <div className="absolute left-full top-0 ml-1 z-50 min-w-56 bg-gray-800 border border-gray-600 rounded shadow-xl py-1">
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                          onMouseDown={() => setShowSidebar((v) => !v)}
                        >
                          {showSidebar ? "Hide" : "Show"} Items Pane
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                          onMouseDown={() => setShowGraph((v) => !v)}
                        >
                          {showGraph ? "Hide" : "Show"} Graph Pane
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                          onMouseDown={() => setShowReader((v) => !v)}
                        >
                          {showReader ? "Hide" : "Show"} Reader Pane
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                          onMouseDown={() => setShowDetails((v) => !v)}
                        >
                          {showDetails ? "Hide" : "Show"} Details Pane
                        </button>
                        <div className="border-t border-gray-700 my-1" />
                        <button
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
                          onMouseDown={() => showOnlyPane("sidebar")}
                        >
                          Show Only Items Pane
                        </button>
                        <button
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
                          onMouseDown={() => showOnlyPane("graph")}
                        >
                          Show Only Graph Pane
                        </button>
                        <button
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
                          onMouseDown={() => showOnlyPane("reader")}
                        >
                          Show Only Reader Pane
                        </button>
                        <button
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
                          onMouseDown={() => showOnlyPane("details")}
                        >
                          Show Only Details Pane
                        </button>
                        <div className="border-t border-gray-700 my-1" />
                        <button
                          disabled={savedLayout === null}
                          className={`w-full text-left px-3 py-1.5 text-xs ${savedLayout !== null ? "text-blue-400 hover:bg-gray-700 font-semibold" : "text-gray-500 cursor-not-allowed"}`}
                          onMouseDown={() => restoreLayout()}
                        >
                          Restore Saved Layout
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="relative" onMouseEnter={() => setActiveMenu("add")}>
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      Add &rsaquo;
                    </button>
                    {activeMenu === "add" && (
                      <div className="absolute left-full top-0 ml-1 z-50 min-w-56 bg-gray-800 border border-gray-600 rounded shadow-xl py-1">
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                          onMouseDown={() => openAddDialog({ parentId: null, initialType: "pdf" })}
                        >
                          New Item (Top-Level)
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                          onMouseDown={() => openAddDialog({ parentId: null, initialType: "note" })}
                        >
                          New Note (Top-Level)
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-700 my-1" />
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 text-blue-300 font-medium"
                    onMouseDown={() => { setMenuOpen(false); setShowSettingsDialog(true); }}
                  >
                    Settings ⚙
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setShowSettingsDialog(true)}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 px-2.5 py-1 rounded text-xs flex items-center gap-1 font-medium"
            title="Open Settings & Preferences"
          >
            Settings ⚙
          </button>

          {showGraph && (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => setFloatGraph((f) => (f === "docked" ? "floating" : f === "floating" ? "popout" : "docked"))}
                className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded"
                title="Toggle Docked / Floating / Desktop Popout"
              >
                {floatGraph === "docked" ? "Float Graph" : floatGraph === "floating" ? "Popout Graph ↗" : "Dock Graph"}
              </button>
              <button
                onClick={savedLayout !== null ? restoreLayout : () => showOnlyPane("graph")}
                className={`px-2 py-0.5 text-xs border border-gray-700 rounded ${savedLayout !== null ? "text-blue-400 hover:text-blue-200 border-blue-600" : "text-gray-400 hover:text-gray-200"}`}
                title={savedLayout !== null ? "Restore saved layout" : "Show only graph pane"}
              >
                {savedLayout !== null ? "Restore" : "Only"}
              </button>
            </div>
          )}

          {selectedItem && hasPdf && showReader && (
            <div className="flex items-center gap-1 ml-1 bg-gray-700 rounded p-0.5">
              <button
                onClick={() => setViewerMode("native")}
                className={`px-2 py-0.5 rounded text-xs ${
                  viewerMode === "native" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"
                }`}
              >
                Native
              </button>
              <button
                onClick={() => setViewerMode("pdfjs")}
                className={`px-2 py-0.5 rounded text-xs ${
                  viewerMode === "pdfjs" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"
                }`}
              >
                PDF.js
              </button>
              <button
                onClick={() => setViewerMode("apdfjs")}
                className={`px-2 py-0.5 rounded text-xs ${
                  viewerMode === "apdfjs" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"
                }`}
              >
                APDF.js
              </button>
            </div>
          )}

          {showReader && (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => setFloatReader((f) => (f === "docked" ? "floating" : f === "floating" ? "popout" : "docked"))}
                className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded"
                title="Toggle Docked / Floating / Desktop Popout"
              >
                {floatReader === "docked" ? "Float Reader" : floatReader === "floating" ? "Popout Reader ↗" : "Dock Reader"}
              </button>
              <button
                onClick={savedLayout !== null ? restoreLayout : () => showOnlyPane("reader")}
                className={`px-2 py-0.5 text-xs border border-gray-700 rounded ${savedLayout !== null ? "text-blue-400 hover:text-blue-200 border-blue-600" : "text-gray-400 hover:text-gray-200"}`}
                title={savedLayout !== null ? "Restore saved layout" : "Show only reader pane"}
              >
                {savedLayout !== null ? "Restore" : "Only"}
              </button>
            </div>
          )}

          {selectedItem && (
            <span className="font-medium text-gray-200 truncate" title={selectedItem.title}>
              {truncateTitle(selectedItem.title)}
            </span>
          )}
          {!selectedItem && (
            <span>Select an item from the sidebar or graph</span>
          )}
        </header>

        <div ref={graphAreaRef} className="flex-1 flex min-h-0">
          {isGraphDockedInMain && (
            <div
              className="shrink-0 overflow-hidden border-r border-gray-700"
              style={{ width: isReaderDockedInMain || (isDetailsDockedInMain && !isReaderDockedInMain) ? graphWidth : "100%" }}
            >
              {renderGraphContent()}
            </div>
          )}

          {isGraphDockedInMain && (isReaderDockedInMain || (isDetailsDockedInMain && !isReaderDockedInMain)) && (
            <GraphSplitter
              onWidthChange={setGraphWidth}
              minWidth={240}
              maxWidth={maxGraphWidth}
              getWidthFromClientX={(clientX) => {
                const left = graphAreaRef.current?.getBoundingClientRect().left ?? 0;
                return clientX - left;
              }}
            />
          )}

          {isReaderDockedInMain && (
            <div className={`flex-1 flex min-w-0 ${isDetailsDockedInMain && detailDock === "right" ? "flex-row" : "flex-col"}`}>
              {renderReaderContent()}

              {/* Bottom Docked Details Panel */}
              {isDetailsDockedInMain && detailDock === "bottom" && (
                <div className="shrink-0 border-t border-gray-700 bg-gray-850 flex flex-col">
                  {detailExpanded && (
                    <div
                      className="h-1 bg-gray-700 hover:bg-blue-500 cursor-row-resize shrink-0 transition-colors touch-none"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        const startY = e.clientY;
                        const startHeight = detailHeight;
                        const handlePointerMove = (moveEvent: PointerEvent) => {
                          const newHeight = Math.max(120, Math.min(600, startHeight - (moveEvent.clientY - startY)));
                          setDetailHeight(newHeight);
                        };
                        const handlePointerUp = () => {
                          document.removeEventListener("pointermove", handlePointerMove);
                          document.removeEventListener("pointerup", handlePointerUp);
                        };
                        document.addEventListener("pointermove", handlePointerMove);
                        document.addEventListener("pointerup", handlePointerUp);
                      }}
                    />
                  )}
                  <div className="flex items-center justify-between bg-gray-800/50 border-b border-gray-700 shrink-0">
                    <button
                      onClick={() => setDetailExpanded((d) => !d)}
                      className="flex-1 flex items-center gap-2 px-4 py-1.5 text-xs text-gray-400 hover:text-gray-200"
                    >
                      {detailExpanded ? "▼" : "▶"} Details
                    </button>
                    <div className="flex items-center">
                      <button
                        onClick={() => setFloatDetails((f) => (f === "docked" ? "floating" : f === "floating" ? "popout" : "docked"))}
                        className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 border-l border-gray-700"
                        title="Toggle Docked / Floating / Desktop Popout"
                      >
                        {floatDetails === "docked" ? "Float" : floatDetails === "floating" ? "Popout ↗" : "Dock"}
                      </button>
                      <button
                        onClick={savedLayout !== null ? restoreLayout : () => showOnlyPane("details")}
                        className={`px-3 py-1.5 text-xs border-l border-gray-700 ${savedLayout !== null ? "text-blue-400 hover:text-blue-200" : "text-gray-400 hover:text-gray-200"}`}
                        title={savedLayout !== null ? "Restore saved layout" : "Show only details pane"}
                      >
                        {savedLayout !== null ? "Restore" : "Only"}
                      </button>
                      <button
                        onClick={() => setDetailDock("right")}
                        className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 border-l border-gray-700"
                        title="Dock to Side"
                      >
                        Dock to Side →
                      </button>
                      <button
                        onClick={() => setShowDetails(false)}
                        className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 border-l border-gray-700"
                        title="Hide details pane"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {detailExpanded && (
                    <div style={{ height: `${detailHeight}px` }} className="overflow-y-auto flex flex-col">
                      {renderDetailsContent()}
                    </div>
                  )}
                </div>
              )}

              {/* Right Docked Details Panel */}
              {isDetailsDockedInMain && detailDock === "right" && (
                <>
                  <div
                    className="w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors touch-none"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const startX = e.clientX;
                      const startWidth = detailWidth;
                      const handlePointerMove = (moveEvent: PointerEvent) => {
                        const newWidth = Math.max(250, Math.min(800, startWidth - (moveEvent.clientX - startX)));
                        setDetailWidth(newWidth);
                      };
                      const handlePointerUp = () => {
                        document.removeEventListener("pointermove", handlePointerMove);
                        document.removeEventListener("pointerup", handlePointerUp);
                      };
                      document.addEventListener("pointermove", handlePointerMove);
                      document.addEventListener("pointerup", handlePointerUp);
                    }}
                  />
                  <div
                    style={{ width: `${detailWidth}px` }}
                    className="shrink-0 border-l border-gray-700 bg-gray-850 flex flex-col overflow-hidden"
                  >
                    <div className="flex items-center justify-between bg-gray-800/50 border-b border-gray-700 shrink-0">
                      <div className="px-4 py-1.5 text-xs text-gray-400 font-semibold">
                        Details
                      </div>
                      <div className="flex items-center">
                        <button
                          onClick={() => setFloatDetails((f) => (f === "docked" ? "floating" : f === "floating" ? "popout" : "docked"))}
                          className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 border-l border-gray-700"
                          title="Toggle Docked / Floating / Desktop Popout"
                        >
                          {floatDetails === "docked" ? "Float" : floatDetails === "floating" ? "Popout ↗" : "Dock"}
                        </button>
                        <button
                          onClick={savedLayout !== null ? restoreLayout : () => showOnlyPane("details")}
                          className={`px-3 py-1.5 text-xs border-l border-gray-700 ${savedLayout !== null ? "text-blue-400 hover:text-blue-200" : "text-gray-400 hover:text-gray-200"}`}
                          title={savedLayout !== null ? "Restore saved layout" : "Show only details pane"}
                        >
                          {savedLayout !== null ? "Restore" : "Only"}
                        </button>
                        <button
                          onClick={() => setDetailDock("bottom")}
                          className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 border-l border-gray-700"
                          title="Dock to Bottom"
                        >
                          Dock to Bottom ↓
                        </button>
                        <button
                          onClick={() => setShowDetails(false)}
                          className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 border-l border-gray-700"
                          title="Hide details pane"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {renderDetailsContent()}
                  </div>
                </>
              )}
            </div>
          )}

          {!isReaderDockedInMain && isDetailsDockedInMain && (
            <div className="flex-1 flex flex-col min-w-0 border-l border-gray-700 bg-gray-850 overflow-hidden">
              <div className="flex items-center justify-between bg-gray-800/50 border-b border-gray-700 shrink-0 px-4 py-1.5">
                <div className="text-xs text-gray-400 font-semibold">Details</div>
                <div className="flex items-center">
                  <button
                    onClick={() => setFloatDetails((f) => (f === "docked" ? "floating" : f === "floating" ? "popout" : "docked"))}
                    className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded mr-2"
                    title="Toggle Docked / Floating / Desktop Popout"
                  >
                    {floatDetails === "docked" ? "Float" : floatDetails === "floating" ? "Popout ↗" : "Dock"}
                  </button>
                  <button
                    onClick={savedLayout !== null ? restoreLayout : () => showOnlyPane("details")}
                    className={`px-3 py-1 text-xs border border-gray-700 rounded mr-2 ${savedLayout !== null ? "text-blue-400 hover:text-blue-200" : "text-gray-400 hover:text-gray-200"}`}
                    title={savedLayout !== null ? "Restore saved layout" : "Show only details pane"}
                  >
                    {savedLayout !== null ? "Restore" : "Only"}
                  </button>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="px-2 py-0.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded"
                    title="Hide details pane"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {renderDetailsContent()}
            </div>
          )}

          {!isGraphDockedInMain && !isReaderDockedInMain && !isDetailsDockedInMain && (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              All main layout panes are hidden or floated. Use Menu -&gt; View to show a pane.
            </div>
          )}
        </div>
      </main>

      {/* Floating & Popout Windows */}
      {floatSidebar === "floating" && (
        <DraggableFloatingPane
          title="Items / Tree View"
          initialX={40}
          initialY={70}
          width={340}
          height={580}
          onClose={() => setFloatSidebar("docked")}
          onPopout={() => setFloatSidebar("popout")}
        >
          {renderSidebarContent()}
        </DraggableFloatingPane>
      )}

      {floatSidebar === "popout" && (
        <PopoutWindow
          title="Items / Tree View"
          onClose={() => setFloatSidebar("docked")}
          width={380}
          height={600}
        >
          {renderSidebarContent()}
        </PopoutWindow>
      )}

      {floatGraph === "floating" && (
        <DraggableFloatingPane
          title="Graph View"
          initialX={160}
          initialY={60}
          width={680}
          height={560}
          onClose={() => setFloatGraph("docked")}
          onPopout={() => setFloatGraph("popout")}
        >
          {renderGraphContent()}
        </DraggableFloatingPane>
      )}

      {floatGraph === "popout" && (
        <PopoutWindow
          title="Graph View"
          onClose={() => setFloatGraph("docked")}
          width={780}
          height={620}
        >
          {renderGraphContent()}
        </PopoutWindow>
      )}

      {floatReader === "floating" && (
        <DraggableFloatingPane
          title={selectedItem ? `Working Area: ${selectedItem.title}` : "Working Area"}
          initialX={280}
          initialY={70}
          width={720}
          height={650}
          onClose={() => setFloatReader("docked")}
          onPopout={() => setFloatReader("popout")}
        >
          {renderReaderContent()}
        </DraggableFloatingPane>
      )}

      {floatReader === "popout" && (
        <PopoutWindow
          title={selectedItem ? `Working Area: ${selectedItem.title}` : "Working Area"}
          onClose={() => setFloatReader("docked")}
          width={820}
          height={720}
        >
          {renderReaderContent()}
        </PopoutWindow>
      )}

      {floatDetails === "floating" && (
        <DraggableFloatingPane
          title={selectedItem ? `Details: ${selectedItem.title}` : "Details"}
          initialX={500}
          initialY={100}
          width={440}
          height={560}
          onClose={() => setFloatDetails("docked")}
          onPopout={() => setFloatDetails("popout")}
        >
          {renderDetailsContent()}
        </DraggableFloatingPane>
      )}

      {floatDetails === "popout" && (
        <PopoutWindow
          title={selectedItem ? `Details: ${selectedItem.title}` : "Details"}
          onClose={() => setFloatDetails("docked")}
          width={460}
          height={600}
        >
          {renderDetailsContent()}
        </PopoutWindow>
      )}

      {showSettingsDialog && (
        <SettingsDialog onClose={() => setShowSettingsDialog(false)} />
      )}

      {showAddDialog && (
        <AddItemDialog
          initialType={addInitialType}
          initialTitle={addInitialTitle}
          parentItem={addParentId ? items.find((i) => i.id === addParentId) : null}
          onSubmit={handleAddItem}
          onClose={closeAddDialog}
        />
      )}

      {contextMenu && !spawnAction && (
        <ContextMenu
          x={contextMenu.x || 100}
          y={contextMenu.y || 100}
          selectedText={contextMenu.text}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      {spawnAction && contextMenu && (
        <SpawnDialog
          action={spawnAction}
          selectedText={contextMenu.text}
          currentPage={contextMenu.page}
          currentItemId={selectedItemId}
          onSubmit={handleSpawn}
          onClose={() => {
            setSpawnAction(null);
            setContextMenu(null);
          }}
        />
      )}

      {nodeMenu && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => { setNodeMenu(null); setNodeSubmenu(null); clearNodeSubmenuCloseTimer(); }} />
          <div
            ref={nodeMenuRef}
            className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-48"
            style={{ left: nodeMenu.x, top: nodeMenu.y }}
            onContextMenu={(e) => e.preventDefault()}
            onMouseLeave={scheduleNodeSubmenuClose}
          >
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
              onMouseDown={() => focusItemInGraph(nodeMenu.itemId)}
            >
              Focus In Graph
            </button>

            {hasChildrenIds.has(nodeMenu.itemId) && (
              <>
                {expandedIds.has(nodeMenu.itemId) ? (
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      collapseItem(nodeMenu.itemId);
                      setNodeMenu(null);
                    }}
                  >
                    Collapse
                  </button>
                ) : (
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      expandItem(nodeMenu.itemId);
                      setNodeMenu(null);
                    }}
                  >
                    Expand
                  </button>
                )}

                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    expandAllFromItem(nodeMenu.itemId);
                    setNodeMenu(null);
                  }}
                >
                  Expand All
                </button>
              </>
            )}

            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
              onMouseDown={() => {
                void handleOrganizeRequest(nodeMenu.itemId);
              }}
            >
              Organize
            </button>

            <div
              className="relative"
              onMouseEnter={() => {
                clearNodeSubmenuCloseTimer();
                setNodeSubmenu("spawn");
              }}
              onMouseLeave={scheduleNodeSubmenuClose}
            >
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                onMouseDown={(e) => e.preventDefault()}
              >
                Spawn &rsaquo;
              </button>
              {nodeSubmenu === "spawn" && (
                <div
                  className="absolute left-full top-0 ml-1 z-50 min-w-40 bg-gray-800 border border-gray-600 rounded shadow-xl py-1"
                  onMouseEnter={clearNodeSubmenuCloseTimer}
                  onMouseLeave={scheduleNodeSubmenuClose}
                >
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-amber-300 hover:bg-gray-700 flex items-center justify-between font-medium"
                    onMouseDown={() => openSpawnWaitingOn(nodeMenu.itemId)}
                  >
                    <span>Waiting On... (Blocker)</span>
                    <span className="text-xs">⏳</span>
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                    onMouseDown={() => openSpawnChild(nodeMenu.itemId)}
                  >
                    Child
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                    onMouseDown={() => openSpawnSibling(nodeMenu.itemId)}
                  >
                    Sibling
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 text-purple-300 flex items-center justify-between"
                    onMouseDown={() => void handleSpawnNodeLLMSummary(nodeMenu.itemId)}
                  >
                    <span>LLM Summary</span>
                    <span className="text-xs">🤖</span>
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 text-blue-300 flex items-center justify-between"
                    onMouseDown={() => void handleSpawnNodeNotebook(nodeMenu.itemId)}
                  >
                    <span>Notebook</span>
                    <span className="text-xs">📓</span>
                  </button>
                </div>
              )}
            </div>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
              onMouseDown={() => {
                setTitleDialog(true);
              }}
            >
              Change Title
            </button>

            {/* Opacity Submenu */}
            <div
              className="relative"
              onMouseEnter={() => {
                clearNodeSubmenuCloseTimer();
                setNodeSubmenu("opacity");
              }}
              onMouseLeave={scheduleNodeSubmenuClose}
            >
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center justify-between"
                onMouseDown={(e) => e.preventDefault()}
              >
                <span>👁️ Opacity</span>
                <span className="text-xs text-slate-400 font-mono">&rsaquo;</span>
              </button>
              {nodeSubmenu === "opacity" && (
                <div
                  className="absolute left-full top-0 ml-1 z-50 min-w-36 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 text-xs"
                  onMouseEnter={clearNodeSubmenuCloseTimer}
                  onMouseLeave={scheduleNodeSubmenuClose}
                >
                  {[
                    { label: "100% (Default)", val: 1.0 },
                    { label: "75% Dimmed", val: 0.75 },
                    { label: "50% Half", val: 0.5 },
                    { label: "25% Low", val: 0.25 },
                    { label: "10% Faint", val: 0.1 },
                  ].map((opt) => {
                    const nodeItem = items.find((i) => i.id === nodeMenu.itemId);
                    const isSelected = Math.abs((nodeItem?.opacity ?? 1.0) - opt.val) < 0.02;
                    return (
                      <button
                        key={opt.val}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-gray-700 ${
                          isSelected ? "text-amber-300 font-bold bg-amber-950/30" : "text-gray-300"
                        }`}
                        onMouseDown={async (e) => {
                          e.stopPropagation();
                          updateItem(nodeMenu.itemId, { opacity: opt.val });
                          await api.put(`/items/${nodeMenu.itemId}`, { opacity: opt.val }).catch(() => {});
                          setNodeSubmenu(null);
                        }}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Role Flags Submenu */}
            <div
              className="relative"
              onMouseEnter={() => {
                clearNodeSubmenuCloseTimer();
                setNodeSubmenu("flags");
              }}
              onMouseLeave={scheduleNodeSubmenuClose}
            >
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center justify-between"
                onMouseDown={(e) => e.preventDefault()}
              >
                <span>Role Flags</span>
                <span className="text-xs text-slate-400 font-mono">&rsaquo;</span>
              </button>
              {nodeSubmenu === "flags" && (
                <div
                  className="absolute left-full top-0 ml-1 z-50 min-w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1"
                  onMouseEnter={clearNodeSubmenuCloseTimer}
                  onMouseLeave={scheduleNodeSubmenuClose}
                >
                  {(() => {
                    const nodeItem = items.find((i) => i.id === nodeMenu.itemId);
                    const currentFlags = nodeItem?.flags || [];
                    return (Object.keys(FLAG_DEFINITIONS) as FlagType[]).map((flagKey) => {
                      const def = FLAG_DEFINITIONS[flagKey];
                      const isSelected = currentFlags.includes(flagKey);
                      return (
                        <button
                          key={flagKey}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-700 ${
                            isSelected ? "text-emerald-300 font-semibold bg-emerald-950/30" : "text-gray-300"
                          }`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            void handleToggleNodeFlag(nodeMenu.itemId, flagKey);
                          }}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <span>{def.emoji}</span>
                            <span className="truncate">{def.label}</span>
                          </span>
                          {isSelected && <span className="text-xs text-emerald-400 font-bold ml-2">✓</span>}
                        </button>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Duplicate & Multi-Select Merge Options */}
            {(() => {
              const nodeItem = items.find((i) => i.id === nodeMenu.itemId);
              const key = nodeItem ? getNormalizedResourceKey(nodeItem) : null;
              const duplicates = key
                ? items.filter((i) => getNormalizedResourceKey(i) === key)
                : [];

              return (
                <>
                  {duplicates.length > 1 && (
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-amber-300 hover:bg-gray-700 flex items-center justify-between"
                      onMouseDown={() => {
                        const dupIds = duplicates.map((d) => d.id);
                        revealMultipleItems(dupIds);
                        setSelectedItemIds(dupIds);
                        setNodeMenu(null);
                      }}
                    >
                      <span>Select All Duplicates ({duplicates.length})</span>
                      <span className="text-xs">🪞</span>
                    </button>
                  )}

                  {duplicates.length > 1 && (
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-purple-300 hover:bg-gray-700 flex items-center justify-between font-semibold border-t border-gray-700/80 mt-1 pt-1"
                      onMouseDown={() => {
                        handleOpenMergeModal(duplicates, nodeMenu.itemId);
                        setNodeMenu(null);
                      }}
                    >
                      <div className="flex flex-col">
                        <span>Set as Primary & Merge Duplicates ({duplicates.length})...</span>
                        <span className="text-[10px] text-purple-300/70 font-normal">Keep this node visually</span>
                      </div>
                      <span className="text-xs">🔀</span>
                    </button>
                  )}
                  {selectedItemIds.length > 1 && (
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-purple-300 hover:bg-gray-700 flex items-center justify-between font-semibold border-t border-gray-700/80 mt-1 pt-1"
                      onMouseDown={() => {
                        const selectedObjs = items.filter((i) => selectedItemIds.includes(i.id));
                        handleOpenMergeModal(selectedObjs, nodeMenu.itemId);
                        setNodeMenu(null);
                      }}
                    >
                      <div className="flex flex-col">
                        <span>Set as Primary & Merge Selected ({selectedItemIds.length})...</span>
                        <span className="text-[10px] text-purple-300/70 font-normal">Keep this node visually</span>
                      </div>
                      <span className="text-xs">🔀</span>
                    </button>
                  )}
                </>
              );
            })()}

            <div className="border-t border-gray-700 my-1" />
            <button
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700"
              onMouseDown={() => {
                void requestDeleteItem(nodeMenu.itemId);
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}

      {titleDialog && nodeMenu && (
        <TitleDialog
          currentTitle={items.find((i) => i.id === nodeMenu.itemId)?.title ?? ""}
          onSubmit={handleTitleChange}
          onClose={() => { setTitleDialog(false); setNodeMenu(null); setNodeSubmenu(null); }}
        />
      )}

      {/* Merge Modal */}
      <MergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        selectedItems={mergeModalItems}
        initialPrimaryId={mergePrimaryId}
        onMergeSuccess={async (primaryItem) => {
          await loadData();
          clearMultiSelect();
          selectAndReveal(primaryItem.id);
        }}
      />



      {deletePrompt && (
        <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-4">
            <h3 className="text-base font-semibold text-gray-100">Delete Item</h3>
            {deletePrompt.descendantCount > 0 ? (
              <>
                <p className="text-sm text-gray-300 mt-2">
                  This item has {deletePrompt.descendantCount} child item{deletePrompt.descendantCount === 1 ? "" : "s"}.
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Choose whether to delete only this item (children become top-level) or delete the whole subtree.
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-300 mt-2">
                Delete this item?
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <button
                className="px-3 py-1.5 text-sm rounded border border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={() => setDeletePrompt(null)}
              >
                Cancel
              </button>
              {deletePrompt.descendantCount > 0 ? (
                <>
                  <button
                    className="px-3 py-1.5 text-sm rounded border border-amber-600 text-amber-300 hover:bg-amber-900/30"
                    onClick={() => { void confirmDeleteItem(deletePrompt.itemId, "single"); }}
                  >
                    Delete Only This Item
                  </button>
                  <button
                    className="px-3 py-1.5 text-sm rounded bg-red-700 text-white hover:bg-red-600"
                    onClick={() => { void confirmDeleteItem(deletePrompt.itemId, "subtree"); }}
                  >
                    Delete Item and Children
                  </button>
                </>
              ) : (
                <button
                  className="px-3 py-1.5 text-sm rounded bg-red-700 text-white hover:bg-red-600"
                  onClick={() => { void confirmDeleteItem(deletePrompt.itemId, "single"); }}
                >
                  Delete Item
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {showAnalyticsModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden relative">
            <button
              onClick={() => setShowAnalyticsModal(false)}
              className="absolute right-4 top-4 z-10 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center font-bold"
            >
              ✕
            </button>
            <AnalyticsDashboard />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
