import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api } from "./api/client";
import {
  useGraphStore,
  type ItemData,
  type ItemEdgeData,
} from "./store/useGraphStore";
import { SearchBar } from "./components/Sidebar/SearchBar";
import { ItemGraph } from "./components/GraphView/ItemGraph";
import { GraphSplitter } from "./components/GraphView/GraphSplitter";
import { ReadPane } from "./components/NodePanel/ReadPane";
import { ResourceDetail } from "./components/NodePanel/ResourceDetail";
import { BookmarkList } from "./components/NodePanel/BookmarkList";
import { TitleDialog } from "./components/NodePanel/TitleDialog";
import { AddItemDialog } from "./components/NodePanel/AddItemDialog";
import { ScratchPad } from "./components/NodePanel/ScratchPad";
import { LatexView } from "./components/NodePanel/LatexView";
import { PDFContainer } from "./components/PDFViewer/PDFContainer";
import { APDF } from "./components/PDFViewer/APDF";
import { ContextMenu, type MenuAction } from "./components/PDFViewer/ContextMenu";
import { SpawnDialog } from "./components/PDFViewer/SpawnDialog";

type NodeContextMenu = {
  itemId: string;
  x: number;
  y: number;
};

function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const graphAreaRef = useRef<HTMLDivElement>(null);

  const {
    items,
    itemEdges,
    selectedItemId,
    selectNonce,
    setItems,
    setItemEdges,
    selectItem,
    updateItem,
    addItem,
  } = useGraphStore();

  const [status, setStatus] = useState("connecting...");

  const [showSidebar, setShowSidebar] = useState(true);
  const [showGraph, setShowGraph] = useState(true);
  const [showReader, setShowReader] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [graphWidth, setGraphWidth] = useState(380);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<"view" | "add" | null>(null);

  const [viewerMode, setViewerMode] = useState<"native" | "pdfjs" | "apdfjs">("apdfjs");

  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfHighlightText, setPdfHighlightText] = useState<string | null>(null);
  const [bookmarkRefreshNonce, setBookmarkRefreshNonce] = useState(0);

  const [detailExpanded, setDetailExpanded] = useState(true);

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
  const [nodeSubmenu, setNodeSubmenu] = useState<"spawn" | null>(null);
  const nodeMenuRef = useRef<HTMLDivElement>(null);
  const nodeSubmenuCloseTimerRef = useRef<number | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("collapsedIds");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
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
      localStorage.setItem("collapsedIds", JSON.stringify(Array.from(collapsedIds)));
    } catch (e) {
      console.error("Failed to save collapsedIds state:", e);
    }
  }, [collapsedIds]);

  const selectedItem = items.find((r) => r.id === selectedItemId) ?? null;
  const hasReader = selectedItem && (selectedItem.file_path || selectedItem.source_url);

  useEffect(() => {
    if (selectedItem && (selectedItem.file_path || selectedItem.source_url) && !showReader) {
      setShowReader(true);
    }
  }, [selectNonce, selectedItem, showReader]);

  const hasPdf = selectedItem?.file_path != null;
  const pdfUrl = hasPdf ? `/api/items/${selectedItem!.id}/file` : null;
  const usePdfjs = hasPdf && viewerMode === "pdfjs";
  const useAPdfjs = hasPdf && viewerMode === "apdfjs";
  const isScratchPad = selectedItem?.type === "scratch-pad";
  const isLatex = selectedItem?.type === "latex";

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
    for (const item of items) {
      const validParent = item.parent_item_id && idSet.has(item.parent_item_id) ? item.parent_item_id : null;
      const arr = map.get(validParent) ?? [];
      arr.push(item);
      map.set(validParent, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
    }
    return map;
  }, [items, idSet]);

  useEffect(() => {
    if (items.length === 0) return; // Prevent wiping state before items load
    setCollapsedIds((prev) => {
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
      if (collapsedIds.has(next.id)) continue;
      const children = childrenByParent.get(next.id) ?? [];
      for (const child of children) stack.push(child);
    }

    return visible;
  }, [childrenByParent, collapsedIds]);

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

  const expandItem = useCallback((itemId: string) => {
    setCollapsedIds((prev) => {
      if (!prev.has(itemId)) return prev;
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  const collapseItem = useCallback((itemId: string) => {
    if (!hasChildrenIds.has(itemId)) return;
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  }, [hasChildrenIds]);

  const expandAllFromItem = useCallback((itemId: string) => {
    const descendants = getDescendantIds(itemId);
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      for (const descendantId of descendants) {
        next.delete(descendantId);
      }
      return next;
    });
  }, [getDescendantIds]);

  const revealItemInTree = useCallback((itemId: string) => {
    const itemById = new Map(items.map((item) => [item.id, item]));
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      let current = itemById.get(itemId);
      while (current?.parent_item_id) {
        if (next.delete(current.parent_item_id)) {
          changed = true;
        }
        current = itemById.get(current.parent_item_id);
      }
      return changed ? next : prev;
    });
  }, [items]);

  const selectAndReveal = useCallback((itemId: string | null) => {
    if (itemId) revealItemInTree(itemId);
    selectItem(itemId);
  }, [revealItemInTree, selectItem]);



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

  const handleSpawn = useCallback(
    async (data: { title: string; type: string; summary?: string; parent_item_id?: string | null }) => {
      if (!spawnAction || !contextMenu) return;
      const { text, page } = contextMenu;

      try {
        switch (spawnAction.type) {
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
          case "spawn_note":
          case "spawn_branch": {
            const item = await api.post<ItemData>("/items", {
              title: data.title,
              type: "note",
              parent_item_id: selectedItem?.id,
              summary: text,
            });
            addItem(item);
            if (spawnAction.type === "spawn_branch") {
              await api.post("/item-edges", {
                source_item_id: selectedItem?.id,
                target_item_id: item.id,
                relationship: "spawned_from",
              });
            }
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

  const handleAddItem = useCallback(async (data: { title: string; type: string; file_path?: string; source_url?: string }) => {
    const spawnSource = addSpawnSource; // Capture state synchronously before awaits!
    const payload: Record<string, unknown> = {
      ...data,
      parent_item_id: addParentId,
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

    selectItem(item.id);
    closeAddDialog();
    void loadData();
  }, [addItem, selectItem, addParentId, addDialogPosition, closeAddDialog, findItemPosition, selectedItem, addSpawnSource, loadData]);

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

  const showDetail = selectedItem != null && !hasReader;

  const maxSidebarWidth = rootRef.current ? Math.max(240, rootRef.current.clientWidth - 320) : 520;
  const maxGraphWidth = graphAreaRef.current ? Math.max(260, graphAreaRef.current.clientWidth - 240) : 1200;

  const renderTree = (parentId: string | null, depth: number) => {
    const children = childrenByParent.get(parentId) ?? [];
    return children.map((item) => (
      <div key={item.id}>
        <div className="flex items-center gap-1" style={{ paddingLeft: `${4 + depth * 16}px` }}>
          {(childrenByParent.get(item.id) ?? []).length > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (collapsedIds.has(item.id)) {
                  expandItem(item.id);
                } else {
                  collapseItem(item.id);
                }
              }}
              className="w-4 h-4 text-[10px] text-gray-400 hover:text-white shrink-0"
              title={collapsedIds.has(item.id) ? "Expand" : "Collapse"}
            >
              {collapsedIds.has(item.id) ? "+" : "-"}
            </button>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}

          <button
            onClick={() => selectAndReveal(item.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              selectAndReveal(item.id);
              handleNodeContextMenu(item.id, e.clientX, e.clientY);
            }}
            className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded text-sm hover:bg-gray-700 ${
              selectedItemId === item.id ? "bg-blue-800 text-blue-100" : "text-gray-300"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: `hsl(${Math.round((item.progress / 100) * 120)}, 80%, 55%)` }}
            />
            <span className="text-[10px] text-gray-500 w-10 shrink-0 uppercase">{item.type}</span>
            <span className="truncate">{item.title}</span>
          </button>
        </div>
        {!collapsedIds.has(item.id) && renderTree(item.id, depth + 1)}
      </div>
    ));
  };

  return (
    <div ref={rootRef} className="flex h-full w-full bg-gray-900 text-gray-100">
      {showSidebar && (
        <aside className="border-r border-gray-700 flex flex-col shrink-0" style={{ width: sidebarWidth }}>
          <header className="p-3 border-b border-gray-700 flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold">Research Tree</h1>
              <span className={`text-xs ${status === "ok" ? "text-green-400" : "text-red-400"}`}>
                API {status}
              </span>
            </div>
            <button
              onClick={() => setShowSidebar(false)}
              className="text-gray-500 hover:text-white text-sm"
              title="Hide items pane"
            >
              &laquo;
            </button>
          </header>

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
        </aside>
      )}

      {showSidebar && (
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

      {!showSidebar && (
        <button
          onClick={() => setShowSidebar(true)}
          className="absolute left-0 top-1/2 z-20 bg-gray-800 hover:bg-gray-700 px-1 py-8 rounded-r text-gray-400"
          title="Show items pane"
        >
          &raquo;
        </button>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-gray-700 px-4 py-1.5 text-xs text-gray-400 flex items-center gap-3 shrink-0">
          <div className="relative">
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
                </div>
              </>
            )}
          </div>

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

          {selectedItem && (
            <span className="font-medium text-gray-200 truncate">{selectedItem.title}</span>
          )}
          {!selectedItem && (
            <span>Select an item from the sidebar or graph</span>
          )}
        </header>

        <div ref={graphAreaRef} className="flex-1 flex min-h-0">
          {showGraph && (
            <div
              className="shrink-0 overflow-hidden border-r border-gray-700"
              style={{ width: showReader ? graphWidth : "100%" }}
            >
              <div
                className="w-full h-full"
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
                    hasChildrenIds={hasChildrenIds}
                    focusItemId={focusRequest.itemId}
                    focusNonce={focusRequest.nonce}
                    highlightNodeId={highlightNodeId}
                    onSelect={selectAndReveal}
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
            </div>
          )}

          {showGraph && showReader && (
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

          {showReader && (
            <div className="flex-1 flex flex-col min-w-0">
              {isScratchPad && selectedItem ? (
                <ScratchPad
                  resource={selectedItem}
                  onUpdate={updateItem}
                />
              ) : isLatex && selectedItem ? (
                <LatexView resource={selectedItem} />
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
              ) : null}

              {selectedItem && (usePdfjs || hasReader) && (
                <div className="shrink-0 border-t border-gray-700">
                  <button
                    onClick={() => setDetailExpanded((d) => !d)}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800/50"
                  >
                    {detailExpanded ? "\u25BC" : "\u25B6"} Details
                  </button>
                  {detailExpanded && (
                    <div className="overflow-y-auto max-h-64">
                      <ResourceDetail
                        resource={selectedItem}
                        onUpdate={updateItem}
                        onClose={() => selectItem(null)}
                        onSelectParent={handleSelectParent}
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
                  )}
                </div>
              )}

              {!usePdfjs && !hasReader && showDetail && (
                <div className="flex-1 overflow-y-auto">
                  <ResourceDetail
                    resource={selectedItem}
                    onUpdate={updateItem}
                    onClose={() => selectItem(null)}
                    onSelectParent={handleSelectParent}
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
              )}

              {!selectedItem && (
                <div className="flex-1 flex items-center justify-center text-gray-600">
                  {items.length === 0
                    ? 'Use Menu -> Add to add your first item'
                    : "Select an item from the sidebar or graph"}
                </div>
              )}
            </div>
          )}

          {!showGraph && !showReader && (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              All panes are hidden. Use Menu -&gt; View to show a pane.
            </div>
          )}

          {!showReader && (
            <button
              onClick={() => setShowReader(true)}
              className="bg-gray-800 hover:bg-gray-700 px-1 py-8 self-center text-gray-400 border-l border-gray-700"
              title="Show reader pane"
            >
              &laquo;
            </button>
          )}
          {showReader && (
            <button
              onClick={() => setShowReader(false)}
              className="bg-gray-800 hover:bg-gray-700 px-1 py-8 self-center text-gray-400 shrink-0 border-l border-gray-700"
              title="Hide reader pane"
            >
              &raquo;
            </button>
          )}
        </div>
      </main>

      {showAddDialog && (
        <AddItemDialog
          initialType={addInitialType}
          initialTitle={addInitialTitle}
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
                {collapsedIds.has(nodeMenu.itemId) ? (
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                    onMouseDown={() => expandItem(nodeMenu.itemId)}
                  >
                    Expand
                  </button>
                ) : (
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                    onMouseDown={() => collapseItem(nodeMenu.itemId)}
                  >
                    Collapse
                  </button>
                )}

                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                  onMouseDown={() => expandAllFromItem(nodeMenu.itemId)}
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
    </div>
  );
}

export default App;
