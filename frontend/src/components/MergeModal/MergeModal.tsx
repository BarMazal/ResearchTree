import { useState, useEffect } from "react";
import { api } from "../../api/client";
import type { ItemData } from "../../store/useGraphStore";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: ItemData[];
  initialPrimaryId?: string;
  onMergeSuccess: (primaryItem: ItemData) => void;
};

export function MergeModal({ isOpen, onClose, selectedItems, initialPrimaryId, onMergeSuccess }: Props) {
  const [primaryId, setPrimaryId] = useState<string>("");
  const [isMerging, setIsMerging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (selectedItems.length > 0) {
      if (initialPrimaryId && selectedItems.some((i) => i.id === initialPrimaryId)) {
        setPrimaryId(initialPrimaryId);
      } else {
        setPrimaryId(selectedItems[0].id);
      }
    }
  }, [selectedItems, initialPrimaryId, isOpen]);


  if (!isOpen || selectedItems.length < 2) return null;

  const primaryItem = selectedItems.find((i) => i.id === primaryId) || selectedItems[0];
  const secondaryItems = selectedItems.filter((i) => i.id !== primaryId);

  const handleExecuteMerge = async () => {
    if (!primaryItem || secondaryItems.length === 0 || isMerging) return;
    setIsMerging(true);
    setErrorMsg(null);

    try {
      const res = await api.post<ItemData>("/items/merge", {
        primary_id: primaryItem.id,
        secondary_ids: secondaryItems.map((i) => i.id),
      });

      onMergeSuccess(res);
      onClose();
    } catch (err: any) {
      console.error("Merge error:", err);
      setErrorMsg(String(err?.message || err));
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gray-850 border border-purple-600/80 rounded-xl shadow-2xl max-w-xl w-full p-5 space-y-4 text-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔀</span>
            <h3 className="text-base font-bold text-gray-100">Merge Duplicate Items</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isMerging}
            className="text-gray-400 hover:text-gray-200 text-sm p-1 rounded"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed">
          Select which item should be kept as the <strong>Primary Item</strong>. Notes, graph connections, bookmarks, and tags from the secondary items will be merged into the primary node. Secondary items will be safely archived.
        </p>

        {/* Primary Selection List */}
        <div className="space-y-2 border border-gray-700 rounded-lg p-3 bg-gray-900/60 max-h-60 overflow-y-auto">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Select Primary Item to Keep ({selectedItems.length} selected):
          </h4>
          {selectedItems.map((item) => {
            const isPrimary = item.id === primaryItem.id;
            return (
              <label
                key={item.id}
                onClick={() => setPrimaryId(item.id)}
                className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  isPrimary
                    ? "bg-purple-950/70 border-purple-500 text-purple-100"
                    : "bg-gray-900/40 border-gray-800 text-gray-300 hover:bg-gray-800/60"
                }`}
              >
                <input
                  type="radio"
                  name="primary_item_radio"
                  checked={isPrimary}
                  onChange={() => setPrimaryId(item.id)}
                  className="mt-1 accent-purple-500"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs truncate" title={item.title}>
                      {item.title}
                    </span>
                    {isPrimary ? (
                      <span className="bg-purple-700 text-purple-100 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                        Primary Keep Node
                      </span>
                    ) : (
                      <span className="bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded font-mono shrink-0">
                        Will Merge & Archive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 font-mono">
                    <span>Type: {item.type}</span>
                    {item.source_url && (
                      <span className="truncate max-w-[200px]" title={item.source_url}>
                        URL: {item.source_url}
                      </span>
                    )}
                    {item.file_path && (
                      <span className="truncate max-w-[200px]" title={item.file_path}>
                        File: {item.file_path}
                      </span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="bg-red-950/60 border border-red-800/80 rounded p-2.5 text-xs text-red-200">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-gray-700 pt-3">
          <span className="text-[11px] text-gray-400 italic">
            This merge operation is soft-archived and preserves all original data.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isMerging}
              className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteMerge}
              disabled={isMerging || !primaryItem}
              className="px-4 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-bold rounded shadow transition-colors flex items-center gap-1.5"
            >
              {isMerging ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Merging Items...
                </>
              ) : (
                `🔀 Merge ${secondaryItems.length} Item${secondaryItems.length > 1 ? "s" : ""} into Primary`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
