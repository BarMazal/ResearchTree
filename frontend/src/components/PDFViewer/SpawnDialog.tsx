import { useState } from "react";
import type { MenuAction } from "./ContextMenu";
import { FLAG_DEFINITIONS, FlagType } from "../NodePanel/FlagEditor";

type Props = {
  action: MenuAction;
  selectedText: string;
  currentPage: number;
  currentItemId: string | null;
  onSubmit: (data: {
    title: string;
    type: string;
    summary?: string;
    parent_item_id?: string | null;
    is_local?: boolean;
    flags?: string[];
    blocker_reason?: string;
  }) => void;
  onClose: () => void;
};

export function SpawnDialog({
  action,
  selectedText,
  currentPage,
  currentItemId,
  onSubmit,
  onClose,
}: Props) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [blockerReason, setBlockerReason] = useState("");
  const [isLocal, setIsLocal] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<FlagType | "">("");

  const dialogConfig = () => {
    switch (action.type) {
      case "spawn_waiting_on":
        return {
          title: "⏳ Spawn Waiting On... (Blocker)",
          fields: (
            <>
              <div className="p-2 bg-amber-950/40 border border-amber-800/80 rounded-lg text-xs space-y-1">
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  <span>⚠️ Prerequisite Knowledge Blocker</span>
                </span>
                <p className="text-slate-300 italic truncate">&ldquo;{selectedText}&rdquo;</p>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Item Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Prerequisite: ${selectedText.slice(0, 40)}...`}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-500 text-slate-100"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-amber-400 font-bold block mb-1 flex items-center justify-between">
                  <span>Reason for Waiting On this Item</span>
                  <span className="text-[10px] text-amber-400/80 font-normal">What concept / math is blocking you?</span>
                </label>
                <textarea
                  value={blockerReason}
                  onChange={(e) => setBlockerReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Need to understand how energy minimization is performed iteratively in predictive coding without global error backpropagation..."
                  className="w-full bg-slate-900 border border-amber-600/80 rounded-lg p-2 text-xs text-amber-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-sans"
                />
              </div>

              {/* Node Scope Selector */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">
                  Node Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLocal(true)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                      isLocal
                        ? "border-amber-500 bg-amber-950/60 text-amber-200 font-bold"
                        : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-700/60"
                    }`}
                  >
                    <span>📍 Tethered Note</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLocal(false)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                      !isLocal
                        ? "border-emerald-500 bg-emerald-950/60 text-emerald-200 font-bold"
                        : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-700/60"
                    }`}
                  >
                    <span>🚀 Global Item</span>
                  </button>
                </div>
              </div>
            </>
          ),
          onSubmit: () =>
            onSubmit({
              title: title.trim() || `Blocker: ${selectedText.slice(0, 50)}`,
              type: "note",
              summary: selectedText,
              parent_item_id: currentItemId,
              is_local: isLocal,
              flags: selectedFlag ? [selectedFlag] : ["stuck"],
              blocker_reason: blockerReason.trim() || undefined,
            }),
        };

      case "bookmark":
        return {
          title: "Bookmark",
          fields: (
            <>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Quote</label>
                <p className="text-sm text-gray-300 italic bg-gray-800 rounded px-2 py-1">
                  &ldquo;{selectedText}&rdquo;
                </p>
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                autoFocus
              />
            </>
          ),
          onSubmit: () => onSubmit({ title: `Bookmark p.${currentPage}`, type: "bookmark" }),
        };

      case "spawn_branch":
      case "spawn_notebook":
      case "spawn_llm_summary":
        const typeName =
          action.type === "spawn_notebook"
            ? "NotebookLM"
            : action.type === "spawn_llm_summary"
            ? "LLM Summary"
            : "Child Note";

        return {
          title: `Spawn ${typeName}`,
          fields: (
            <>
              <p className="text-xs text-gray-400 mb-2">
                Branching from: &ldquo;{selectedText.slice(0, 60)}...&rdquo;
              </p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${typeName} title...`}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                autoFocus
              />

              {/* Node Scope / Scale Selector */}
              <div className="mt-2 space-y-1">
                <label className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">
                  Node Scope & Scale
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLocal(true)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                      isLocal
                        ? "border-amber-500 bg-amber-950/60 text-amber-200 font-bold"
                        : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-700/60"
                    }`}
                  >
                    <span>📍 Local Note</span>
                    <span className="text-[10px] opacity-75">(Tethered)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLocal(false)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                      !isLocal
                        ? "border-emerald-500 bg-emerald-950/60 text-emerald-200 font-bold"
                        : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-700/60"
                    }`}
                  >
                    <span>🚀 Global Item</span>
                    <span className="text-[10px] opacity-75">(Full Node)</span>
                  </button>
                </div>
              </div>

              {/* Assign Initial Role Flag (If Global) */}
              {!isLocal && (
                <div className="mt-2 space-y-1">
                  <label className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">
                    Assign Role Flag (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(FLAG_DEFINITIONS) as FlagType[]).map((flagKey) => {
                      const def = FLAG_DEFINITIONS[flagKey];
                      const isSel = selectedFlag === flagKey;
                      return (
                        <button
                          key={flagKey}
                          type="button"
                          onClick={() => setSelectedFlag(isSel ? "" : flagKey)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border text-left transition-all ${
                            isSel
                              ? "border-emerald-500 bg-emerald-950/80 text-emerald-200 font-bold"
                              : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800"
                          }`}
                        >
                          <span>{def.emoji}</span>
                          <span className="truncate">{def.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ),
          onSubmit: () =>
            onSubmit({
              title:
                title ||
                (action.type === "spawn_notebook"
                  ? `Notebook: ${selectedText.slice(0, 30)}`
                  : action.type === "spawn_llm_summary"
                  ? `Summary: ${selectedText.slice(0, 30)}`
                  : selectedText.slice(0, 80)),
              type:
                action.type === "spawn_notebook"
                  ? "notebook"
                  : action.type === "spawn_llm_summary"
                  ? "llm-summary"
                  : "note",
              parent_item_id: currentItemId,
              is_local: isLocal,
              flags: selectedFlag ? [selectedFlag] : [],
            }),
        };

      case "mark_progress":
        return {
          title: "Mark Progress",
          fields: (
            <p className="text-sm text-gray-300">
              Set item progress to page <strong>{currentPage}</strong>?
            </p>
          ),
          onSubmit: () =>
            onSubmit({ title: `Progress p.${currentPage}`, type: "progress" }),
        };
    }
  };

  const config = dialogConfig();

  if (!config) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-96 p-4 text-slate-100">
        <h3 className="text-base font-semibold mb-3">{config.title}</h3>
        <div className="flex flex-col gap-3">{config.fields}</div>
        <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              config.onSubmit();
              onClose();
            }}
            className="px-3.5 py-1.5 rounded text-sm bg-emerald-600 hover:bg-emerald-500 font-semibold text-white shadow"
          >
            Confirm & Spawn
          </button>
        </div>
      </div>
    </div>
  );
}
