import { useState, useEffect, useRef } from "react";
import { api } from "../../api/client";

export type CollectionMeta = {
  name: string;
  is_active: boolean;
  item_count: number;
  file_count: number;
  size_bytes: number;
  created_at?: string;
};

type Props = {
  onCollectionSwitched: () => void;
  selectedItemId?: string | null;
};

export function CollectionSelector({ onCollectionSwitched, selectedItemId }: Props) {
  const [activeCollection, setActiveCollection] = useState<string>("Default");
  const [collections, setCollections] = useState<CollectionMeta[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [copyTargetCollection, setCopyTargetCollection] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCollections = async () => {
    try {
      const data = await api.get<{ active: string; collections: CollectionMeta[] }>("/collections");
      setActiveCollection(data.active);
      setCollections(data.collections);
    } catch (e) {
      console.error("Failed to fetch collections:", e);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleSwitchCollection = async (name: string) => {
    if (name === activeCollection) return;
    setLoading(true);
    setDropdownOpen(false);
    try {
      await api.post("/collections/switch", { name });
      setActiveCollection(name);
      await fetchCollections();
      onCollectionSwitched();
    } catch (e: any) {
      alert("Failed to switch collection: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    setLoading(true);
    try {
      const res = await api.post<{ name: string; is_active: boolean }>("/collections/create", {
        name: newCollectionName.trim(),
      });
      setNewCollectionName("");
      setShowCreateModal(false);
      setActiveCollection(res.name);
      await fetchCollections();
      onCollectionSwitched();
    } catch (e: any) {
      alert("Failed to create collection: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleExportCollection = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/api/collections/export/${encodeURIComponent(name)}`, "_blank");
  };

  const handleImportBundle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setStatusMsg("Importing collection bundle...");

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/collections/import", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setStatusMsg(`Successfully imported '${data.name}'!`);
      await fetchCollections();
      await handleSwitchCollection(data.name);
    } catch (err: any) {
      alert("Import failed: " + String(err));
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleCopySubtree = async () => {
    if (!selectedItemId || !copyTargetCollection) return;
    setLoading(true);
    try {
      const res = await api.post<{ copied_count: number; target_collection: string }>("/collections/copy-subtree", {
        item_id: selectedItemId,
        target_collection: copyTargetCollection,
      });
      alert(`Successfully deep-copied item & sub-tree (${res.copied_count} items & files) to collection '${res.target_collection}'!`);
      setShowCopyModal(false);
      await fetchCollections();
    } catch (err: any) {
      alert("Deep copy failed: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="relative flex items-center">
      {/* Hidden File Input for Bundle Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".rtree,.zip"
        className="hidden"
        onChange={handleImportBundle}
      />

      {/* Trigger Button */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        disabled={loading}
        className="bg-purple-950/80 hover:bg-purple-900 border border-purple-700/80 text-purple-200 px-3 py-1 rounded text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
        title="Active Collection Context"
      >
        <span className="text-sm">📚</span>
        <span className="truncate max-w-36 font-mono">{activeCollection}</span>
        <span className="text-[10px] text-purple-400">▼</span>
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-2 text-xs text-gray-100 flex flex-col gap-2">
            <div className="px-2 py-1 flex items-center justify-between border-b border-gray-800">
              <span className="font-bold text-gray-300 uppercase tracking-wider text-[10px]">
                Switch Collection
              </span>
              <button
                onClick={() => { setDropdownOpen(false); setShowCreateModal(true); }}
                className="text-purple-400 hover:text-purple-300 font-bold hover:underline text-[11px]"
              >
                + New
              </button>
            </div>

            {/* Collection List */}
            <div className="max-h-56 overflow-y-auto space-y-1">
              {collections.map((col) => (
                <div
                  key={col.name}
                  onClick={() => handleSwitchCollection(col.name)}
                  className={`p-2 rounded-lg cursor-pointer flex items-center justify-between border transition-all ${
                    col.is_active
                      ? "bg-purple-950/60 border-purple-600 text-purple-200 font-bold"
                      : "bg-gray-850/50 border-gray-800 hover:bg-gray-800 text-gray-300"
                  }`}
                >
                  <div className="flex flex-col gap-0.5 truncate pr-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span>{col.is_active ? "★" : "📁"}</span>
                      <span className="truncate">{col.name}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-normal">
                      {col.item_count} items &bull; {col.file_count} files ({formatSize(col.size_bytes)})
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleExportCollection(col.name, e)}
                    className="p-1 text-gray-400 hover:text-purple-300 rounded hover:bg-gray-700 shrink-0"
                    title="Export / Bundle Collection (.rtree)"
                  >
                    📦
                  </button>
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="pt-2 border-t border-gray-800 flex items-center justify-between gap-2">
              <button
                onClick={() => { setDropdownOpen(false); fileInputRef.current?.click(); }}
                className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-750 text-gray-200 rounded text-[11px] font-semibold border border-gray-700 flex items-center justify-center gap-1"
              >
                <span>📥 Import Bundle</span>
              </button>
              {selectedItemId && (
                <button
                  onClick={() => { setDropdownOpen(false); setShowCopyModal(true); }}
                  className="flex-1 py-1.5 bg-blue-900/60 hover:bg-blue-800 text-blue-200 rounded text-[11px] font-semibold border border-blue-700 flex items-center justify-center gap-1"
                  title="Deep copy selected item to another collection"
                >
                  <span>📋 Copy Subtree</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create New Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 shadow-2xl w-full max-w-md space-y-4">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <span>📚 Create New Collection</span>
            </h3>
            <div className="space-y-1">
              <label className="text-xs text-gray-400 block">Collection Name</label>
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g. Machine Learning, Work, Hobbies..."
                className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-purple-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 text-xs rounded text-gray-400 hover:bg-gray-800 border border-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCollection}
                disabled={!newCollectionName.trim() || loading}
                className="px-4 py-1.5 text-xs font-bold rounded bg-purple-700 hover:bg-purple-600 text-white transition-colors"
              >
                Create Collection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deep Copy Subtree Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 shadow-2xl w-full max-w-md space-y-4">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <span>📋 Deep Copy Item Subtree to Collection</span>
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              This will recursively copy the selected item, its PDF files, notes, bookmarks, and child subtree into the target collection.
            </p>
            <div className="space-y-1">
              <label className="text-xs text-gray-400 block">Target Collection</label>
              <select
                value={copyTargetCollection}
                onChange={(e) => setCopyTargetCollection(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-purple-500"
              >
                <option value="">-- Select Target Collection --</option>
                {collections.filter(c => c.name !== activeCollection).map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCopyModal(false)}
                className="px-3 py-1.5 text-xs rounded text-gray-400 hover:bg-gray-800 border border-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCopySubtree}
                disabled={!copyTargetCollection || loading}
                className="px-4 py-1.5 text-xs font-bold rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors"
              >
                Deep Copy Subtree
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status toast message */}
      {statusMsg && (
        <div className="fixed bottom-4 right-4 z-[100] bg-purple-950 border border-purple-600 text-purple-200 px-4 py-2 rounded-lg shadow-xl text-xs font-mono">
          {statusMsg}
        </div>
      )}
    </div>
  );
}
