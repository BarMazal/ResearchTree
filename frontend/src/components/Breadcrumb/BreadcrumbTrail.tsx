import React from "react";
import { ItemData, useGraphStore } from "../../store/useGraphStore";
import { FLAG_DEFINITIONS, FlagType } from "../NodePanel/FlagEditor";

interface BreadcrumbTrailProps {
  currentItem: ItemData;
}

export function formatRelativeTime(isoString?: string | null): { text: string; isStale: boolean } {
  if (!isoString) return { text: "Never", isStale: true };
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return { text: "Unknown", isStale: false };

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const isStale = diffDays >= 7;

  if (diffMs < 60 * 1000) return { text: "Just now", isStale };
  if (diffMs < 60 * 60 * 1000) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return { text: `${mins}m ago`, isStale };
  }
  if (diffMs < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    return { text: `${hours}h ago`, isStale };
  }
  const days = Math.floor(diffDays);
  return { text: `${days}d ago`, isStale };
}

export const BreadcrumbTrail: React.FC<BreadcrumbTrailProps> = ({ currentItem }) => {
  const items = useGraphStore((st) => st.items);
  const selectItem = useGraphStore((st) => st.selectItem);

  // Build ancestor path from Root to currentItem
  const ancestors: ItemData[] = [];
  const visited = new Set<string>();
  let curr: ItemData | undefined = currentItem;

  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    ancestors.unshift(curr);
    if (curr.parent_item_id) {
      curr = items.find((i) => i.id === curr?.parent_item_id);
    } else {
      break;
    }
  }

  if (ancestors.length === 0) return null;

  return (
    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 shadow-inner space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
        <span>📍 Research Trajectory</span>
        <span className="text-[10px] text-slate-500 font-normal">
          {ancestors.length} step{ancestors.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        {ancestors.map((item, idx) => {
          const isCurrent = item.id === currentItem.id;
          const primaryFlag = item.flags && item.flags.length > 0 ? (item.flags[0] as FlagType) : null;
          const flagDef = primaryFlag ? FLAG_DEFINITIONS[primaryFlag] : null;

          // Time formatting & stale check based on last_accessed_at or updated_at
          const timeRef = item.last_accessed_at || item.updated_at;
          const { text: timeText, isStale } = formatRelativeTime(timeRef);

          return (
            <React.Fragment key={item.id}>
              {idx > 0 && <span className="text-slate-600 font-bold">➔</span>}
              <button
                onClick={() => selectItem(item.id)}
                title={`${item.title} (Updated/Accessed: ${timeText})`}
                className={`group flex items-center gap-1 px-2 py-1 rounded-md transition-all border ${
                  isCurrent
                    ? "bg-emerald-950/70 border-emerald-500/80 text-emerald-200 font-semibold shadow-sm"
                    : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700 hover:text-slate-100"
                }`}
              >
                {/* Flag emoji or default icon */}
                <span className="text-sm">
                  {flagDef ? flagDef.emoji : isCurrent ? "🎯" : "📄"}
                </span>

                <span className="max-w-[120px] truncate">{item.title}</span>

                {/* Timestamp badge */}
                <span className="text-[10px] text-slate-400 font-mono ml-0.5 opacity-80 group-hover:opacity-100">
                  {timeText}
                </span>

                {/* Red Flag warning for Stale (>7d) */}
                {isStale && (
                  <span
                    className="ml-1 text-[10px] px-1 py-0.2 rounded bg-red-950 border border-red-500/60 text-red-300 font-bold animate-pulse"
                    title="Warning: Long due on update (>7 days inactive)"
                  >
                    🔴 Stale
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
