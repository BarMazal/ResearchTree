import { useState } from "react";
import type { MenuAction } from "./ContextMenu";

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

  const dialogConfig = () => {
    switch (action.type) {
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
      case "spawn_note":
        return {
          title: "Spawn Note",
          fields: (
            <>
              <p className="text-xs text-gray-400 mb-2">
                From &ldquo;{selectedText.slice(0, 80)}&rdquo;
              </p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title..."
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                autoFocus
              />
            </>
          ),
          onSubmit: () =>
            onSubmit({
              title: title || selectedText.slice(0, 80),
              type: "note",
              parent_item_id: currentItemId,
            }),
        };
      case "spawn_branch":
        return {
          title: "Spawn Branch",
          fields: (
            <>
              <p className="text-xs text-gray-400 mb-2">
                New item branching from &ldquo;{selectedText.slice(0, 60)}&rdquo;
              </p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Item title..."
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                autoFocus
              />
            </>
          ),
          onSubmit: () =>
            onSubmit({
              title: title || selectedText.slice(0, 80),
              type: "note",
              parent_item_id: currentItemId,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-96 p-4">
        <h3 className="text-base font-semibold mb-3">{config.title}</h3>
        <div className="flex flex-col gap-3">{config.fields}</div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              config.onSubmit();
              onClose();
            }}
            className="px-3 py-1.5 rounded text-sm bg-blue-600 hover:bg-blue-500"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
