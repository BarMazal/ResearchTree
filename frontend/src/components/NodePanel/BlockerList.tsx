import React, { useState } from "react";
import { ItemData, useGraphStore } from "../../store/useGraphStore";
import { api } from "../../api/client";

interface BlockerListProps {
  currentItem: ItemData;
  onSelectBlocker?: (blockerId: string) => void;
}

export const BlockerList: React.FC<BlockerListProps> = ({ currentItem, onSelectBlocker }) => {
  const items = useGraphStore((st) => st.items);
  const itemEdges = useGraphStore((st) => st.itemEdges);
  const updateItem = useGraphStore((st) => st.updateItem);
  const selectItem = useGraphStore((st) => st.selectItem);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  // Find all items that currentItem is "waiting on"
  // 1. Via itemEdges relationship === "waiting_on"
  // 2. Or child items of currentItem that have a blocker_reason or flag === "stuck"
  const waitingOnEdges = itemEdges.filter(
    (e) => e.source_item_id === currentItem.id && e.relationship === "waiting_on"
  );
  const edgeTargetIds = new Set(waitingOnEdges.map((e) => e.target_item_id));

  const blockerItems = items.filter(
    (i) => edgeTargetIds.has(i.id) || (i.parent_item_id === currentItem.id && (i.blocker_reason != null || (i.flags && i.flags.includes("stuck"))))
  );

  const unresolvedBlockers = blockerItems.filter((i) => !i.is_resolved);
  const resolvedBlockers = blockerItems.filter((i) => i.is_resolved);

  const handleToggleResolve = async (item: ItemData) => {
    if (!item.is_resolved) {
      // Prompt for resolution note
      setResolvingId(item.id);
      setResolutionNote(item.resolution_note || "");
    } else {
      // Un-resolve
      const updatedDate = new Date().toISOString();
      updateItem(item.id, { is_resolved: false, last_accessed_at: updatedDate });
      try {
        await api.put(`/items/${item.id}`, { is_resolved: false });
      } catch (err) {
        console.error("Failed to un-resolve item:", err);
      }
    }
  };

  const submitResolution = async () => {
    if (!resolvingId) return;
    const updatedDate = new Date().toISOString();
    const note = resolutionNote.trim() || null;
    updateItem(resolvingId, { is_resolved: true, resolution_note: note, last_accessed_at: updatedDate });
    try {
      await api.put(`/items/${resolvingId}`, { is_resolved: true, resolution_note: note });
    } catch (err) {
      console.error("Failed to save resolution note:", err);
    } finally {
      setResolvingId(null);
      setResolutionNote("");
    }
  };

  // Check if currentItem itself is a blocker note or target of a waiting_on relationship
  const waitingOnSources = itemEdges.filter(
    (e) => e.target_item_id === currentItem.id && e.relationship === "waiting_on"
  );
  const blockedParentItems = items.filter((i) =>
    waitingOnSources.some((e) => e.source_item_id === i.id)
  );

  const isCurrentABlocker =
    currentItem.blocker_reason != null ||
    (currentItem.flags && currentItem.flags.includes("stuck")) ||
    waitingOnSources.length > 0;

  if (blockerItems.length === 0 && !isCurrentABlocker) {
    return null;
  }

  return (
    <div className="space-y-3 mt-2">
      {/* Self-Blocker Banner if current item is a blocker note */}
      {isCurrentABlocker && (
        <div className={`p-3 rounded-xl border shadow-lg space-y-2 transition-all ${
          currentItem.is_resolved
            ? "bg-emerald-950/40 border-emerald-700/80 text-emerald-200"
            : "bg-amber-950/60 border-amber-500 text-amber-100 animate-pulse"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">{currentItem.is_resolved ? "✅" : "⏳"}</span>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {currentItem.is_resolved ? "Prerequisite Resolved" : "Active Prerequisite Blocker"}
                </div>
                <div className="text-[11px] opacity-80">
                  {currentItem.is_resolved
                    ? "Knowledge gap has been fulfilled"
                    : blockedParentItems.length > 0
                    ? `Blocking progress on: ${blockedParentItems.map((b) => `"${b.title}"`).join(", ")}`
                    : "This node is blocking parent research progress"}
                </div>
              </div>
            </div>
            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/30 border border-amber-400/40 cursor-pointer hover:bg-black/50">
              <input
                type="checkbox"
                checked={currentItem.is_resolved || false}
                onChange={() => handleToggleResolve(currentItem)}
                className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
              />
              <span className="text-xs font-bold">{currentItem.is_resolved ? "Resolved" : "Mark Resolved"}</span>
            </label>
          </div>

          {currentItem.blocker_reason && (
            <div className="bg-black/40 p-2 rounded-lg border border-white/10 text-xs">
              <span className="font-semibold text-amber-300 block mb-0.5">Reason for Waiting:</span>
              <p className="italic text-slate-200">{currentItem.blocker_reason}</p>
            </div>
          )}

          {currentItem.is_resolved && currentItem.resolution_note && (
            <div className="bg-emerald-900/40 p-2 rounded-lg border border-emerald-600/40 text-xs">
              <span className="font-semibold text-emerald-300 block mb-0.5">Resolution Key Takeaway:</span>
              <p className="text-emerald-100">{currentItem.resolution_note}</p>
            </div>
          )}
        </div>
      )}

      {/* Unresolved Blockers Warning Banner */}
      {unresolvedBlockers.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/90 via-red-950/80 to-slate-900 border-2 border-amber-500 rounded-xl p-3 shadow-xl space-y-2">
          <div className="flex items-center justify-between border-b border-amber-800/60 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-lg animate-bounce">⚠️</span>
              <div>
                <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wide">
                  Blocked: Waiting On {unresolvedBlockers.length} Prerequisite{unresolvedBlockers.length > 1 ? "s" : ""}
                </div>
                <div className="text-[10px] text-amber-200/70">
                  Must fulfill these concepts to proceed with confidence
                </div>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40">
              {unresolvedBlockers.length} Pending
            </span>
          </div>

          <div className="space-y-2">
            {unresolvedBlockers.map((b) => (
              <div
                key={b.id}
                className="bg-slate-900/90 border border-amber-600/70 rounded-lg p-2.5 space-y-1.5 shadow-md hover:border-amber-400 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => (onSelectBlocker ? onSelectBlocker(b.id) : selectItem(b.id))}
                    className="font-semibold text-xs text-amber-200 hover:text-white hover:underline text-left flex items-center gap-1.5"
                  >
                    <span>⏳</span>
                    <span className="line-clamp-1">{b.title}</span>
                  </button>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/80 px-2 py-0.5 rounded cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={b.is_resolved || false}
                      onChange={() => handleToggleResolve(b)}
                      className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                    />
                    <span>Resolve</span>
                  </label>
                </div>

                {b.blocker_reason && (
                  <p className="text-[11px] text-slate-300 italic bg-slate-950/60 p-1.5 rounded border border-slate-800">
                    &ldquo;{b.blocker_reason}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved Blockers List */}
      {resolvedBlockers.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>✅ Resolved Prerequisites ({resolvedBlockers.length})</span>
          </div>
          <div className="space-y-1.5">
            {resolvedBlockers.map((b) => (
              <div key={b.id} className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => (onSelectBlocker ? onSelectBlocker(b.id) : selectItem(b.id))}
                    className="font-medium text-emerald-300 hover:underline text-left flex items-center gap-1.5"
                  >
                    <span>✓</span>
                    <span className="line-clamp-1">{b.title}</span>
                  </button>
                  <button
                    onClick={() => handleToggleResolve(b)}
                    className="text-[10px] text-slate-500 hover:text-slate-300 underline"
                  >
                    Un-resolve
                  </button>
                </div>
                {b.resolution_note && (
                  <p className="text-[11px] text-emerald-200/80 bg-emerald-950/30 p-1.5 rounded border border-emerald-900/40">
                    Takeaway: {b.resolution_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Resolution Note Modal */}
      {resolvingId && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/80 rounded-xl shadow-2xl max-w-md w-full p-4 space-y-3 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <span>✅ Resolve Prerequisite Blocker</span>
              </h4>
              <button
                onClick={() => setResolvingId(null)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Resolution Key Takeaway / Solution Notes:
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={3}
                placeholder="Explain how this issue was resolved or what key understanding unblocked you..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setResolvingId(null)}
                className="px-3 py-1.5 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={submitResolution}
                className="px-4 py-1.5 rounded text-xs bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow"
              >
                Confirm Resolution ✅
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
