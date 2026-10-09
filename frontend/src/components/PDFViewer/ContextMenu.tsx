import { useEffect, useRef } from "react";

export type MenuAction =
  | { type: "bookmark" }
  | { type: "spawn_branch" }
  | { type: "spawn_waiting_on" }
  | { type: "mark_progress" }
  | { type: "spawn_llm_summary" }
  | { type: "spawn_notebook" };

type Props = {
  x: number;
  y: number;
  selectedText: string;
  onAction: (action: MenuAction) => void;
  onClose: () => void;
};

export function ContextMenu({ x, y, selectedText, onAction, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const items = [
    { label: "⏳ Spawn Waiting On...", type: "spawn_waiting_on" as const, desc: "Prerequisite blocker with reason & resolution tracking" },
    { label: "Bookmark selection", type: "bookmark" as const, desc: "Save quote + page + note" },
    { label: "Spawn LLM Summary", type: "spawn_llm_summary" as const, desc: "Ollama summary & bi-directional link" },
    { label: "Spawn NotebookLM", type: "spawn_notebook" as const, desc: "Upload selection to NotebookLM" },
    { label: "Spawn child note", type: "spawn_branch" as const, desc: "New child note linked to selection" },
    { label: "Mark progress here", type: "mark_progress" as const, desc: "Set progress to current page" },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-52"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-700 truncate max-w-60">
        &ldquo;{selectedText.slice(0, 60)}&rdquo;
      </div>
      {items.map((item) => (
        <button
          key={item.type}
          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex flex-col"
          onMouseDown={() => {
            onAction({ type: item.type });
            onClose();
          }}
        >
          <span>{item.label}</span>
          <span className="text-xs text-gray-500">{item.desc}</span>
        </button>
      ))}
    </div>
  );
}

