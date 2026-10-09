import { useEffect, useState } from "react";
import type { ItemData } from "../../store/useGraphStore";
import { useGraphStore } from "../../store/useGraphStore";
import { api } from "../../api/client";
import { ProgressBar } from "./ProgressBar";
import { TagEditor } from "./TagEditor";
import { FlagEditor } from "./FlagEditor";
import { BlockerList } from "./BlockerList";
import { BreadcrumbTrail } from "../Breadcrumb/BreadcrumbTrail";
import { LLMSummaryCard, type AISummaryPayload } from "./LLMSummaryCard";

type Props = {
  resource: ItemData;
  onUpdate: (id: string, data: Partial<ItemData>) => void;
  onClose: () => void;
  onSelectParent?: (parentId: string, page: number | null, childId?: string) => void;
  onSpawnLLMSummary?: (itemId: string) => void;
};

export function ResourceDetail({ resource, onUpdate, onClose, onSelectParent, onSpawnLLMSummary }: Props) {
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

  let aiPayload: AISummaryPayload | null = null;
  if (resource.summary) {
    try {
      const parsed = JSON.parse(resource.summary);
      if (parsed && typeof parsed === "object" && parsed.__ai_summary__) {
        aiPayload = parsed as AISummaryPayload;
      }
    } catch {
      // standard plain text summary
    }
  }

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
      {/* Breadcrumb Trajectory Path */}
      <BreadcrumbTrail currentItem={resource} />

      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-gray-500">{resource.type}</span>
        <div className="flex items-center gap-2">
          {onSpawnLLMSummary && (
            <button
              type="button"
              onClick={() => onSpawnLLMSummary(resource.id)}
              className="bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-xs px-2 py-0.5 rounded flex items-center gap-1 font-medium transition-colors"
              title="Spawn LLM Summary for this node"
            >
              🤖 LLM Summary
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">&times;</button>
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        className="bg-transparent border-b border-gray-600 text-lg font-semibold focus:outline-none focus:border-blue-500"
      />

      {/* Role Flag Editor */}
      <FlagEditor itemId={resource.id} flags={resource.flags} isLocal={resource.is_local} />

      {/* Waiting On Prerequisites & Blockers List */}
      <BlockerList currentItem={resource} />

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

      {/* Node Opacity / Dimming Control */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-400 font-medium flex items-center gap-1">
            <span>👁️ Graph & Tree Opacity</span>
          </label>
          <span className="text-xs font-mono text-amber-400 font-bold">
            {Math.round((resource.opacity ?? 1.0) * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={resource.opacity ?? 1.0}
            onChange={async (e) => {
              const val = parseFloat(e.target.value);
              onUpdate(resource.id, { opacity: val });
              await api.put(`/items/${resource.id}`, { opacity: val }).catch(() => {});
            }}
            className="flex-1 accent-blue-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg appearance-none"
            title="Adjust note opacity to reduce visual noise in Graph & Tree views"
          />
          <div className="flex items-center gap-1 shrink-0 text-[10px]">
            {[1.0, 0.75, 0.5, 0.25, 0.1].map((p) => (
              <button
                key={p}
                onClick={async () => {
                  onUpdate(resource.id, { opacity: p });
                  await api.put(`/items/${resource.id}`, { opacity: p }).catch(() => {});
                }}
                className={`px-1.5 py-0.5 rounded font-mono transition-colors ${
                  Math.abs((resource.opacity ?? 1.0) - p) < 0.02
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {Math.round(p * 100)}%
              </button>
            ))}
          </div>
        </div>
      </div>

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
        {aiPayload ? (
          <LLMSummaryCard resource={resource} payload={aiPayload} onUpdate={onUpdate} />
        ) : (
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onBlur={save}
            rows={4}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm resize-y focus:outline-none focus:border-blue-500"
          />
        )}
      </div>

      {saving && <span className="text-xs text-gray-500">Saving...</span>}
    </div>
  );
}

