import { useRef, useEffect } from "react";

type Props = {
  onWidthChange: (w: number) => void;
  minWidth?: number;
  maxWidth?: number;
};

export function GraphSplitter({ onWidthChange, minWidth = 200, maxWidth = 800 }: Props) {
  const dragging = useRef(false);
  const onChangeRef = useRef(onWidthChange);
  onChangeRef.current = onWidthChange;

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX));
      onChangeRef.current(newWidth);
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [minWidth, maxWidth]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className="w-1.5 bg-gray-700 hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors"
      onMouseDown={handleMouseDown}
    />
  );
}
