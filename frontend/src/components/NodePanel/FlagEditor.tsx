import React from "react";
import { api } from "../../api/client";
import { ItemData, useGraphStore } from "../../store/useGraphStore";

export type FlagType = "prime" | "foundation" | "core_branch" | "sibling" | "milestone" | "backlog" | "stuck";

export interface FlagDef {
  id: FlagType;
  emoji: string;
  label: string;
  color: string;
  bg: string;
  glow: string;
  description: string;
}

export const FLAG_DEFINITIONS: Record<FlagType, FlagDef> = {
  prime: {
    id: "prime",
    emoji: "👑",
    label: "Prime Node",
    color: "#eab308",
    bg: "#713f12",
    glow: "rgba(234, 179, 8, 0.8)",
    description: "Prime root node of a research tree or wood",
  },
  foundation: {
    id: "foundation",
    emoji: "🏛️",
    label: "Foundational Paper",
    color: "#f59e0b",
    bg: "#78350f",
    glow: "rgba(245, 158, 11, 0.6)",
    description: "Seminal paper, root background knowledge, or core theory",
  },
  core_branch: {
    id: "core_branch",
    emoji: "🌳",
    label: "Deep Dive Branch",
    color: "#10b981",
    bg: "#064e3b",
    glow: "rgba(16, 185, 129, 0.6)",
    description: "Primary deep-dive research lineage or focal study path",
  },
  sibling: {
    id: "sibling",
    emoji: "🔀",
    label: "Sibling / Alternate",
    color: "#3b82f6",
    bg: "#1e3a8a",
    glow: "rgba(59, 130, 246, 0.6)",
    description: "Parallel concept, baseline model, or alternative approach",
  },
  milestone: {
    id: "milestone",
    emoji: "🎯",
    label: "Key Milestone",
    color: "#ec4899",
    bg: "#831843",
    glow: "rgba(236, 72, 153, 0.6)",
    description: "Target item, breakthrough result, or synthesis goal",
  },
  backlog: {
    id: "backlog",
    emoji: "⏳",
    label: "Reading Backlog",
    color: "#8b5cf6",
    bg: "#4c1d95",
    glow: "rgba(139, 92, 246, 0.6)",
    description: "Queued for later reading or deferred deep-dive",
  },
  stuck: {
    id: "stuck",
    emoji: "🔴",
    label: "Stuck / Context Gap",
    color: "#ef4444",
    bg: "#7f1d1d",
    glow: "rgba(239, 68, 68, 0.6)",
    description: "Blocker, uncomprehended math/code, or missing background",
  },
};

interface FlagEditorProps {
  itemId: string;
  flags?: string[];
  isLocal?: boolean;
}

export const FlagEditor: React.FC<FlagEditorProps> = ({ itemId, flags = [], isLocal = false }) => {
  const updateItem = useGraphStore((st) => st.updateItem);

  const toggleScope = async () => {
    const nextLocal = !isLocal;
    const updatedDate = new Date().toISOString();
    updateItem(itemId, { is_local: nextLocal, last_accessed_at: updatedDate });
    try {
      await api.put<ItemData>(`/items/${itemId}`, { is_local: nextLocal });
    } catch (err) {
      console.error("Failed to save item is_local:", err);
    }
  };

  const saveFlags = async (newFlags: string[]) => {
    const updatedDate = new Date().toISOString();
    updateItem(itemId, { flags: newFlags, last_accessed_at: updatedDate });
    try {
      await api.put<ItemData>(`/items/${itemId}`, { flags: newFlags });
    } catch (err) {
      console.error("Failed to save item flags:", err);
    }
  };

  const toggleFlag = (flagId: FlagType) => {
    let next: string[];
    if (flags.includes(flagId)) {
      next = flags.filter((f) => f !== flagId);
    } else {
      next = [...flags, flagId];
    }
    saveFlags(next);
  };

  const setAsPrimary = (flagId: string) => {
    if (!flags.includes(flagId)) return;
    const filtered = flags.filter((f) => f !== flagId);
    const next = [flagId, ...filtered];
    saveFlags(next);
  };

  return (
    <div className="space-y-2.5">
      {/* Node Scope Toggle */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-sm">{isLocal ? "📍" : "🚀"}</span>
          <div>
            <div className="text-xs font-semibold text-slate-200">
              {isLocal ? "Local Tethered Note" : "Global Research Item"}
            </div>
            <div className="text-[10px] text-slate-400">
              {isLocal
                ? "Compact scale (r=10), tethered closely to parent node"
                : "Full scale (r=16), unleashed force simulation"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleScope}
          className={`px-2.5 py-1 rounded text-xs font-bold transition-all border ${
            isLocal
              ? "bg-emerald-950 border-emerald-500/80 text-emerald-200 hover:bg-emerald-900"
              : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {isLocal ? "🚀 Promote to Global" : "📍 Demote to Local"}
        </button>
      </div>

      <div className="flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider">
        <span>Research Role Flags</span>
        {flags.length > 0 && (
          <span className="text-[10px] text-emerald-400 font-normal">
            Primary: {FLAG_DEFINITIONS[flags[0] as FlagType]?.emoji}{" "}
            {FLAG_DEFINITIONS[flags[0] as FlagType]?.label || flags[0]}
          </span>
        )}
      </div>

      {/* Active flags list with numbering */}
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900/60 rounded-lg border border-slate-700/60">
          {flags.map((flagId, idx) => {
            const def = FLAG_DEFINITIONS[flagId as FlagType];
            if (!def) return null;
            const isPrimary = idx === 0;
            return (
              <div
                key={flagId}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border shadow-sm transition-all"
                style={{
                  backgroundColor: def.bg + "cc",
                  borderColor: def.color,
                  color: "#f8fafc",
                }}
              >
                <span className="font-bold text-[11px] opacity-90">{def.emoji}{idx + 1}</span>
                <span>{def.label}</span>
                {!isPrimary && (
                  <button
                    onClick={() => setAsPrimary(flagId)}
                    title="Promote to Primary Flag"
                    className="ml-1 text-[10px] bg-slate-800/80 hover:bg-slate-700 px-1 rounded text-amber-300"
                  >
                    ★ Top
                  </button>
                )}
                <button
                  onClick={() => toggleFlag(flagId as FlagType)}
                  className="ml-1 text-slate-300 hover:text-red-400 font-bold"
                  title="Remove flag"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Select / toggle options */}
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(FLAG_DEFINITIONS) as FlagType[]).map((key) => {
          const def = FLAG_DEFINITIONS[key];
          const isSelected = flags.includes(key);
          const flagIdx = flags.indexOf(key);

          return (
            <button
              key={key}
              onClick={() => toggleFlag(key)}
              title={def.description}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-all ${
                isSelected
                  ? "border-emerald-500/80 bg-emerald-950/40 text-emerald-200"
                  : "border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-sm">{def.emoji}</span>
                <span className="truncate">{def.label}</span>
              </div>
              {isSelected && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                  style={{ backgroundColor: def.bg, color: def.color }}
                >
                  #{flagIdx + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
