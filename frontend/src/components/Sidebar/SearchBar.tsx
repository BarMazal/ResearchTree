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
};

export function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.get<SearchResult[]>(`/search/items?q=${encodeURIComponent(query)}`)
        .then(setResults)
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        placeholder="Search items..."
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
      />
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
