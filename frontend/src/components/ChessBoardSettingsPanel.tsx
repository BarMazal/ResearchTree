import { useState } from "react";
import {
  useSettingsStore,
  type BoardTheme,
  type PieceSet,
  type PieceTexture,
  type SoundPack,
} from "../store/useSettingsStore";
import { chessAudio } from "../utils/chessAudio";

const BOARD_PRESETS: { id: BoardTheme; name: string; icon: string; light: string; dark: string }[] = [
  { id: "wood_walnut", name: "Classic Walnut Wood", icon: "🪵", light: "#f0d9b5", dark: "#b58863" },
  { id: "emerald_marble", name: "Emerald Marble", icon: "💚", light: "#e2e8f0", dark: "#059669" },
  { id: "cyber_neon", name: "Cyberpunk Neon", icon: "🎆", light: "#1e1b4b", dark: "#4338ca" },
  { id: "glassmorphism", name: "Frosted Glass", icon: "❄️", light: "#ffffff30", dark: "#1e293b60" },
  { id: "slate_dark", name: "Midnight Slate", icon: "🌑", light: "#94a3b8", dark: "#334155" },
  { id: "classic_green", name: "Tournament Green", icon: "🟩", light: "#ffffdd", dark: "#86a666" },
];

const PIECE_SETS: { id: PieceSet; name: string; desc: string }[] = [
  { id: "neo_classic", name: "Neo Classic", desc: "Traditional Staunton-style chess pieces" },
  { id: "alpha_modern", name: "Alpha Modern", desc: "Sharp vector geometry for fast tactical reading" },
  { id: "wood_carved", name: "3D Carved Wood", desc: "Warm carved timber texture and depth" },
  { id: "cyber_glowing", name: "Cyber Neon Outline", desc: "Glowing neon vector contours for dark mode" },
  { id: "minimalist_flat", name: "Minimalist Flat", desc: "Clean modern flat design icons" },
];

const PIECE_TEXTURES: { id: PieceTexture; name: string; filterStyle: string }[] = [
  { id: "smooth", name: "Smooth Gloss", filterStyle: "none" },
  { id: "wood_grain", name: "Wood Grain Texture", filterStyle: "contrast(115%) sepia(20%)" },
  { id: "metallic", name: "Metallic Shine", filterStyle: "brightness(120%) contrast(130%)" },
  { id: "frosted", name: "Frosted Glass", filterStyle: "opacity(85%) drop-shadow(0 4px 6px rgba(0,0,0,0.3))" },
];

const SOUND_PACKS: { id: SoundPack; name: string; icon: string }[] = [
  { id: "classic_wood", name: "Classic Acoustic Wood", icon: "🪵" },
  { id: "digital_arcade", name: "Digital Arcade", icon: "👾" },
  { id: "soft_glass", name: "Soft Crystal Glass", icon: "🥂" },
  { id: "subtle_pop", name: "Subtle Tactile Pop", icon: "🎈" },
  { id: "silent", name: "Muted / Silent", icon: "🔇" },
];

// Sample board position FEN for preview
const INITIAL_PREVIEW_PIECES: Record<string, string> = {
  a8: "r", b8: "n", c8: "b", d8: "q", e8: "k", f8: "b", g8: "n", h8: "r",
  a7: "p", b7: "p", c7: "p", d7: "p", e7: "p", f7: "p", g7: "p", h7: "p",
  a2: "P", b2: "P", c2: "P", d2: "P", e4: "P", f2: "P", g2: "P", h2: "P",
  a1: "R", b1: "N", c1: "B", d1: "Q", e1: "K", f1: "B", g1: "N", h1: "R",
  c4: "B", f3: "N", c5: "b", f6: "n",
};

const PIECE_UNICODE: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

