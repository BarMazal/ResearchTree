import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useGraphStore } from "../../store/useGraphStore";

type Bookmark = {
  id: string;
  page: number | null;
  chapter: string | null;
  quote: string | null;
  note: string | null;
  spawned_item_id?: string | null;
  created_at: string;
};

type Props = {
  itemId: string;
  refreshNonce?: number;
  onSelectSpawned?: (spawnedId: string) => void;
  onSelectBookmark?: (page: number | null, spawnedItemId: string | null, quote: string | null) => void;
};

export function BookmarkList({ itemId, refreshNonce, onSelectSpawned, onSelectBookmark }: Props) {
  const items = useGraphStore((st) => st.items);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    api.get<Bookmark[]>(`/bookmarks/item/${itemId}`)
      .then(setBookmarks)
      .catch(() => {});
  }, [itemId, refreshNonce]);

  const remove = async (id: string) => {
    await api.delete(`/bookmarks/${id}`);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="border-t border-gray-700 pt-3 px-4 pb-4">
      <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Bookmarks</h4>
      {bookmarks.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No bookmarks yet. Select text in the PDF reader and right-click to bookmark or spawn items.</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
        {bookmarks.map((b) => (
          <div key={b.id} className="bg-gray-800 rounded p-2 text-sm relative group">
            <button
              onClick={() => remove(b.id)}
              className="absolute top-1 right-1 text-gray-500 hover:text-red-400 text-xs hidden group-hover:block z-10"
            >
              &times;
            </button>
            <div
              onClick={() => onSelectBookmark && onSelectBookmark(b.page, b.spawned_item_id ?? null, b.quote)}
              className="cursor-pointer hover:bg-gray-700/50 -m-2 p-2 rounded transition-colors"
            >
              {b.page && <span className="text-xs text-blue-400 hover:underline">p.{b.page}</span>}
              {b.quote && <p className="text-gray-300 italic mt-1">&ldquo;{b.quote}&rdquo;</p>}
              {b.note && <p className="text-gray-400 text-xs mt-1">{b.note}</p>}
            </div>
            {b.spawned_item_id && onSelectSpawned && (() => {
              const spawnedItem = items.find((i) => i.id === b.spawned_item_id);
              if (!spawnedItem) return null;
              return (
                <div className="mt-1.5 flex items-center gap-1">
                  <span className="text-[10px] bg-blue-900/60 text-blue-200 px-1.5 py-0.5 rounded shrink-0 font-medium">Child Link</span>
                  <button
                    onClick={() => onSelectSpawned(spawnedItem.id)}
                    className="text-xs text-blue-300 hover:underline text-left truncate font-medium max-w-[200px]"
                  >
                    {spawnedItem.title}
                  </button>
                </div>
              );
            })()}
          </div>
        ))}
        </div>
      )}
    </div>
  );
}
