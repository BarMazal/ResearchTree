import { useState } from "react";

type Props = {
  tags: string[];
  allTags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
};

export function TagEditor({ tags, allTags, onAdd, onRemove }: Props) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const safeTags = (tags || []).map((t) => (typeof t === "string" ? t : (t as any)?.name || String(t)));
  const safeAllTags = (allTags || []).map((t) => (typeof t === "string" ? t : (t as any)?.name || String(t)));

  const suggestions = safeAllTags.filter(
    (t) => !safeTags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">
        {safeTags.map((t) => (
          <span
            key={t}
            className="bg-blue-800 text-blue-100 text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
          >
            {t}
            <button onClick={() => onRemove(t)} className="hover:text-white">&times;</button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              onAdd(input.trim());
              setInput("");
            }
          }}
          placeholder="Add tag..."
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
        />
        {isFocused && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-gray-800 border border-gray-600 rounded mt-1 z-20 max-h-40 overflow-y-auto shadow-lg">
            {suggestions.map((s) => (
              <button
                key={s}
                className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-700"
                onMouseDown={() => {
                  onAdd(s);
                  setInput("");
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