export function ChessBoardSettingsPanel() {
  const {
    boardTheme,
    customLightSquare,
    customDarkSquare,
    pieceSet,
    pieceTexture,
    showSquareLabels,
    gridLineStyle,
    soundPack,
    soundVolume,
    soundEnabled,
    setBoardTheme,
    setCustomSquareColors,
    setPieceSet,
    setPieceTexture,
    setShowSquareLabels,
    setGridLineStyle,
    setSoundPack,
    setSoundVolume,
    setSoundEnabled,
    getBoardColors,
  } = useSettingsStore();

  const [activeSquare, setActiveSquare] = useState<string | null>("e4");

  const colors = getBoardColors();
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

  const handleSquareClick = (square: string, hasPiece: boolean) => {
    setActiveSquare(square);
    if (!soundEnabled || soundPack === "silent") return;
    if (hasPiece) {
      chessAudio.playCapture(soundPack, soundVolume);
    } else {
      chessAudio.playMove(soundPack, soundVolume);
    }
  };

  const currentTexture = PIECE_TEXTURES.find((t) => t.id === pieceTexture) ?? PIECE_TEXTURES[0];

  return (
    <div className="flex flex-col lg:flex-row gap-6 text-gray-200">
      {/* Settings Form Controls */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto max-h-[580px] pr-2">
        {/* 1. Board Theme Selection */}
        <section className="bg-gray-800/80 border border-gray-700 p-4 rounded-lg flex flex-col gap-3">
          <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
            <span>🎨 Board Theme & Square Colors</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {BOARD_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setBoardTheme(preset.id)}
                className={`flex items-center gap-2 p-2 rounded border text-left text-xs transition ${
                  boardTheme === preset.id
                    ? "border-blue-500 bg-blue-950/40 text-blue-200 font-semibold ring-1 ring-blue-500"
                    : "border-gray-700 bg-gray-900/60 hover:bg-gray-700 text-gray-300"
                }`}
              >
                <div
                  className="w-5 h-5 rounded flex overflow-hidden border border-gray-600 shrink-0"
                  style={{ background: `linear-gradient(135deg, ${preset.light} 50%, ${preset.dark} 50%)` }}
                />
                <span className="truncate">{preset.icon} {preset.name}</span>
              </button>
            ))}
          </div>

          {/* Custom Color Pickers */}
          <div className="flex flex-wrap items-center gap-4 mt-2 pt-2 border-t border-gray-700/60 text-xs">
            <label className="flex items-center gap-2">
              <span className="text-gray-400">Custom Light Square:</span>
              <input
                type="color"
                value={customLightSquare}
                onChange={(e) => setCustomSquareColors(e.target.value, customDarkSquare)}
                className="w-7 h-7 rounded border border-gray-600 bg-transparent cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-gray-400">Custom Dark Square:</span>
              <input
                type="color"
                value={customDarkSquare}
                onChange={(e) => setCustomSquareColors(customLightSquare, e.target.value)}
                className="w-7 h-7 rounded border border-gray-600 bg-transparent cursor-pointer"
              />
            </label>
          </div>
        </section>

        {/* 2. Piece Set & Texture Options */}
        <section className="bg-gray-800/80 border border-gray-700 p-4 rounded-lg flex flex-col gap-3">
          <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
            <span>♟️ Piece Set Style & Surface Texture</span>
          </h3>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400">Piece Graphic Set:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PIECE_SETS.map((set) => (
                <button
                  key={set.id}
                  onClick={() => setPieceSet(set.id)}
                  className={`p-2 rounded border text-left text-xs transition ${
                    pieceSet === set.id
                      ? "border-blue-500 bg-blue-950/40 text-blue-200 font-semibold"
                      : "border-gray-700 bg-gray-900/60 hover:bg-gray-700 text-gray-300"
                  }`}
                >
                  <div className="font-semibold">{set.name}</div>
                  <div className="text-[10px] text-gray-400">{set.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Surface Finish / Texture:</label>
              <select
                value={pieceTexture}
                onChange={(e) => setPieceTexture(e.target.value as PieceTexture)}
                className="w-full bg-gray-900 border border-gray-600 text-xs rounded p-1.5 text-white"
              >
                {PIECE_TEXTURES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Grid Lines Overlay:</label>
              <select
                value={gridLineStyle}
                onChange={(e) => setGridLineStyle(e.target.value as "none" | "subtle" | "bold")}
                className="w-full bg-gray-900 border border-gray-600 text-xs rounded p-1.5 text-white"
              >
                <option value="none">None (Seamless)</option>
                <option value="subtle">Subtle Grid Lines</option>
                <option value="bold">Bold Square Borders</option>
              </select>
            </div>
          </div>

          <div className="mt-1">
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showSquareLabels}
                onChange={(e) => setShowSquareLabels(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              Show Rank & File Coordinates (a-h, 1-8)
            </label>
          </div>
        </section>

        {/* 3. Audio & Sound Effects Pack */}
        <section className="bg-gray-800/80 border border-gray-700 p-4 rounded-lg flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
              <span>🔊 Audio Feedback & Sound Effects</span>
            </h3>
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              Enable Sound Effects
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Sound FX Pack:</label>
              <div className="flex flex-col gap-1.5">
                {SOUND_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => setSoundPack(pack.id)}
                    className={`flex items-center justify-between p-1.5 rounded border text-xs text-left ${
                      soundPack === pack.id
                        ? "border-blue-500 bg-blue-950/40 text-blue-200 font-semibold"
                        : "border-gray-700 bg-gray-900/60 hover:bg-gray-700 text-gray-300"
                    }`}
                  >
                    <span>{pack.icon} {pack.name}</span>
                    {soundPack === pack.id && <span className="text-[10px] text-blue-400">Active</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Master Volume:</span>
                  <span>{Math.round(soundVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                  disabled={!soundEnabled}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Sound Test Playground */}
              <div className="bg-gray-900/80 p-3 rounded border border-gray-750 flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-gray-400">Test Sound FX Effects:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => chessAudio.playMove(soundPack, soundVolume)}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-xs rounded border border-gray-600 text-gray-200 flex items-center justify-center gap-1"
                  >
                    <span>🔊 Normal Move</span>
                  </button>
                  <button
                    onClick={() => chessAudio.playCapture(soundPack, soundVolume)}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-xs rounded border border-gray-600 text-gray-200 flex items-center justify-center gap-1"
                  >
                    <span>⚔️ Capture</span>
                  </button>
                  <button
                    onClick={() => chessAudio.playCheck(soundPack, soundVolume)}
                    className="px-2 py-1 bg-yellow-950/60 hover:bg-yellow-900/80 text-xs rounded border border-yellow-700 text-yellow-200 flex items-center justify-center gap-1"
                  >
                    <span>⚠️ Check</span>
                  </button>
                  <button
                    onClick={() => chessAudio.playBlunder(soundPack, soundVolume)}
                    className="px-2 py-1 bg-red-950/60 hover:bg-red-900/80 text-xs rounded border border-red-700 text-red-200 flex items-center justify-center gap-1"
                  >
                    <span>❌ Blunder</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 4. Live Interactive Board Preview Pane */}
      <div className="w-full lg:w-80 flex flex-col gap-3 bg-gray-900/90 border border-gray-700 p-4 rounded-lg items-center shrink-0">
        <div className="w-full flex justify-between items-center border-b border-gray-800 pb-2">
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            Live Board & Piece Preview
          </span>
          <span className="text-[10px] text-blue-400 font-mono">Click square to test sound</span>
        </div>

        {/* 8x8 Board Container */}
        <div
          className={`w-72 h-72 rounded border relative overflow-hidden shadow-2xl transition-all ${
            gridLineStyle === "bold"
              ? "border-2 border-gray-600 divide-y"
              : gridLineStyle === "subtle"
              ? "border border-gray-750"
              : "border-transparent"
          }`}
          style={{
            backgroundColor: colors.dark,
          }}
        >
          <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
            {ranks.map((r, rIdx) =>
              files.map((f, fIdx) => {
                const square = `${f}${r}`;
                const isLight = (rIdx + fIdx) % 2 === 0;
                const sqColor = isLight ? colors.light : colors.dark;
                const pieceCode = INITIAL_PREVIEW_PIECES[square];
                const isSelected = activeSquare === square;

                return (
                  <div
                    key={square}
                    onClick={() => handleSquareClick(square, !!pieceCode)}
                    className="relative flex items-center justify-center cursor-pointer select-none transition-all hover:brightness-110"
                    style={{
                      backgroundColor: sqColor,
                      boxShadow: isSelected ? "inset 0 0 0 2px #3b82f6" : "none",
                    }}
                  >
                    {/* Piece Symbol */}
                    {pieceCode && (
                      <span
                        className={`text-2xl font-bold transition-transform ${
                          pieceCode === pieceCode.toUpperCase() ? "text-gray-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" : "text-gray-950"
                        }`}
                        style={{
                          filter: currentTexture.filterStyle,
                          fontFamily: pieceSet === "alpha_modern" ? "sans-serif" : "serif",
                        }}
                      >
                        {PIECE_UNICODE[pieceCode] || pieceCode}
                      </span>
                    )}

                    {/* Rank & File Coordinates */}
                    {showSquareLabels && (
                      <>
                        {fIdx === 0 && (
                          <span
                            className={`absolute top-0.5 left-0.5 text-[8px] font-mono font-bold opacity-60 ${
                              isLight ? "text-gray-800" : "text-gray-200"
                            }`}
                          >
                            {r}
                          </span>
                        )}
                        {rIdx === 7 && (
                          <span
                            className={`absolute bottom-0.5 right-0.5 text-[8px] font-mono font-bold opacity-60 ${
                              isLight ? "text-gray-800" : "text-gray-200"
                            }`}
                          >
                            {f}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="w-full text-center bg-gray-800/80 p-2 rounded border border-gray-750 text-xs">
          <span className="text-gray-400 block text-[10px]">Active Theme Preset:</span>
          <span className="font-bold text-blue-300">
            {BOARD_PRESETS.find((p) => p.id === boardTheme)?.name || "Custom Palette"}
          </span>
          <span className="text-gray-400 block text-[10px] mt-1">Active Sound Pack:</span>
          <span className="font-bold text-purple-300">
            {SOUND_PACKS.find((p) => p.id === soundPack)?.name} ({Math.round(soundVolume * 100)}% Vol)
          </span>
        </div>
      </div>
    </div>
  );
}
