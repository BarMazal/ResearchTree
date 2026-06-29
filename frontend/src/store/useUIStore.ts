import { create } from "zustand";

type UIStore = {
  searchQuery: string;
  leftPanel: "tree" | "list";
  rightPanel: "pdf" | "node" | "split";
  setSearchQuery: (q: string) => void;
  setLeftPanel: (p: "tree" | "list") => void;
  setRightPanel: (p: "pdf" | "node" | "split") => void;
};

export const useUIStore = create<UIStore>((set) => ({
  searchQuery: "",
  leftPanel: "tree",
  rightPanel: "split",
  setSearchQuery: (q) => set({ searchQuery: q }),
  setLeftPanel: (p) => set({ leftPanel: p }),
  setRightPanel: (p) => set({ rightPanel: p }),
}));
