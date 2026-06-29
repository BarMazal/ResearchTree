import { useEffect, useState } from "react";
import { api } from "../../api/client";

type Bookmark = {
  id: string;
  page: number | null;
  chapter: string | null;
  quote: string | null;
  note: string | null;
  created_at: string;
};

type Props = {
  itemId: string;
};

export function BookmarkList({ itemId }: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    api.get<Bookmark[]>(`/bookmarks/item/${itemId}`)
      .then(setBookmarks)
      .catch(() => {});
  }, [itemId]);

  const remove = async (id: string) => {
    await api.delete(`/bookmarks/${id}`);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  if (bookmarks.length === 0) return null;

  return (
    <div className="border-t border-gray-700 pt-3 px-4 pb-4">
      <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Bookmarks</h4>
      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
        {bookmarks.map((b) => (
          <div key={b.id} className="bg-gray-800 rounded p-2 text-sm relative group">
            <button
              onClick={() => remove(b.id)}
              className="absolute top-1 right-1 text-gray-500 hover:text-red-400 text-xs hidden group-hover:block"
            >
              &times;
            </button>
            {b.page && <span className="text-xs text-blue-400">p.{b.page}</span>}
            {b.quote && <p className="text-gray-300 italic mt-1">&ldquo;{b.quote}&rdquo;</p>}
            {b.note && <p className="text-gray-400 text-xs mt-1">{b.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
