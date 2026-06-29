import { useState } from "react";

type Props = {
  currentTitle: string;
  onSubmit: (title: string) => void;
  onClose: () => void;
};

export function TitleDialog({ currentTitle, onSubmit, onClose }: Props) {
  const [title, setTitle] = useState(currentTitle);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-96 p-4">
        <h3 className="text-base font-semibold mb-3">Change title</h3>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm mb-2"
          autoFocus
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSubmit("__ai_suggest__");
            }}
            className="px-3 py-1.5 rounded text-sm bg-purple-600 hover:bg-purple-500"
          >
            AI Suggest
          </button>
          <button
            onClick={() => {
              if (title.trim()) onSubmit(title.trim());
            }}
            className="px-3 py-1.5 rounded text-sm bg-blue-600 hover:bg-blue-500"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
