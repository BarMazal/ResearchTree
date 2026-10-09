import { create } from "zustand";

export type NodeShape = "circle" | "rounded-rect" | "rect" | "hexagon" | "diamond" | "octagon";
export type ColorScheme = "classic" | "cyber" | "sunset" | "emerald";

export interface SettingsState {
  shapes: Record<string, NodeShape>;
  colorScheme: ColorScheme;
  highlightColor: string;
  floatingTitleBarColor: string;
  fontFamily: string;
  setShape: (type: string, shape: NodeShape) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setHighlightColor: (color: string) => void;
  setFloatingTitleBarColor: (color: string) => void;
  setFontFamily: (font: string) => void;
  getProgressColor: (pct: number) => string;
}

const STORAGE_KEY = "rt_ui_settings_v1";

const defaultShapes: Record<string, NodeShape> = {
  pdf: "circle",
  note: "rounded-rect",
  latex: "hexagon",
  "scratch-pad": "diamond",
  notebook: "octagon",
};

const loadInitialState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // fallback to defaults
  }
  return {
    shapes: defaultShapes,
    colorScheme: "classic",
    highlightColor: "#eab308",
    floatingTitleBarColor: "#2563eb",
    fontFamily: "system",
  };
};

export const useSettingsStore = create<SettingsState>((set, get) => {
  const initial = loadInitialState();

  const persist = (next: Partial<SettingsState>) => {
    const state = get();
    const data = {
      shapes: next.shapes ?? state.shapes,
      colorScheme: next.colorScheme ?? state.colorScheme,
      highlightColor: next.highlightColor ?? state.highlightColor,
      floatingTitleBarColor: next.floatingTitleBarColor ?? state.floatingTitleBarColor,
      fontFamily: next.fontFamily ?? state.fontFamily,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // best-effort
    }
  };

  return {
    shapes: initial.shapes || defaultShapes,
    colorScheme: initial.colorScheme || "classic",
    highlightColor: initial.highlightColor || "#eab308",
    floatingTitleBarColor: initial.floatingTitleBarColor || "#2563eb",
    fontFamily: initial.fontFamily || "system",

    setShape: (type, shape) => {
      set((state) => {
        const nextShapes = { ...state.shapes, [type]: shape };
        persist({ shapes: nextShapes });
        return { shapes: nextShapes };
      });
    },

    setColorScheme: (scheme) => {
      set({ colorScheme: scheme });
      persist({ colorScheme: scheme });
    },

    setHighlightColor: (color) => {
      set({ highlightColor: color });
      persist({ highlightColor: color });
    },

    setFloatingTitleBarColor: (color) => {
      set({ floatingTitleBarColor: color });
      persist({ floatingTitleBarColor: color });
    },

    setFontFamily: (font) => {
      set({ fontFamily: font });
      persist({ fontFamily: font });
    },

    getProgressColor: (pct: number) => {
      const p = Math.max(0, Math.min(100, pct));
      const scheme = get().colorScheme;

      switch (scheme) {
        case "cyber": {
          // Purple (270) -> Cyan (180)
          const hue = Math.round(270 - (p / 100) * 90);
          return `hsl(${hue}, 85%, 55%)`;
        }
        case "sunset": {
          // Deep Red (0) -> Gold (45)
          const hue = Math.round((p / 100) * 45);
          return `hsl(${hue}, 90%, 50%)`;
        }
        case "emerald": {
          // Muted Emerald (140) with lightness gradient
          const lightness = Math.round(30 + (p / 100) * 35);
          return `hsl(150, 75%, ${lightness}%)`;
        }
        case "classic":
        default: {
          // Red (0) -> Green (120)
          const hue = Math.round((p / 100) * 120);
          return `hsl(${hue}, 75%, 45%)`;
        }
      }
    },
  };
});
