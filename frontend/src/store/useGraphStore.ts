import { create } from "zustand";

export type ItemData = {
  id: string;
  title: string;
  type: string;
  file_path: string | null;
  source_url: string | null;
  summary: string | null;
  progress: number;
  opacity?: number;
  graph_x: number | null;
  graph_y: number | null;
  parent_item_id: string | null;
  flags?: string[];
  is_local?: boolean;
  is_resolved?: boolean;
  blocker_reason?: string | null;
  resolution_note?: string | null;
  last_accessed_at?: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type ItemEdgeData = {
  id: string;
  source_item_id: string;
  target_item_id: string;
  relationship: string;
  label: string | null;
};

type GraphStore = {
  items: ItemData[];
  itemEdges: ItemEdgeData[];
  selectedItemId: string | null;
  selectedItemIds: string[];
  graphVersion: number;
  selectNonce: number;
  setItems: (items: ItemData[]) => void;
  setItemEdges: (edges: ItemEdgeData[]) => void;
  selectItem: (id: string | null) => void;
  toggleSelectItem: (id: string) => void;
  setSelectedItemIds: (ids: string[]) => void;
  clearMultiSelect: () => void;
  addItem: (item: ItemData) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, data: Partial<ItemData>) => void;
};

export const useGraphStore = create<GraphStore>((set) => ({
  items: [],
  itemEdges: [],
  selectedItemId: null,
  selectedItemIds: [],
  graphVersion: 0,
  selectNonce: 0,
  setItems: (items) => set({ items, graphVersion: Date.now() }),
  setItemEdges: (edges) => set({ itemEdges: edges }),
  selectItem: (id) =>
    set((st) => ({
      selectedItemId: id,
      selectedItemIds: id ? [id] : [],
      selectNonce: st.selectNonce + 1,
    })),
  toggleSelectItem: (id) =>
    set((st) => {
      const exists = st.selectedItemIds.includes(id);
      const nextIds = exists
        ? st.selectedItemIds.filter((x) => x !== id)
        : [...st.selectedItemIds, id];
      return {
        selectedItemIds: nextIds,
        selectedItemId: nextIds.length > 0 ? nextIds[nextIds.length - 1] : null,
        selectNonce: st.selectNonce + 1,
      };
    }),
  setSelectedItemIds: (ids) =>
    set((st) => ({
      selectedItemIds: ids,
      selectedItemId: ids.length > 0 ? ids[ids.length - 1] : null,
      selectNonce: st.selectNonce + 1,
    })),
  clearMultiSelect: () => set({ selectedItemIds: [] }),
  addItem: (item) => set((st) => ({ items: [item, ...st.items], graphVersion: Date.now() })),
  removeItem: (id) =>
    set((st) => ({
      items: st.items.filter((r) => r.id !== id),
      itemEdges: st.itemEdges.filter(
        (e) => e.source_item_id !== id && e.target_item_id !== id
      ),
      selectedItemId: st.selectedItemId === id ? null : st.selectedItemId,
      selectedItemIds: st.selectedItemIds.filter((x) => x !== id),
      graphVersion: Date.now(),
    })),
  updateItem: (id, data) =>
    set((st) => ({
      items: st.items.map((r) => (r.id === id ? { ...r, ...data } : r)),
    })),
}));

