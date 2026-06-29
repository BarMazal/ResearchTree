import { useEffect, useState } from "react";
import type { ItemData } from "../../store/useGraphStore";
import { api } from "../../api/client";
import { ProgressBar } from "./ProgressBar";
import { TagEditor } from "./TagEditor";

type Props = {
  resource: ItemData;
  onUpdate: (id: string, data: Partial<ItemData>) => void;
  onClose: () => void;
};

export function ResourceDetail({ resource, onUpdate, onClose }: Props) {
  const [tagMap, setTagMap] = useState<Record<string, string>>({});
  const [title, setTitle] = useState(resource.title);
  const [summary, setSummary] = useState(resource.summary ?? "");
  const [saving, setSaving] = useState(false);

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
    const tag = await api.post<{ id: string }>("/tags", { name });
    setTagMap((prev) => ({ ...prev, [tag.id]: name }));
    const currentIds = resource.tags.map((t) => tagMap[t]).filter(Boolean);
    await api.put(`/items/${resource.id}`, { tag_ids: [...currentIds, tag.id] });
    onUpdate(resource.id, { tags: [...resource.tags, name] });
  };

  const removeTag = async (name: string) => {
    const id = tagMap[name];
    const newTags = resource.tags.filter((t) => t !== name);
    if (id) {
      const newIds = newTags.map((t) => tagMap[t]).filter(Boolean);
      await api.put(`/items/${resource.id}`, { tag_ids: newIds });
    }
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

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Progress</label>
        <ProgressBar value={resource.progress} onChange={updateProgress} />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Tags</label>
        <TagEditor tags={resource.tags} allTags={Object.keys(tagMap)} onAdd={addTag} onRemove={removeTag} />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Summary</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={save}
          rows={4}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm resize-none focus:outline-none focus:border-blue-500"
        />
      </div>

      {saving && <span className="text-xs text-gray-500">Saving...</span>}
    </div>
  );
}
