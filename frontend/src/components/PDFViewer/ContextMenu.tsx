import { useEffect, useRef } from "react";

export type MenuAction =
  | { type: "bookmark" }
  | { type: "spawn_note" }
  | { type: "spawn_branch" }
  | { type: "mark_progress" };

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
    { label: "Bookmark selection", type: "bookmark" as const, desc: "Save quote + page + note" },
    { label: "Spawn note", type: "spawn_note" as const, desc: "New note linked to this" },
    { label: "Spawn branch", type: "spawn_branch" as const, desc: "New item branching from this" },
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
