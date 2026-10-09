import { create } from "zustand";

export type NodeShape = "circle" | "rounded-rect" | "rect" | "hexagon" | "diamond" | "octagon";
export type ColorScheme = "classic" | "cyber" | "sunset" | "emerald";

export type BoardTheme = "wood_walnut" | "emerald_marble" | "cyber_neon" | "glassmorphism" | "slate_dark" | "classic_green" | "custom";
export type PieceSet = "neo_classic" | "alpha_modern" | "wood_carved" | "cyber_glowing" | "minimalist_flat";
export type PieceTexture = "smooth" | "wood_grain" | "metallic" | "frosted";
export type SoundPack = "classic_wood" | "digital_arcade" | "soft_glass" | "subtle_pop" | "silent";

export interface SettingsState {
  // UI & Graph Settings
  shapes: Record<string, NodeShape>;
  colorScheme: ColorScheme;
  highlightColor: string;
  floatingTitleBarColor: string;
  fontFamily: string;

  // Chess Board & Audio Settings
  boardTheme: BoardTheme;
  customLightSquare: string;
  customDarkSquare: string;
  pieceSet: PieceSet;
  pieceTexture: PieceTexture;
  showSquareLabels: boolean;
  gridLineStyle: "none" | "subtle" | "bold";
  soundPack: SoundPack;
  soundVolume: number;
  soundEnabled: boolean;

  // Actions
  setShape: (type: string, shape: NodeShape) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setHighlightColor: (color: string) => void;
  setFloatingTitleBarColor: (color: string) => void;
  setFontFamily: (font: string) => void;

  setBoardTheme: (theme: BoardTheme) => void;
  setCustomSquareColors: (light: string, dark: string) => void;
  setPieceSet: (set: PieceSet) => void;
  setPieceTexture: (texture: PieceTexture) => void;
  setShowSquareLabels: (show: boolean) => void;
  setGridLineStyle: (style: "none" | "subtle" | "bold") => void;
  setSoundPack: (pack: SoundPack) => void;
  setSoundVolume: (volume: number) => void;
  setSoundEnabled: (enabled: boolean) => void;

  getBoardColors: () => { light: string; dark: string };
  getProgressColor: (pct: number) => string;
}

const STORAGE_KEY = "rt_ui_settings_v2";

const defaultShapes: Record<string, NodeShape> = {
  pdf: "circle",
  note: "rounded-rect",
  latex: "hexagon",
  "scratch-pad": "diamond",
  notebook: "octagon",
};

const BOARD_PRESETS: Record<Exclude<BoardTheme, "custom">, { light: string; dark: string }> = {
  wood_walnut: { light: "#f0d9b5", dark: "#b58863" },
  emerald_marble: { light: "#e2e8f0", dark: "#059669" },
  cyber_neon: { light: "#1e1b4b", dark: "#4338ca" },
  glassmorphism: { light: "#ffffff30", dark: "#1e293b60" },
  slate_dark: { light: "#94a3b8", dark: "#334155" },
  classic_green: { light: "#ffffdd", dark: "#86a666" },
};

const loadInitialState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // fallback
  }
  return {
    shapes: defaultShapes,
    colorScheme: "classic",
    highlightColor: "#eab308",
    floatingTitleBarColor: "#2563eb",
    fontFamily: "system",

    boardTheme: "wood_walnut",
    customLightSquare: "#f0d9b5",
    customDarkSquare: "#b58863",
    pieceSet: "neo_classic",
    pieceTexture: "wood_grain",
    showSquareLabels: true,
    gridLineStyle: "subtle",
    soundPack: "classic_wood",
    soundVolume: 0.8,
    soundEnabled: true,
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

      boardTheme: next.boardTheme ?? state.boardTheme,
      customLightSquare: next.customLightSquare ?? state.customLightSquare,
      customDarkSquare: next.customDarkSquare ?? state.customDarkSquare,
      pieceSet: next.pieceSet ?? state.pieceSet,
      pieceTexture: next.pieceTexture ?? state.pieceTexture,
      showSquareLabels: next.showSquareLabels ?? state.showSquareLabels,
      gridLineStyle: next.gridLineStyle ?? state.gridLineStyle,
      soundPack: next.soundPack ?? state.soundPack,
      soundVolume: next.soundVolume ?? state.soundVolume,
      soundEnabled: next.soundEnabled ?? state.soundEnabled,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // best effort
    }
  };

  return {
    shapes: initial.shapes || defaultShapes,
    colorScheme: initial.colorScheme || "classic",
    highlightColor: initial.highlightColor || "#eab308",
    floatingTitleBarColor: initial.floatingTitleBarColor || "#2563eb",
    fontFamily: initial.fontFamily || "system",

    boardTheme: initial.boardTheme || "wood_walnut",
    customLightSquare: initial.customLightSquare || "#f0d9b5",
    customDarkSquare: initial.customDarkSquare || "#b58863",
    pieceSet: initial.pieceSet || "neo_classic",
    pieceTexture: initial.pieceTexture || "wood_grain",
    showSquareLabels: initial.showSquareLabels ?? true,
    gridLineStyle: initial.gridLineStyle || "subtle",
    soundPack: initial.soundPack || "classic_wood",
    soundVolume: initial.soundVolume ?? 0.8,
    soundEnabled: initial.soundEnabled ?? true,

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

    setBoardTheme: (theme) => {
      set({ boardTheme: theme });
      persist({ boardTheme: theme });
    },

    setCustomSquareColors: (light, dark) => {
      set({ customLightSquare: light, customDarkSquare: dark, boardTheme: "custom" });
      persist({ customLightSquare: light, customDarkSquare: dark, boardTheme: "custom" });
    },

    setPieceSet: (setVal) => {
      set({ pieceSet: setVal });
      persist({ pieceSet: setVal });
    },

    setPieceTexture: (texture) => {
      set({ pieceTexture: texture });
      persist({ pieceTexture: texture });
    },

    setShowSquareLabels: (show) => {
      set({ showSquareLabels: show });
      persist({ showSquareLabels: show });
    },

    setGridLineStyle: (style) => {
      set({ gridLineStyle: style });
      persist({ gridLineStyle: style });
    },

    setSoundPack: (pack) => {
      set({ soundPack: pack });
      persist({ soundPack: pack });
    },

    setSoundVolume: (vol) => {
      set({ soundVolume: vol });
      persist({ soundVolume: vol });
    },

    setSoundEnabled: (enabled) => {
      set({ soundEnabled: enabled });
      persist({ soundEnabled: enabled });
    },

    getBoardColors: () => {
      const state = get();
      if (state.boardTheme === "custom") {
        return { light: state.customLightSquare, dark: state.customDarkSquare };
      }
      return BOARD_PRESETS[state.boardTheme as Exclude<BoardTheme, "custom">] || BOARD_PRESETS.wood_walnut;
    },

    getProgressColor: (pct: number) => {
      const p = Math.max(0, Math.min(100, pct));
      const scheme = get().colorScheme;

      switch (scheme) {
        case "cyber": {
          const hue = Math.round(270 - (p / 100) * 90);
          return `hsl(${hue}, 85%, 55%)`;
        }
        case "sunset": {
          const hue = Math.round((p / 100) * 45);
          return `hsl(${hue}, 90%, 50%)`;
        }
        case "emerald": {
          const lightness = Math.round(30 + (p / 100) * 35);
          return `hsl(150, 75%, ${lightness}%)`;
        }
        case "classic":
        default: {
          const hue = Math.round((p / 100) * 120);
          return `hsl(${hue}, 75%, 45%)`;
        }
      }
    },
  };
});
