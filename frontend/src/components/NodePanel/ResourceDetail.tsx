import { useEffect, useState } from "react";
import type { ItemData } from "../../store/useGraphStore";
import { useGraphStore } from "../../store/useGraphStore";
import { api } from "../../api/client";
import { ProgressBar } from "./ProgressBar";
import { TagEditor } from "./TagEditor";

type Props = {
  resource: ItemData;
  onUpdate: (id: string, data: Partial<ItemData>) => void;
  onClose: () => void;
  onSelectParent?: (parentId: string, page: number | null, childId?: string) => void;
};

export function ResourceDetail({ resource, onUpdate, onClose, onSelectParent }: Props) {
  const items = useGraphStore((st) => st.items);
  const [tagMap, setTagMap] = useState<Record<string, string>>({});
  const [title, setTitle] = useState(resource.title);
  const [summary, setSummary] = useState(resource.summary ?? "");
  const [saving, setSaving] = useState(false);
  const [originBookmark, setOriginBookmark] = useState<{
    id: string;
    item_id: string;
    page: number | null;
    quote: string | null;
    note: string | null;
  } | null>(null);

  useEffect(() => {
    setOriginBookmark(null);
    api.get<any>(`/bookmarks/origin/${resource.id}`)
      .then((b) => {
        if (b) setOriginBookmark(b);
      })
      .catch(() => {});
  }, [resource.id]);

  const parentItem = resource.parent_item_id ? items.find((i) => i.id === resource.parent_item_id) : null;

  useEffect(() => {
    setTitle(resource.title);
    setSummary(resource.summary ?? "");
  }, [resource.id, resource.title, resource.summary]);

  useEffect(() => {
    api.get<{ id: string; name: string }[]>("/tags")
      .then((tags) => {
        const m: Record<string, string> = {};
        tags.forEach((t) => { m[t.name] = t.id; });
        setTagMap(m);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/items/${resource.id}`, { title, summary: summary || null });
      onUpdate(resource.id, { title, summary: summary || null });
    } finally {
      setSaving(false);
    }
  };

  const updateProgress = async (v: number) => {
    onUpdate(resource.id, { progress: v });
    await api.put(`/items/${resource.id}`, { progress: v }).catch(() => {});
  };

  const addTag = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const created = await api.post<{ id: string; name: string }>("/tags", { name: trimmed });
    const nextNameToId = { ...tagMap, [created.name]: created.id };
    setTagMap(nextNameToId);

    window.dispatchEvent(new Event("tags:changed"));

    const seen = new Set<string>();
    const nextTags = [...resource.tags, created.name].filter((tagName) => {
      const key = tagName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const nextIds = nextTags.map((t) => nextNameToId[t]).filter(Boolean);
    await api.put(`/items/${resource.id}`, { tag_ids: nextIds });
    onUpdate(resource.id, { tags: nextTags });
  };

  const removeTag = async (name: string) => {
    const newTags = resource.tags.filter((t) => t !== name);
    const newIds = newTags.map((t) => tagMap[t]).filter(Boolean);
    await api.put(`/items/${resource.id}`, { tag_ids: newIds });
    onUpdate(resource.id, { tags: newTags });
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-850 border-t border-gray-700">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-gray-500">{resource.type}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">&times;</button>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        className="bg-transparent border-b border-gray-600 text-lg font-semibold focus:outline-none focus:border-blue-500"
      />

      {originBookmark && (
        <div className="bg-blue-950/20 border border-blue-900/40 rounded p-2.5 text-sm">
          <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider block mb-1">Spawned Origin</span>
          <p className="text-xs text-gray-300">
            From {parentItem ? (
              <button
                type="button"
                onClick={() => onSelectParent && onSelectParent(parentItem.id, originBookmark.page, resource.id)}
                className="text-blue-300 hover:underline font-semibold text-left"
              >
                {parentItem.title}
              </button>
            ) : (
              "parent item"
            )}
            {originBookmark.page && ` (page ${originBookmark.page})`}
          </p>
          {originBookmark.quote && (
            <p className="text-gray-400 italic text-xs mt-1.5 bg-gray-900/40 p-2 rounded border border-gray-800/80">
              &ldquo;{originBookmark.quote}&rdquo;
            </p>
          )}
        </div>
      )}

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Progress</label>
        <ProgressBar value={resource.progress} onChange={updateProgress} />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Tags</label>
        <TagEditor
          tags={resource.tags}
          allTags={Object.keys(tagMap).sort((a, b) => a.localeCompare(b))}
          onAdd={addTag}
          onRemove={removeTag}
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Summary</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={save}
          rows={4}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm resize-y focus:outline-none focus:border-blue-500"
        />
      </div>

      {saving && <span className="text-xs text-gray-500">Saving...</span>}
    </div>
  );
}
