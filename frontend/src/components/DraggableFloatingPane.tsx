import { useState, useRef, type ReactNode } from "react";
import { useSettingsStore } from "../store/useSettingsStore";

type Props = {
  title: string;
  initialX?: number;
  initialY?: number;
  width?: number;
  height?: number;
  onClose: () => void;
  onPopout?: () => void;
  children: ReactNode;
};

export function DraggableFloatingPane({
  title,
  initialX = 80,
  initialY = 80,
  width = 380,
  height = 550,
  onClose,
  onPopout,
  children,
}: Props) {
  const floatingTitleBarColor = useSettingsStore((st) => st.floatingTitleBarColor || "#2563eb");
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isMaximized) return; // Prevent dragging while maximized
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const newX = moveEvent.clientX - dragStartRef.current.x;
      const newY = moveEvent.clientY - dragStartRef.current.y;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 100, newX)),
        y: Math.max(0, Math.min(window.innerHeight - 40, newY)),
      });
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  };

  const currentWidth = isMaximized
    ? "calc(100vw - 20px)"
    : isMinimized
    ? "260px"
    : `${width}px`;

  const currentHeight = isMaximized
    ? "calc(100vh - 60px)"
    : isMinimized
    ? "38px"
    : `${height}px`;

  const currentLeft = isMaximized ? "10px" : `${pos.x}px`;
  const currentTop = isMaximized ? "50px" : `${pos.y}px`;

  return (
    <div
      style={{
        left: currentLeft,
        top: currentTop,
        width: currentWidth,
        height: currentHeight,
        borderColor: `${floatingTitleBarColor}aa`,
        boxShadow: `0 12px 35px rgba(0,0,0,0.65), 0 0 0 1px ${floatingTitleBarColor}88`,
      }}
      className={`fixed ${isMaximized ? "z-[60]" : "z-50"} bg-gray-900 border rounded-lg flex flex-col overflow-hidden transition-[width,height,left,top] duration-150 ease-out`}
    >
      <header
        onPointerDown={handlePointerDown}
        style={{ backgroundColor: floatingTitleBarColor }}
        className="px-3 py-1.5 flex items-center justify-between shrink-0 select-none cursor-move touch-none h-[38px] border-b border-black/20 text-white"
      >
        <div className="flex items-center gap-2 truncate mr-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
          <span className="text-xs font-semibold text-gray-200 truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized((m) => !m);
              if (!isMinimized) setIsMaximized(false);
            }}
            className="px-1.5 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded font-mono"
            title={isMinimized ? "Restore window size" : "Minimize to tile bar"}
          >
            {isMinimized ? "□" : "─"}
          </button>
          {!isMinimized && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMaximized((m) => !m);
              }}
              className="px-1.5 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded font-mono"
              title={isMaximized ? "Restore window size" : "Maximize window"}
            >
              {isMaximized ? "❐" : "□"}
            </button>
          )}
          {onPopout && !isMinimized && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPopout();
              }}
              className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
              title="Popout into separate desktop window outside browser"
            >
              Popout ↗
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-2 py-0.5 text-xs bg-blue-700 hover:bg-blue-600 text-white rounded font-medium"
            title="Dock back into main layout"
          >
            Dock
          </button>
        </div>
      </header>
      {!isMinimized && (
        <div className="flex-1 overflow-auto min-h-0 flex flex-col relative">
          {children}
        </div>
      )}
    </div>
  );
}

