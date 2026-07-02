import { useState, useEffect, useRef } from "react";
import { api } from "../../api/client";

type Props = {
  onSelect: (id: string) => void;
};

type SearchResult = {
  id: string;
  title: string;
  type: string;
  summary: string | null;
  tags?: string[];
};

type TagOption = {
  id: string;
  name: string;
};

export function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allTags, setAllTags] = useState<TagOption[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadTags = () => {
      api.get<TagOption[]>("/tags")
        .then(setAllTags)
        .catch(() => {});
    };

    const onTagsChanged = () => loadTags();
    loadTags();

    window.addEventListener("tags:changed", onTagsChanged as EventListener);
    return () => {
      window.removeEventListener("tags:changed", onTagsChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!tagOpen) return;
    api.get<TagOption[]>("/tags")
      .then(setAllTags)
      .catch(() => {});
  }, [tagOpen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 && selectedTags.length === 0) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (trimmed) params.set("q", trimmed);
      selectedTags.forEach((tagName) => params.append("tags", tagName));

      api.get<SearchResult[]>(`/search/items?${params.toString()}`)
        .then(setResults)
        .catch(() => {});
    }, 200);

    return () => clearTimeout(timer);
  }, [query, selectedTags]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setTagOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleTag = (tagName: string) => {
    const key = tagName.toLowerCase();
    setSelectedTags((prev) =>
      prev.some((t) => t.toLowerCase() === key)
        ? prev.filter((t) => t.toLowerCase() !== key)
        : [...prev, tagName]
    );
    setOpen(true);
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          placeholder="Search words in source, metadata, tags..."
          className="min-w-0 flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => setTagOpen((v) => !v)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm hover:bg-gray-700"
          >
            Tags {selectedTags.length > 0 ? `(${selectedTags.length})` : ""}
          </button>
          {tagOpen && (
            <div className="absolute right-0 mt-1 z-30 w-64 max-h-64 overflow-y-auto bg-gray-800 border border-gray-600 rounded shadow-xl p-2">
              {allTags.length === 0 && (
                <p className="text-xs text-gray-400 px-1 py-1">No tags yet</p>
              )}
              {allTags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 px-1 py-1 text-sm hover:bg-gray-700 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTags.some((t) => t.toLowerCase() === tag.name.toLowerCase())}
                    onChange={() => toggleTag(tag.name)}
                    className="accent-blue-500"
                  />
                  <span>{tag.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="bg-blue-800 text-blue-100 text-xs px-2 py-0.5 rounded-full hover:bg-blue-700"
            >
                    {tag} x
            </button>
          ))}
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-gray-800 border border-gray-600 rounded mt-1 z-20 max-h-60 overflow-y-auto">
          {results.map((n) => (
            <button
              key={n.id}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700 border-b border-gray-700 last:border-0"
              onMouseDown={() => { onSelect(n.id); setOpen(false); setQuery(""); }}
            >
              <span className="font-medium">{n.title}</span>
              <span className="text-gray-500 ml-2 text-xs">{n.type}</span>
              {n.tags && n.tags.length > 0 && (
                <span className="block text-xs text-gray-400 mt-1">tags: {n.tags.join(", ")}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
