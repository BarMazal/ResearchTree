import { useRef, useEffect } from "react";

type Props = {
  onWidthChange: (w: number) => void;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  getWidthFromClientX?: (clientX: number) => number;
};

export function GraphSplitter({
  onWidthChange,
  minWidth = 200,
  maxWidth = 800,
  className,
  getWidthFromClientX,
}: Props) {
  const splitterRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const latestClientX = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const onChangeRef = useRef(onWidthChange);
  onChangeRef.current = onWidthChange;

  useEffect(() => {
    const widthFromClientX = (clientX: number) => {
      if (getWidthFromClientX) return getWidthFromClientX(clientX);
      const rect = splitterRef.current?.parentElement?.getBoundingClientRect();
      return rect ? clientX - rect.left : clientX;
    };

    const flush = () => {
      rafId.current = null;
      if (!dragging.current || latestClientX.current == null) return;
      const rawWidth = widthFromClientX(latestClientX.current);
      const newWidth = Math.max(minWidth, Math.min(maxWidth, rawWidth));
      onChangeRef.current(newWidth);
    };

    const queueFlush = () => {
      if (rafId.current != null) return;
      rafId.current = requestAnimationFrame(flush);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      latestClientX.current = e.clientX;
      queueFlush();
    };

    const onPointerUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current);
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [minWidth, maxWidth, getWidthFromClientX]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragging.current = true;
    latestClientX.current = e.clientX;
    splitterRef.current?.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      ref={splitterRef}
      className={className ?? "w-1.5 bg-gray-700 hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors touch-none"}
      onPointerDown={handlePointerDown}
    />
  );
}
