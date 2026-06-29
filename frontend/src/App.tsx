import { useEffect, useState, useCallback } from "react";
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
import { PDFContainer } from "./components/PDFViewer/PDFContainer";
import { ContextMenu, type MenuAction } from "./components/PDFViewer/ContextMenu";
import { SpawnDialog } from "./components/PDFViewer/SpawnDialog";

type NodeContextMenu = {
  itemId: string;
  x: number;
  y: number;
};

function App() {
  const {
    items, itemEdges,
    selectedItemId, graphVersion, selectNonce,
    setItems, setItemEdges,
    selectItem, updateItem, addItem, removeItem,
  } = useGraphStore();
  const [status, setStatus] = useState("connecting...");
  const [showSidebar, setShowSidebar] = useState(true);
  const [showReader, setShowReader] = useState(true);
  const [graphWidth, setGraphWidth] = useState(320);

  // Viewer mode
  const [viewerMode, setViewerMode] = useState<"native" | "pdfjs">("native");

  // PDF viewer state (pdfjs mode)
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);

  // Detail drawer expanded when reader is shown
  const [detailExpanded, setDetailExpanded] = useState(true);

  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [titleDialog, setTitleDialog] = useState(false);

  // Graph position for items created via background right-click
  const [addDialogPosition, setAddDialogPosition] = useState<{ graphX: number; graphY: number } | null>(null);

  // Context menu state (PDF text — pdfjs mode)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    text: string;
    page: number;
  } | null>(null);

  // Node context menu state
  const [nodeMenu, setNodeMenu] = useState<NodeContextMenu | null>(null);

  // Spawn dialog state (pdfjs mode)
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

  const selectedItem = items.find((r) => r.id === selectedItemId) ?? null;
  const hasReader = selectedItem && (selectedItem.file_path || selectedItem.source_url);

  useEffect(() => {
    if (selectedItem && (selectedItem.file_path || selectedItem.source_url) && !showReader) {
      setShowReader(true);
    }
  }, [selectNonce]);
  const hasPdf = selectedItem?.file_path != null;
  const pdfUrl = hasPdf ? `/api/items/${selectedItem!.id}/file` : null;
  const usePdfjs = hasPdf && viewerMode === "pdfjs";

  const handleTextSelect = useCallback((text: string, page: number, x: number, y: number) => {
    setContextMenu({ x, y, text, page });
  }, []);

  const handleContextAction = useCallback((action: MenuAction) => {
    setContextMenu(null);
    setSpawnAction(action);
  }, []);

  const handleNodeContextMenu = useCallback((itemId: string, x: number, y: number) => {
    setNodeMenu({ itemId, x, y });
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

  const handleBackgroundContextMenu = useCallback((_graphX: number, _graphY: number, _screenX: number, _screenY: number) => {
    setAddDialogPosition({ graphX: _graphX, graphY: _graphY });
    setShowAddDialog(true);
  }, []);

  const handleNodeDragEnd = useCallback(async (itemId: string, graphX: number, graphY: number) => {
    try {
      await api.put(`/items/${itemId}`, { graph_x: graphX, graph_y: graphY });
    } catch {
      // position save is best-effort
    }
  }, []);

  const handleAddItem = useCallback(async (data: { title: string; type: string; file_path?: string; source_url?: string }) => {
    const payload = addDialogPosition
      ? { ...data, graph_x: addDialogPosition.graphX, graph_y: addDialogPosition.graphY }
      : data;
    const item = await api.post<ItemData>("/items", payload as any);
    addItem(item);
    selectItem(item.id);
    setAddDialogPosition(null);
  }, [addItem, selectItem, addDialogPosition]);

  const handleDeleteItem = useCallback(async (itemId: string) => {
    await api.delete(`/items/${itemId}`);
    removeItem(itemId);
    setNodeMenu(null);
  }, [removeItem]);

  const showDetail = selectedItem != null && !hasReader;

  return (
    <div className="flex h-full w-full bg-gray-900 text-gray-100">
      {/* Left sidebar */}
      {showSidebar && (
        <aside className="w-64 border-r border-gray-700 flex flex-col shrink-0">
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
            >
              &laquo;
            </button>
          </header>

          <div className="p-3 border-b border-gray-700">
            <SearchBar onSelect={(id) => selectItem(id)} />
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2 px-2">
              Items
            </h3>
            <div className="flex flex-col gap-0.5">
              {items.length === 0 && (
                <p className="text-gray-500 text-sm px-2">No items yet</p>
              )}
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectItem(item.id)}
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
              ))}
            </div>
          </div>
        </aside>
      )}

      {!showSidebar && (
        <button
          onClick={() => setShowSidebar(true)}
          className="absolute left-0 top-1/2 z-10 bg-gray-800 hover:bg-gray-700 px-1 py-8 rounded-r text-gray-400"
        >
          &raquo;
        </button>
      )}

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top toolbar */}
        <header className="border-b border-gray-700 px-4 py-1.5 text-xs text-gray-400 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowAddDialog(true)}
            className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium"
          >
            + Add
          </button>

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
            </div>
          )}

          {selectedItem && (
            <span className="font-medium text-gray-200 truncate">{selectedItem.title}</span>
          )}
          {!selectedItem && (
            <span>Select an item from the sidebar or graph</span>
          )}
        </header>

        <div className="flex-1 flex min-h-0">
          {/* Graph pane — always visible */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
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
                    key={graphVersion}
                    items={items}
                    edges={itemEdges}
                    selectedId={selectedItemId}
                    onSelect={selectItem}
                    onNodeContextMenu={handleNodeContextMenu}
                    onBackgroundContextMenu={handleBackgroundContextMenu}
                    onNodeDragEnd={handleNodeDragEnd}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-600 text-xs">
                    No items yet — right-click to add one
                  </div>
                )}
              </div>
            </div>

            {/* Splitter + reader */}
            {showReader && (
              <>
                <GraphSplitter onWidthChange={setGraphWidth} />
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Reader pane */}
                  {usePdfjs && selectedItem ? (
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

                  {/* Details drawer (below reader) */}
                  {selectedItem && (usePdfjs || hasReader) && (
                    <div className="shrink-0 border-t border-gray-700">
                      <button
                        onClick={() => setDetailExpanded(d => !d)}
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
                          />
                          <div className="px-4 pb-4">
                            <BookmarkList itemId={selectedItem.id} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Detail only (no reader content) */}
                  {!usePdfjs && !hasReader && showDetail && (
                    <div className="flex-1 overflow-y-auto">
                      <ResourceDetail
                        resource={selectedItem}
                        onUpdate={updateItem}
                        onClose={() => selectItem(null)}
                      />
                      <div className="px-4 pb-4">
                        <BookmarkList itemId={selectedItem.id} />
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!selectedItem && (
                    <div className="flex-1 flex items-center justify-center text-gray-600">
                      {items.length === 0
                        ? 'Click "+ Add" to add your first item'
                        : "Select an item from the sidebar or graph"}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Reader toggle button on the right edge */}
          {!showReader && (
            <button
              onClick={() => setShowReader(true)}
              className="bg-gray-800 hover:bg-gray-700 px-1 py-8 self-center text-gray-400 border-l border-gray-700"
            >
              &laquo;
            </button>
          )}
          {showReader && (
            <button
              onClick={() => setShowReader(false)}
              className="bg-gray-800 hover:bg-gray-700 px-1 py-8 self-center text-gray-400 shrink-0 border-l border-gray-700"
            >
              &raquo;
            </button>
          )}
        </div>
      </main>

      {/* Add item dialog */}
      {showAddDialog && (
        <AddItemDialog
          onSubmit={handleAddItem}
          onClose={() => { setShowAddDialog(false); setAddDialogPosition(null); }}
        />
      )}

      {/* PDF context menu (pdfjs mode) */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x || 100}
          y={contextMenu.y || 100}
          selectedText={contextMenu.text}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Spawn dialog (pdfjs mode) */}
      {spawnAction && contextMenu && (
        <SpawnDialog
          action={spawnAction}
          selectedText={contextMenu.text}
          currentPage={contextMenu.page}
          currentItemId={selectedItemId}
          onSubmit={handleSpawn}
          onClose={() => setSpawnAction(null)}
        />
      )}

      {/* Node context menu */}
      {nodeMenu && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setNodeMenu(null)} />
          <div
            className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-40"
            style={{ left: nodeMenu.x, top: nodeMenu.y }}
            onContextMenu={(e) => e.preventDefault()}
          >
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
            onMouseDown={() => {
              selectItem(nodeMenu.itemId);
              setShowReader(true);
              setNodeMenu(null);
            }}
          >
            Open
          </button>
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
            onMouseDown={() => {
              setTitleDialog(true);
            }}
          >
            Change title
          </button>
          <div className="border-t border-gray-700 my-1" />
          <button
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700"
            onMouseDown={() => handleDeleteItem(nodeMenu.itemId)}
          >
            Delete
          </button>
        </div>
        </>
      )}

      {/* Title dialog */}
      {titleDialog && nodeMenu && (
        <TitleDialog
          currentTitle={items.find((i) => i.id === nodeMenu.itemId)?.title ?? ""}
          onSubmit={handleTitleChange}
          onClose={() => { setTitleDialog(false); setNodeMenu(null); }}
        />
      )}
    </div>
  );
}

export default App;
